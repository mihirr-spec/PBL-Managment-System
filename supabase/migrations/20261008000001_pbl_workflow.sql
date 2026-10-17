-- PBL workflow: groups, mentor requests, weekly reports, grades, tickets,
-- announcements with files, and notifications that follow every action.
-- Replaces the earlier project/team/deadline model.

-- ------------------------------------------------------------ retire the old model
-- The earlier project/team/deadline tables are moved out of the API into a
-- `legacy` schema rather than dropped, so nothing is lost. students keeps
-- its old project_id / coordinator_id columns; the app no longer reads them.

create schema if not exists legacy;
revoke all on schema legacy from public, anon, authenticated;
alter table public.deadlines set schema legacy;
alter table public.team_members set schema legacy;
alter table public.teams set schema legacy;
alter table public.announcements set schema legacy;
alter table public.projects set schema legacy;

-- --------------------------------------------------------------- faculty directory

alter table public.faculty
  alter column faculty_code set default '',
  add column if not exists expertise text not null default '',
  add column if not exists profile_url text,
  add column if not exists muj_id text unique,
  -- 'muj' = scraped from the university site, 'demo' = seeded demo account
  add column if not exists source text not null default 'demo',
  add column if not exists max_groups int not null default 7;

create index if not exists faculty_department_idx on public.faculty (department);

-- ------------------------------------------------------------------- groups

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  number serial unique,
  name text not null,
  project_title text not null,
  project_idea text not null default '',
  domain text not null default '',
  progress int not null default 0 check (progress between 0 and 100),
  leader_student_id text not null references public.students (id),
  mentor_id text references public.faculty (id),
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  -- unique: a student belongs to at most one group
  student_id text not null unique references public.students (id) on delete cascade,
  team_role text not null default '',
  joined_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create table public.mentor_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  faculty_id text not null references public.faculty (id),
  message text not null default '',
  -- closed = the group was assigned elsewhere before this teacher decided
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'closed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index mentor_requests_one_pending
  on public.mentor_requests (group_id, faculty_id) where status = 'pending';

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  week int not null check (week between 1 and 30),
  summary text not null default '',
  file_path text,
  file_name text,
  submitted_by text references public.students (id),
  submitted_at timestamptz not null default now(),
  grade numeric(4, 1) check (grade between 0 and 10),
  feedback text,
  graded_at timestamptz,
  unique (group_id, week)
);

