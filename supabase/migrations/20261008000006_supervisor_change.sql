-- Supervisor changes, and "tickets" become "queries" in everything users see.
--
-- A group's supervisor can change two ways:
--   1. The PBL office (admin) changes it directly, giving a reason.
--   2. A student raises a "Change of supervisor" query. The current
--      supervisor approves it (it goes to the PBL office) or declines it;
--      the PBL office then picks the new supervisor. The query is the reason.
-- Every change is recorded in supervisor_changes and notifies the group, the
-- old supervisor and the new one, with the reason.

-- ------------------------------------------------------------ queries

alter table public.tickets
  add column category text not null default 'general'
    check (category in ('general', 'supervisor_change')),
  add column forwarded_at timestamptz,
  add column admin_reply text,
  add column admin_replied_at timestamptz;

-- open = waiting for the supervisor; forwarded = supervisor approved, waiting
-- for the PBL office; declined = turned down (supervisor or PBL office).
alter table public.tickets drop constraint tickets_status_check;
alter table public.tickets add constraint tickets_status_check
  check (status in ('open', 'forwarded', 'resolved', 'declined'));

-- One live change-of-supervisor query per group.
create unique index tickets_one_supervisor_change
  on public.tickets (group_id)
  where category = 'supervisor_change' and status in ('open', 'forwarded');

grant insert (category) on public.tickets to authenticated;

-- A change-of-supervisor query only makes sense once there is a supervisor.
create policy "supervisor change needs a supervisor" on public.tickets
  as restrictive for insert to authenticated
  with check (
    category = 'general'
    or exists (select 1 from public.groups where id = group_id and mentor_id is not null)
  );

-- --------------------------------------------------------- change history

create table public.supervisor_changes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_faculty_id text references public.faculty (id),
  to_faculty_id text not null references public.faculty (id),
  reason text not null,
  query_id uuid references public.tickets (id) on delete set null,
  changed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.supervisor_changes (group_id, created_at desc);

alter table public.supervisor_changes enable row level security;
revoke all on public.supervisor_changes from anon;
revoke insert, update, delete on public.supervisor_changes from authenticated;

create policy "group, old or new supervisor, or admin" on public.supervisor_changes
  for select to authenticated
  using (
    group_id = (select app_private.my_group_id())
    or from_faculty_id = (select app_private.my_faculty_id())
    or to_faculty_id = (select app_private.my_faculty_id())
    or (select app_private.is_admin())
  );

create or replace function app_private.admin_user_ids() returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(id), '{}') from public.profiles where role = 'admin' $$;

-- ---------------------------------------------------------- notifications

create or replace function app_private.on_ticket() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  student_user uuid;
  is_change boolean := new.category = 'supervisor_change';
begin
  select * into g from public.groups where id = new.group_id;
  student_user := (select user_id from public.students where id = new.student_id);

  if tg_op = 'INSERT' then
    perform app_private.notify(array[app_private.faculty_user_id(g.mentor_id)], 'ticket',
      case when is_change
        then 'Group ' || g.number || ' asks to change supervisor'
        else 'New query from group ' || g.number || ': ' || new.subject end,
      left(new.body, 140), '/faculty/queries');
    return new;
  end if;

  if is_change and new.status is distinct from old.status then
    if new.status = 'forwarded' then
      perform app_private.notify(app_private.admin_user_ids(), 'ticket',
        'Group ' || g.number || ': supervisor change approved by the supervisor',
        left(new.body, 140), '/admin/dashboard');
      perform app_private.notify(array[student_user], 'ticket',
        'Your supervisor approved the change request - it is now with the PBL office',
        coalesce(new.reply, ''), '/student/queries');
    elsif new.status = 'declined' then
      perform app_private.notify(array[student_user], 'ticket',
        'Your change-of-supervisor request was declined',
        coalesce(new.admin_reply, new.reply, ''), '/student/queries');
    end if;
    return new;
  end if;

  if new.reply is distinct from old.reply and new.reply is not null then
    perform app_private.notify(array[student_user], 'ticket',
      'Reply to your query: ' || new.subject, left(new.reply, 140), '/student/queries');
  end if;
  return new;
end $$;

create or replace function app_private.on_supervisor_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  old_name text := (select full_name from public.faculty where id = new.from_faculty_id);
  new_name text := (select full_name from public.faculty where id = new.to_faculty_id);
begin
  select * into g from public.groups where id = new.group_id;
  perform app_private.notify(app_private.group_user_ids(g.id), 'group',
    'Your supervisor is now ' || new_name, left(new.reason, 140), '/student/group');
  perform app_private.notify(array[app_private.faculty_user_id(new.from_faculty_id)], 'group',
    'Group ' || g.number || ' has moved to ' || new_name, left(new.reason, 140), '/faculty/dashboard');
  perform app_private.notify(array[app_private.faculty_user_id(new.to_faculty_id)], 'group',
    'Group ' || g.number || ' is now yours' || coalesce(' (from ' || old_name || ')', ''),
    left(new.reason, 140), '/faculty/groups/' || g.id);
  return new;
