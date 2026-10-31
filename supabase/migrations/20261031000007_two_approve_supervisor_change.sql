-- Two-supervisor change of supervisor.
--
-- A team lead asks to move from the current supervisor (A) to a specific
-- supervisor (B). Both A and B see the request and each approves or declines.
--   * If B still has room (fewer than B's max_groups), once both approve the
--     move happens on its own; the administrator is informed, not asked.
--   * If B is already at capacity, both approvals send it to the administrator,
--     who may approve B taking the group beyond the cap. Only then does the
--     move happen.
-- Either supervisor declining closes the request, with the reason.
-- The move itself is the same as a PBL-office change, recorded and notified.

alter table public.tickets
  add column target_faculty_id text references public.faculty (id) on delete set null,
  add column current_note text,
  add column current_approved_at timestamptz,
  add column target_note text,
  add column target_approved_at timestamptz,
  add column needs_admin boolean not null default false;

/** Performs the move: reassigns the group, closes its open mentor requests,
 *  records the change (which fires the notification trigger). */
create or replace function app_private.apply_supervisor_change(
  p_group uuid, p_to text, p_reason text, p_query uuid, p_changed_by uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare g public.groups;
begin
  select * into g from public.groups where id = p_group for update;
  if g.id is null then raise exception 'Group not found.'; end if;
  if g.mentor_id = p_to then raise exception 'That supervisor already leads this group.'; end if;

  update public.groups set mentor_id = p_to, assigned_at = now() where id = g.id;
  update public.mentor_requests set status = 'closed', decided_at = now()
    where group_id = g.id and app_private.is_open_request(status);
  insert into public.supervisor_changes (group_id, from_faculty_id, to_faculty_id, reason, query_id, changed_by)
  values (g.id, g.mentor_id, p_to, p_reason, p_query, p_changed_by);
end $$;

revoke execute on function app_private.apply_supervisor_change(uuid, text, text, uuid, uuid) from public, anon, authenticated;

/** The team lead raises the request, naming the supervisor they want. */
create or replace function public.raise_supervisor_change(
  p_target text, p_reason text, p_files jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me text := app_private.my_student_id();
  gid uuid := app_private.my_group_id();
  t uuid;
  target public.faculty;
  current_count int;
  f jsonb;
begin
  if me is null then raise exception 'Sign in as a student first.'; end if;
  if gid is null then raise exception 'Form or join a group first.'; end if;
  if (select leader_student_id from public.groups where id = gid) is distinct from me then
    raise exception 'Only the team lead can raise a supervisor change.';
  end if;
  if (select mentor_id from public.groups where id = gid) is null then
    raise exception 'Your group has no supervisor yet - request one instead.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Say why you want to change supervisor.';
  end if;
  select * into target from public.faculty where id = p_target;
  if target.id is null or target.user_id is null then
    raise exception 'Pick a supervisor who has a portal account.';
  end if;
  if target.id = (select mentor_id from public.groups where id = gid) then
    raise exception 'You already have that supervisor.';
  end if;
  if exists (select 1 from public.tickets
             where group_id = gid and category = 'supervisor_change' and status in ('open', 'forwarded')) then
    raise exception 'This group already has a supervisor change in progress.';
  end if;

  current_count := (select count(*) from public.groups where mentor_id = target.id);
  insert into public.tickets (group_id, student_id, subject, body, category, target_faculty_id, needs_admin)
  values (gid, me, 'Change of supervisor', trim(p_reason), 'supervisor_change', target.id, current_count >= target.max_groups)
  returning id into t;

  if p_files is not null and jsonb_array_length(p_files) > 0 then
    for f in select * from jsonb_array_elements(p_files)
    loop
      insert into public.ticket_attachments (ticket_id, file_path, file_name)
      values (t, f ->> 'path', f ->> 'name');
    end loop;
  end if;

  -- The request goes to both supervisors, who each approve or decline.
  perform app_private.notify(
    coalesce(array[app_private.faculty_user_id((select mentor_id from public.groups where id = gid)),
                   app_private.faculty_user_id(target.id)], '{}'),
    'ticket',
    'Group ' || (select number from public.groups where id = gid) || ' asks to move its supervisor',
    'It would like to move to ' || target.full_name || '. Approve or decline - the other supervisor is asked too.',
    '/faculty/queries');
  return t;
end $$;

revoke execute on function public.raise_supervisor_change(text, text, jsonb) from public, anon;
grant execute on function public.raise_supervisor_change(text, text, jsonb) to authenticated;

/** A, the current supervisor, or B, the target: approve the request. */
create or replace function public.approve_supervisor_change(p_ticket uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tickets;
  g public.groups;
  am_current boolean;
  done boolean;
  remaining uuid;
  target_name text;
  at_capacity boolean;
begin
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or t.category <> 'supervisor_change' then
    raise exception 'No such supervisor-change request.';
  end if;
  if t.status <> 'open' then raise exception 'This request is no longer open for approval.'; end if;

  am_current := app_private.mentors_group(t.group_id);
  if not am_current and t.target_faculty_id is distinct from app_private.my_faculty_id() then
    raise exception 'Only the current or the target supervisor can approve this.';
  end if;
  if (am_current and t.current_approved_at is not null) or (not am_current and t.target_approved_at is not null) then
    raise exception 'You have already approved this request.';
  end if;

  -- Record this side's approval; the other side's pre-update value says whether
  -- the pair is now complete.
  if am_current then
    update public.tickets set current_approved_at = now(), current_note = nullif(trim(p_note), '')
    where id = t.id;
    done := t.target_approved_at is not null;
    remaining := app_private.faculty_user_id(t.target_faculty_id);
  else
    update public.tickets set target_approved_at = now(), target_note = nullif(trim(p_note), '')
    where id = t.id;
    done := t.current_approved_at is not null;
    remaining := app_private.faculty_user_id((select mentor_id from public.groups where id = t.group_id));
  end if;

  select * into g from public.groups where id = t.group_id;

  if not done then
    perform app_private.notify(
      coalesce(array[remaining], '{}'),
      'ticket',
      'Group ' || g.number || ': one supervisor approved the move',
      'The other supervisor has approved. Approve or decline to complete it.',
      '/faculty/queries');
    return;
  end if;

  -- Both approved. Capacity is checked now, not when the request was raised.
  target_name := (select full_name from public.faculty where id = t.target_faculty_id);
  at_capacity := (select count(*) from public.groups where mentor_id = t.target_faculty_id)
                 >= (select max_groups from public.faculty where id = t.target_faculty_id);

  if at_capacity then
    update public.tickets set status = 'forwarded', forwarded_at = now(), needs_admin = true where id = t.id;
    perform app_private.notify(app_private.admin_user_ids(), 'ticket',
      'Supervisor change needs your approval',
      'Group ' || g.number || ': both supervisors agreed to move it to ' || target_name
        || ', who is already at capacity. Approve to let them take it on, or decline.',
      '/admin/dashboard');
    perform app_private.notify(app_private.group_user_ids(g.id), 'ticket',
      'Both supervisors approved your change',
      target_name || ' is at capacity, so the PBL office makes the final call.',
      '/student/queries');
  else
    update public.tickets set status = 'resolved', needs_admin = false,
      admin_reply = 'Supervisor changed automatically - both supervisors approved.',
      admin_replied_at = now()
    where id = t.id;
    perform app_private.apply_supervisor_change(g.id, t.target_faculty_id, t.body, t.id, null);
    perform app_private.notify(app_private.admin_user_ids(), 'ticket',
      'Supervisor change auto-approved',
      'Group ' || g.number || ' moved to ' || target_name || ' - both supervisors approved, no action needed.',
      '/admin/dashboard');
  end if;
end $$;

revoke execute on function public.approve_supervisor_change(uuid, text) from public, anon;
grant execute on function public.approve_supervisor_change(uuid, text) to authenticated;

/** The administrator clears a request that both supervisors approved while
 *  the target was at capacity, letting the target take one more group. */
create or replace function public.admin_approve_supervisor_change(p_ticket uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tickets;
begin
  if not app_private.is_admin() then raise exception 'Only the administrator can do this.'; end if;
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or t.category <> 'supervisor_change' or t.status <> 'forwarded' then
    raise exception 'That request is not waiting for the administrator.';
  end if;

  update public.tickets
  set status = 'resolved',
      admin_reply = 'The PBL office approved the move, letting the new supervisor go over their usual limit.',
      admin_replied_at = now()
  where id = t.id;

  perform app_private.apply_supervisor_change(t.group_id, t.target_faculty_id, t.body, t.id, auth.uid());
end $$;

revoke execute on function public.admin_approve_supervisor_change(uuid) from public, anon;
grant execute on function public.admin_approve_supervisor_change(uuid) to authenticated;

/** The administrator declines a forwarded (at-capacity) request. */
create or replace function public.admin_decline_supervisor_change(p_ticket uuid, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tickets;
  msg text;
begin
  if not app_private.is_admin() then raise exception 'Only the PBL office can do this.'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Say why the request is declined.'; end if;
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or t.category <> 'supervisor_change' or t.status <> 'forwarded' then
    raise exception 'That request is not waiting for the PBL office.';
  end if;
  msg := 'The PBL office declined it: ' || trim(p_note);
  update public.tickets
  set status = 'declined', admin_reply = msg, admin_replied_at = now()
  where id = t.id;
  perform app_private.notify(app_private.group_user_ids(t.group_id), 'ticket',
    'Your supervisor change was declined', msg, '/student/queries');
  perform app_private.notify(
    coalesce(array[app_private.faculty_user_id((select mentor_id from public.groups where id = t.group_id)),
                   app_private.faculty_user_id(t.target_faculty_id)], '{}'),
    'ticket', 'A supervisor change was declined', msg, '/faculty/queries');
end $$;

revoke execute on function public.admin_decline_supervisor_change(uuid, text) from public, anon;
grant execute on function public.admin_decline_supervisor_change(uuid, text) to authenticated;

-- The old decline function took p_query; the new one takes p_ticket, which
-- `create or replace` cannot rename, so drop and recreate.
drop function if exists public.decline_supervisor_change(uuid, text);

/** A or B declines the request, with a reason; it closes for everyone. */
create function public.decline_supervisor_change(p_ticket uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tickets;
  g public.groups;
  am_current boolean;
  msg text;
begin
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or t.category <> 'supervisor_change' then
    raise exception 'No such supervisor-change request.';
  end if;
  if t.status <> 'open' then raise exception 'This request is no longer open for approval.'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Say why you are declining.'; end if;

  am_current := app_private.mentors_group(t.group_id);
  if not am_current and t.target_faculty_id is distinct from app_private.my_faculty_id() then
    raise exception 'Only the current or the target supervisor can decline this.';
  end if;

  select * into g from public.groups where id = t.group_id;
  msg := case when am_current then 'The current supervisor declined: ' else 'The requested supervisor declined: ' end
         || trim(p_note);
  if am_current then
    update public.tickets set status = 'declined', admin_reply = msg, admin_replied_at = now(),
      current_note = trim(p_note) where id = t.id;
  else
    update public.tickets set status = 'declined', admin_reply = msg, admin_replied_at = now(),
      target_note = trim(p_note) where id = t.id;
  end if;

  perform app_private.notify(app_private.group_user_ids(g.id), 'ticket',
    'Your supervisor change was declined', msg, '/student/queries');
  perform app_private.notify(
    coalesce(array[case when am_current then app_private.faculty_user_id(t.target_faculty_id)
                        else app_private.faculty_user_id(g.mentor_id) end], '{}'),
    'ticket', 'Group ' || g.number || ': supervisor change declined', msg, '/faculty/queries');
end $$;

revoke execute on function public.decline_supervisor_change(uuid, text) from public, anon;
grant execute on function public.decline_supervisor_change(uuid, text) to authenticated;

-- The one-step review (current supervisor forwards to the PBL office) is replaced.
drop function if exists public.review_supervisor_change(uuid, boolean, text);

-- The requested supervisor (B) must see the request and its files to answer it.
drop policy if exists "own group, mentor, or admin" on public.tickets;
create policy "own group, mentor, target, or admin" on public.tickets for select to authenticated
using (
  group_id = (select app_private.my_group_id())
  or (select app_private.mentors_group(tickets.group_id))
  or (target_faculty_id is not null and target_faculty_id = (select app_private.my_faculty_id()))
  or (select app_private.is_admin())
);

drop policy if exists "attachments: the ticket's group and staff" on public.ticket_attachments;
create policy "attachments: the ticket's group and staff" on public.ticket_attachments for select to authenticated
using (
  exists (select 1 from public.tickets t join public.group_members gm on gm.group_id = t.group_id
          where t.id = ticket_attachments.ticket_id and gm.student_id = app_private.my_student_id())
  or (app_private.is_staff() and exists (
        select 1 from public.tickets t
        where t.id = ticket_attachments.ticket_id
          and (app_private.mentors_group(t.group_id) or app_private.is_admin()
               or t.target_faculty_id = app_private.my_faculty_id())))
);

/** The administrator clears a request that both supervisors approved while
 *  the target was at capacity, letting the target take one more group. Both
 *  supervisors hear it was the PBL office's call (the move itself is also
 *  announced by the supervisor_changes trigger). */
create or replace function public.admin_approve_supervisor_change(p_ticket uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tickets;
  g public.groups;
  from_id text;
  target_name text;
begin
  if not app_private.is_admin() then raise exception 'Only the administrator can do this.'; end if;
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or t.category <> 'supervisor_change' or t.status <> 'forwarded' then
    raise exception 'That request is not waiting for the administrator.';
  end if;
  select * into g from public.groups where id = t.group_id;
  from_id := g.mentor_id;
  target_name := (select full_name from public.faculty where id = t.target_faculty_id);

  update public.tickets
  set status = 'resolved',
      admin_reply = 'The PBL office approved the move, letting ' || target_name || ' go over their usual limit.',
      admin_replied_at = now()
  where id = t.id;

  perform app_private.apply_supervisor_change(t.group_id, t.target_faculty_id, t.body, t.id, auth.uid());

  perform app_private.notify(coalesce(array[app_private.faculty_user_id(from_id)], '{}'), 'ticket',
    'PBL office approved: Group ' || g.number || ' moves to ' || target_name,
    'The group leaves your list and joins ' || target_name || '.', '/faculty/dashboard');
  perform app_private.notify(coalesce(array[app_private.faculty_user_id(t.target_faculty_id)], '{}'), 'ticket',
    'PBL office approved: Group ' || g.number || ' joins you',
    'You may supervise more than your usual limit of groups for this one.', '/faculty/groups/' || g.id);
end $$;

revoke execute on function public.admin_approve_supervisor_change(uuid) from public, anon;
grant execute on function public.admin_approve_supervisor_change(uuid) to authenticated;

/** Random allotment: each group without a supervisor gets a random portal
 *  supervisor under their limit; the students and the supervisor are told. */
create or replace function public.auto_allocate_mentors() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  g record;
  pick text;
  assigned int := 0;
begin
  if not app_private.is_admin() then raise exception 'Administrators only.'; end if;
  for g in select id, number from public.groups where mentor_id is null order by created_at for update loop
    select f.id into pick from public.faculty f
    where f.user_id is not null
      and (select count(*) from public.groups x where x.mentor_id = f.id) < f.max_groups
    order by random() limit 1;
    exit when pick is null;
    update public.groups set mentor_id = pick, assigned_at = now() where id = g.id;
    update public.mentor_requests set status = 'closed', decided_at = now()
      where group_id = g.id and app_private.is_open_request(status);
    perform app_private.notify(app_private.group_user_ids(g.id), 'group',
      'A mentor has been assigned to your group',
      (select full_name from public.faculty where id = pick), '/student/group');
    perform app_private.notify(coalesce(array[app_private.faculty_user_id(pick)], '{}'), 'group',
      'Group ' || g.number || ' has been allotted to you',
      'The PBL office allotted this group to you at random.', '/faculty/groups/' || g.id);
    assigned := assigned + 1;
  end loop;
  return assigned;
end $$;

/** Query notifications. Change-of-supervisor requests are announced by their
 *  own functions above, so this trigger only covers general queries. */
create or replace function app_private.on_ticket() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  student_user uuid;
begin
  if new.category = 'supervisor_change' then return new; end if;
  select * into g from public.groups where id = new.group_id;
  student_user := (select user_id from public.students where id = new.student_id);

  if tg_op = 'INSERT' then
    perform app_private.notify(array[app_private.faculty_user_id(g.mentor_id)], 'ticket',
      'New query from group ' || g.number || ': ' || new.subject,
      left(new.body, 140), '/faculty/queries');
    return new;
  end if;

  if new.reply is distinct from old.reply and new.reply is not null then
    perform app_private.notify(array[student_user], 'ticket',
      'Reply to your query: ' || new.subject, left(new.reply, 140), '/student/queries');
  end if;
  return new;
end $$;