create table public.student_grades (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  title text not null,
  score numeric(5, 1) not null,
  max_score numeric(5, 1) not null default 10,
  improvements text not null default '',
  graded_by text references public.faculty (id),
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  student_id text not null references public.students (id),
  subject text not null,
  body text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  reply text,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  -- 'all' = every student (admin); 'mentor_groups' = the poster's own groups
  scope text not null check (scope in ('all', 'mentor_groups')),
  faculty_id text references public.faculty (id),
  posted_by uuid references auth.users (id),
  posted_by_name text not null,
  posted_by_role text not null,
  attachment_path text,
  attachment_name text,
  created_at timestamptz not null default now()
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement', 'report', 'grade', 'ticket', 'request', 'group', 'profile', 'deadline', 'submission', 'feedback'));

create index on public.group_members (group_id);
create index on public.groups (mentor_id);
create index on public.mentor_requests (faculty_id, status);
create index on public.weekly_reports (group_id, week);
create index on public.student_grades (student_id);
create index on public.tickets (group_id, status);
create index on public.announcements (created_at desc);

-- ---------------------------------------------------------- access helpers

create or replace function app_private.my_group_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select gm.group_id from public.group_members gm
  join public.students s on s.id = gm.student_id
  where s.user_id = auth.uid()
$$;

create or replace function app_private.my_faculty_id() returns text
language sql stable security definer set search_path = ''
as $$ select id from public.faculty where user_id = auth.uid() $$;

create or replace function app_private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

create or replace function app_private.mentors_group(g uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.groups
    where id = g and mentor_id is not null
      and mentor_id = (select id from public.faculty where user_id = auth.uid())
  )
$$;

revoke execute on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

-- ---------------------------------------------------------------- policies

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.mentor_requests enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.student_grades enable row level security;
alter table public.tickets enable row level security;
alter table public.announcements enable row level security;

revoke all on public.groups, public.group_members, public.mentor_requests, public.weekly_reports,
  public.student_grades, public.tickets, public.announcements from anon;
revoke insert, update, delete on public.groups, public.group_members, public.mentor_requests,
  public.weekly_reports, public.student_grades, public.tickets, public.announcements from authenticated;

-- Classmates in the same group can see each other's records.
create policy "group mates" on public.students
  for select to authenticated
  using (id in (select student_id from public.group_members where group_id = (select app_private.my_group_id())));

create policy "own group, or staff" on public.groups
  for select to authenticated
  using (id = (select app_private.my_group_id()) or (select app_private.is_staff()));

create policy "own group members, or staff" on public.group_members
  for select to authenticated
  using (group_id = (select app_private.my_group_id()) or (select app_private.is_staff()));

create policy "own group's requests, requests to me, or admin" on public.mentor_requests
  for select to authenticated
  using (
    group_id = (select app_private.my_group_id())
    or faculty_id = (select app_private.my_faculty_id())
    or (select app_private.is_admin())
  );

create policy "own group, mentor, or admin" on public.weekly_reports
  for select to authenticated
  using (
    group_id = (select app_private.my_group_id())
    or (select app_private.mentors_group(group_id))
    or (select app_private.is_admin())
  );
create policy "submit own group's report" on public.weekly_reports
  for insert to authenticated
  with check (group_id = (select app_private.my_group_id()) and grade is null);
create policy "resubmit until graded" on public.weekly_reports
  for update to authenticated
  using (group_id = (select app_private.my_group_id()) and grade is null)
  with check (group_id = (select app_private.my_group_id()) and grade is null);
grant insert (group_id, week, summary, file_path, file_name, submitted_by) on public.weekly_reports to authenticated;
grant update (summary, file_path, file_name, submitted_by, submitted_at) on public.weekly_reports to authenticated;

create policy "own grades, or staff" on public.student_grades
  for select to authenticated
  using (student_id = (select app_private.my_student_id()) or (select app_private.is_staff()));

create policy "own group, mentor, or admin" on public.tickets
  for select to authenticated
  using (
    group_id = (select app_private.my_group_id())
    or (select app_private.mentors_group(group_id))
    or (select app_private.is_admin())
  );
create policy "raise ticket for own group" on public.tickets
  for insert to authenticated
  with check (
    group_id = (select app_private.my_group_id())
    and student_id = (select app_private.my_student_id())
  );
grant insert (group_id, student_id, subject, body) on public.tickets to authenticated;

create policy "students see theirs, staff see all" on public.announcements
  for select to authenticated
  using (
    scope = 'all'
    or (select app_private.is_staff())
    or faculty_id = (select mentor_id from public.groups where id = (select app_private.my_group_id()))
  );
create policy "admin posts to all, teachers to their groups" on public.announcements
  for insert to authenticated
  with check (
    posted_by = (select auth.uid())
    and (
      (scope = 'all' and (select app_private.is_admin()))
      or (scope = 'mentor_groups' and faculty_id = (select app_private.my_faculty_id()))
    )
  );
grant insert (title, body, scope, faculty_id, posted_by, posted_by_name, posted_by_role, attachment_path, attachment_name)
  on public.announcements to authenticated;

-- ---------------------------------------------------- notifications fan-out

create or replace function app_private.notify(p_users uuid[], p_kind text, p_title text, p_body text, p_href text)
returns void language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select distinct u, p_kind, p_title, coalesce(p_body, ''), p_href
  from unnest(p_users) as u where u is not null
$$;

create or replace function app_private.group_user_ids(g uuid) returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(s.user_id) filter (where s.user_id is not null), '{}')
  from public.group_members gm join public.students s on s.id = gm.student_id
  where gm.group_id = g
$$;

create or replace function app_private.faculty_user_id(f text) returns uuid
language sql stable security definer set search_path = ''
as $$ select user_id from public.faculty where id = f $$;

create or replace function app_private.on_announcement() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare targets uuid[];
begin
  if new.scope = 'all' then
    select coalesce(array_agg(user_id), '{}') into targets from public.students where user_id is not null;
  else
    select coalesce(array_agg(s.user_id), '{}') into targets
    from public.groups g
    join public.group_members gm on gm.group_id = g.id
    join public.students s on s.id = gm.student_id
    where g.mentor_id = new.faculty_id and s.user_id is not null;
  end if;
  perform app_private.notify(targets, 'announcement',
    'New from ' || new.posted_by_name || ': ' || new.title,
    case when new.attachment_name is not null then 'Includes a file: ' || new.attachment_name else left(new.body, 140) end,
    '/student/notifications');
  return new;
end $$;
create trigger announcement_notify after insert on public.announcements
  for each row execute function app_private.on_announcement();

create or replace function app_private.on_report() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare g public.groups;
begin
  select * into g from public.groups where id = new.group_id;
  if tg_op = 'INSERT' then
    perform app_private.notify(array[app_private.faculty_user_id(g.mentor_id)], 'report',
      'Group ' || g.number || ' submitted week ' || new.week || ' report', g.project_title,
      '/faculty/groups/' || g.id);
  elsif new.grade is not null and old.grade is null then
    perform app_private.notify(app_private.group_user_ids(g.id), 'grade',
      'Week ' || new.week || ' report graded: ' || new.grade || '/10', coalesce(new.feedback, ''),
      '/student/reports');
  end if;
  return new;