end $$;
create trigger supervisor_change_notify after insert on public.supervisor_changes
  for each row execute function app_private.on_supervisor_change();

-- Old notification links point at the renamed pages.
update public.notifications set href = replace(href, '/tickets', '/queries') where href like '%/tickets';

-- ---------------------------------------------------------------- actions

-- General queries only; change-of-supervisor queries have their own steps.
create or replace function public.reply_ticket(p_ticket uuid, p_reply text, p_resolve boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = p_ticket;
  if t.id is null or not (app_private.mentors_group(t.group_id) or app_private.is_admin()) then
    raise exception 'Only this group''s supervisor can reply.';
  end if;
  if t.category <> 'general' then
    raise exception 'Use approve or decline for a change-of-supervisor request.';
  end if;
  update public.tickets
  set reply = p_reply, replied_at = now(),
      status = case when p_resolve then 'resolved' else status end
  where id = p_ticket;
end $$;

-- Step 1: the current supervisor approves (forwards to the PBL office) or declines.
create or replace function public.review_supervisor_change(p_query uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = p_query for update;
  if t.id is null or t.category <> 'supervisor_change' or not app_private.mentors_group(t.group_id) then
    raise exception 'Only the group''s current supervisor can review this request.';
  end if;
  if t.status <> 'open' then raise exception 'This request has already been reviewed.'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception 'Say why you are declining, so the group understands.';
  end if;
  update public.tickets
  set status = case when p_approve then 'forwarded' else 'declined' end,
      reply = coalesce(nullif(trim(p_note), ''), 'Approved - forwarded to the PBL office.'),
      replied_at = now(),
      forwarded_at = case when p_approve then now() else null end
  where id = t.id;
end $$;

-- Step 2 (or a direct change): the PBL office moves the group.
create or replace function public.change_supervisor(
  p_group uuid, p_faculty text, p_reason text, p_query uuid default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  f public.faculty;
  t public.tickets;
  why text := coalesce(trim(p_reason), '');
begin
  if not app_private.is_admin() then raise exception 'Only the PBL office can change a supervisor.'; end if;
  if why = '' then raise exception 'Give a reason for the change.'; end if;

  select * into g from public.groups where id = p_group for update;
  if g.id is null then raise exception 'Group not found.'; end if;
  select * into f from public.faculty where id = p_faculty;
  if f.id is null or f.user_id is null then
    raise exception 'Pick a teacher who has a portal account.';
  end if;
  if g.mentor_id = f.id then raise exception '% already supervises this group.', f.full_name; end if;
  if (select count(*) from public.groups where mentor_id = f.id) >= f.max_groups then
    raise exception '% already supervises the maximum of % groups.', f.full_name, f.max_groups;
  end if;

  if p_query is not null then
    select * into t from public.tickets where id = p_query for update;
    if t.id is null or t.group_id <> g.id or t.category <> 'supervisor_change' or t.status <> 'forwarded' then
      raise exception 'That request is not waiting for the PBL office.';
    end if;
    update public.tickets
    set status = 'resolved', admin_reply = 'Supervisor changed to ' || f.full_name || '. ' || why,
        admin_replied_at = now()
    where id = t.id;
  end if;

  update public.groups set mentor_id = f.id, assigned_at = now() where id = g.id;
  -- A group that gets a supervisor this way no longer needs its open mentor requests.
  update public.mentor_requests set status = 'closed', decided_at = now()
    where group_id = g.id and app_private.is_open_request(status);
  insert into public.supervisor_changes (group_id, from_faculty_id, to_faculty_id, reason, query_id, changed_by)
  values (g.id, g.mentor_id, f.id, why, p_query, auth.uid());
end $$;

-- The PBL office turns down a forwarded request.
create or replace function public.decline_supervisor_change(p_query uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare t public.tickets;
begin
  if not app_private.is_admin() then raise exception 'Only the PBL office can do this.'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Say why the request is declined.'; end if;
  select * into t from public.tickets where id = p_query for update;
  if t.id is null or t.category <> 'supervisor_change' or t.status <> 'forwarded' then
    raise exception 'That request is not waiting for the PBL office.';
  end if;
  update public.tickets
  set status = 'declined', admin_reply = trim(p_note), admin_replied_at = now()
  where id = t.id;
end $$;

revoke execute on function app_private.admin_user_ids from public, anon;
grant execute on function app_private.admin_user_ids to authenticated;
revoke execute on function public.review_supervisor_change, public.change_supervisor,
  public.decline_supervisor_change from public, anon;
grant execute on function public.review_supervisor_change, public.change_supervisor,
  public.decline_supervisor_change to authenticated;