end $$;
create trigger report_notify after insert or update on public.weekly_reports
  for each row execute function app_private.on_report();

create or replace function app_private.on_grade() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_private.notify(
    array[(select user_id from public.students where id = new.student_id)], 'grade',
    'New grade: ' || new.title || ' - ' || new.score || '/' || new.max_score, new.improvements,
    '/student/grades');
  return new;
end $$;
create trigger grade_notify after insert on public.student_grades
  for each row execute function app_private.on_grade();

create or replace function app_private.on_ticket() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare g public.groups;
begin
  select * into g from public.groups where id = new.group_id;
  if tg_op = 'INSERT' then
    perform app_private.notify(array[app_private.faculty_user_id(g.mentor_id)], 'ticket',
      'New ticket from group ' || g.number || ': ' || new.subject, left(new.body, 140), '/faculty/tickets');
  elsif new.reply is distinct from old.reply and new.reply is not null then
    perform app_private.notify(
      array[(select user_id from public.students where id = new.student_id)], 'ticket',
      'Reply to your ticket: ' || new.subject, left(new.reply, 140), '/student/tickets');
  end if;
  return new;
end $$;
create trigger ticket_notify after insert or update on public.tickets
  for each row execute function app_private.on_ticket();

create or replace function app_private.on_request() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare g public.groups; f public.faculty;
begin
  select * into g from public.groups where id = new.group_id;
  select * into f from public.faculty where id = new.faculty_id;
  if tg_op = 'INSERT' then
    perform app_private.notify(array[f.user_id], 'request',
      'Group ' || g.number || ' requested you as mentor', g.project_title, '/faculty/requests');
  elsif new.status in ('approved', 'rejected') and old.status = 'pending' then
    perform app_private.notify(app_private.group_user_ids(g.id), 'request',
      f.full_name || case when new.status = 'approved' then ' accepted' else ' declined' end || ' your mentor request',
      g.project_title, '/student/group');
  end if;
  return new;
end $$;
create trigger request_notify after insert or update on public.mentor_requests
  for each row execute function app_private.on_request();

-- ------------------------------------------------------------ actions (RPC)
-- Each checks who is calling, so the rules hold whatever the client sends.

create or replace function public.create_group(
  p_name text, p_project_title text, p_project_idea text, p_domain text, p_member_regs text[]
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me text := app_private.my_student_id();
  gid uuid;
  reg text;
  sid text;
begin
  if me is null then raise exception 'Only students can create groups.'; end if;
  if exists (select 1 from public.group_members where student_id = me) then
    raise exception 'You are already in a group.';
  end if;
  if coalesce(array_length(p_member_regs, 1), 0) > 4 then
    raise exception 'A group can have at most 5 students including you.';
  end if;

  insert into public.groups (name, project_title, project_idea, domain, leader_student_id)
  values (trim(p_name), trim(p_project_title), coalesce(p_project_idea, ''), coalesce(p_domain, ''), me)
  returning id into gid;
  insert into public.group_members (group_id, student_id, team_role) values (gid, me, 'Team Lead');

  foreach reg in array coalesce(p_member_regs, '{}') loop
    if trim(reg) = '' then continue; end if;
    select id into sid from public.students where upper(registration_number) = upper(trim(reg));
    if sid is null then raise exception 'No student with registration number %.', trim(reg); end if;
    if exists (select 1 from public.group_members where student_id = sid) then
      raise exception 'Student % is already in another group.', trim(reg);
    end if;
    insert into public.group_members (group_id, student_id) values (gid, sid);
  end loop;
  return gid;
end $$;

create or replace function public.request_mentor(p_faculty_id text, p_message text) returns void
language plpgsql security definer set search_path = ''
as $$
declare gid uuid := app_private.my_group_id();
begin
  if gid is null then raise exception 'Form or join a group first.'; end if;
  if (select mentor_id from public.groups where id = gid) is not null then
    raise exception 'Your group already has a mentor.';
  end if;
  if (select count(*) from public.mentor_requests where group_id = gid and status = 'pending') >= 3 then
    raise exception 'You can have at most 3 pending requests at a time.';
  end if;
  insert into public.mentor_requests (group_id, faculty_id, message)
  values (gid, p_faculty_id, coalesce(p_message, ''));
exception when unique_violation then
  raise exception 'You have already requested this teacher.';
end $$;

-- Returns 'approved', 'rejected', 'already_assigned' or 'full'.
create or replace function public.decide_mentor_request(p_request uuid, p_approve boolean) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me text := app_private.my_faculty_id();
  r public.mentor_requests;
  g public.groups;
begin
  select * into r from public.mentor_requests where id = p_request for update;
  if r.id is null or r.faculty_id is distinct from me then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then return r.status; end if;

  if not p_approve then
    update public.mentor_requests set status = 'rejected', decided_at = now() where id = r.id;
    return 'rejected';
  end if;

  -- Lock the group so two teachers approving at once cannot both win.
  select * into g from public.groups where id = r.group_id for update;
  if g.mentor_id is not null then
    update public.mentor_requests set status = 'closed', decided_at = now() where id = r.id;
    return 'already_assigned';
  end if;
  if (select count(*) from public.groups where mentor_id = me)
     >= (select max_groups from public.faculty where id = me) then
    return 'full';
  end if;

  update public.groups set mentor_id = me, assigned_at = now() where id = g.id;
  update public.mentor_requests set status = 'approved', decided_at = now() where id = r.id;
  update public.mentor_requests set status = 'closed', decided_at = now()
    where group_id = g.id and status = 'pending' and id <> r.id;
  return 'approved';
end $$;

-- Admin: give every group without a mentor a random teacher who uses the
-- portal and still has room. Returns how many groups were assigned.
create or replace function public.auto_allocate_mentors() returns int
language plpgsql security definer set search_path = ''
as $$
declare
  g record;
  pick text;
  assigned int := 0;
begin
  if not app_private.is_admin() then raise exception 'Administrators only.'; end if;
  for g in select id from public.groups where mentor_id is null order by created_at for update loop
    select f.id into pick from public.faculty f
    where f.user_id is not null
      and (select count(*) from public.groups x where x.mentor_id = f.id) < f.max_groups
    order by random() limit 1;
    exit when pick is null;
    update public.groups set mentor_id = pick, assigned_at = now() where id = g.id;
    update public.mentor_requests set status = 'closed', decided_at = now()
      where group_id = g.id and status = 'pending';
    perform app_private.notify(app_private.group_user_ids(g.id), 'group',
      'A mentor has been assigned to your group',
      (select full_name from public.faculty where id = pick), '/student/group');
    assigned := assigned + 1;
  end loop;
  return assigned;
end $$;

create or replace function public.grade_report(p_report uuid, p_grade numeric, p_feedback text) returns void
language plpgsql security definer set search_path = ''
as $$
declare gid uuid;
begin
  select group_id into gid from public.weekly_reports where id = p_report;
  if gid is null or not (app_private.mentors_group(gid) or app_private.is_admin()) then
    raise exception 'Only this group''s mentor can grade its reports.';
  end if;
  update public.weekly_reports
  set grade = p_grade, feedback = coalesce(p_feedback, ''), graded_at = now()
  where id = p_report;
end $$;

create or replace function public.grade_student(
  p_student text, p_title text, p_score numeric, p_max numeric, p_improvements text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare gid uuid;
begin
  select group_id into gid from public.group_members where student_id = p_student;
  if gid is null or not (app_private.mentors_group(gid) or app_private.is_admin()) then
    raise exception 'Only this student''s mentor can grade them.';
  end if;
  if p_score < 0 or p_score > p_max then raise exception 'Score must be between 0 and %.', p_max; end if;
  insert into public.student_grades (student_id, group_id, title, score, max_score, improvements, graded_by)
  values (p_student, gid, trim(p_title), p_score, p_max, coalesce(p_improvements, ''), app_private.my_faculty_id());
end $$;

create or replace function public.reply_ticket(p_ticket uuid, p_reply text, p_resolve boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare gid uuid;
begin
  select group_id into gid from public.tickets where id = p_ticket;
  if gid is null or not (app_private.mentors_group(gid) or app_private.is_admin()) then
    raise exception 'Only this group''s mentor can reply.';
  end if;
  update public.tickets
  set reply = p_reply, replied_at = now(),
      status = case when p_resolve then 'resolved' else status end
  where id = p_ticket;
end $$;

revoke execute on function public.create_group, public.request_mentor, public.decide_mentor_request,
  public.auto_allocate_mentors, public.grade_report, public.grade_student, public.reply_ticket
  from public, anon;
grant execute on function public.create_group, public.request_mentor, public.decide_mentor_request,
  public.auto_allocate_mentors, public.grade_report, public.grade_student, public.reply_ticket
  to authenticated;

-- ----------------------------------------------------------------- storage

-- Weekly reports: submissions/<group id>/week-<n>/<file>
create policy "group uploads reports" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select app_private.my_group_id())::text
  );
create policy "group, mentor and admin read reports" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[1] = (select app_private.my_group_id())::text
      or (select app_private.is_staff())
    )
  );

-- Announcement files: readable by every signed-in user, posted by staff.
insert into storage.buckets (id, name, public, file_size_limit)
values ('announcements', 'announcements', false, 26214400)
on conflict (id) do nothing;

create policy "staff upload announcement files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'announcements' and (select app_private.is_staff()));
create policy "signed-in users read announcement files" on storage.objects
  for select to authenticated
  using (bucket_id = 'announcements');
