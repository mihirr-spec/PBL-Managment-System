-- PBL Portal - core schema and row-level security.
--
-- Record ids are readable text keys (s-2201, p-501 …) so they line up with
-- the app's domain types; accounts link to Supabase Auth through user_id.

-- ------------------------------------------------------------------ tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('student', 'faculty', 'supervisor', 'admin')),
  display_name text not null,
  -- students.id or faculty.id, depending on role
  profile_id text not null,
  avatar_url text
);

create table public.faculty (
  id text primary key,
  user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  faculty_code text not null,
  department text not null,
  designation text not null,
  email text not null,
  contact_number text not null default '',
  office_location text not null default '',
  avatar_url text
);

create table public.projects (
  id text primary key,
  title text not null,
  description text not null default '',
  domain text not null default '',
  status text not null check (status in ('proposed', 'active', 'under_review', 'completed', 'on_hold')),
  progress int not null default 0 check (progress between 0 and 100),
  start_date date not null,
  expected_completion_date date not null,
  coordinator_id text references public.faculty (id),
  supervisor_id text references public.faculty (id),
  team_id text,
  repository_url text
);

create table public.students (
  id text primary key,
  user_id uuid unique references auth.users (id) on delete set null,
  -- personal, student-editable
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  contact_number text not null default '',
  personal_email text not null default '',
  address text not null default '',
  avatar_url text,
  -- academic, university-controlled
  registration_number text not null unique,
  university_email text not null,
  programme text not null,
  branch text not null,
  specialization text not null default '',
  semester int not null,
  section text not null,
  batch text not null,
  cgpa numeric(4, 2) not null default 0,
  project_id text references public.projects (id),
  coordinator_id text references public.faculty (id)
);

create table public.teams (
  id text primary key,
  name text not null,
  project_id text not null references public.projects (id) on delete cascade,
  lead_student_id text
);

create table public.team_members (
  team_id text not null references public.teams (id) on delete cascade,
  student_id text not null,
  full_name text not null,
  registration_number text not null,
  team_role text not null default '',
  avatar_url text,
  position int not null default 0,
  primary key (team_id, student_id)
);

create table public.deadlines (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  -- set when the task is individual rather than team-wide
  student_id text,
  title text not null,
  description text not null default '',
  kind text not null check (kind in ('weekly_progress', 'review', 'document', 'certificate', 'presentation')),
  due_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'under_review', 'overdue')),
  submitted_at timestamptz,
  weightage int,
  -- uploaded submission, stored in the private `submissions` bucket
  file_path text,
  file_name text
);

create table public.announcements (
  id text primary key,
  title text not null,
  body text not null,
  posted_by_name text not null,
  posted_by_role text not null,
  posted_at timestamptz not null default now(),
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  attachment_name text,
  attachment_size_label text,
  attachment_url text,
  -- null = every student; set = one project's team
  project_id text references public.projects (id) on delete cascade
);

create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('deadline', 'announcement', 'submission', 'feedback', 'profile')),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  read boolean not null default false,
  href text
);

create index on public.students (project_id);
create index on public.projects (coordinator_id);
create index on public.projects (supervisor_id);
create index on public.teams (project_id);
create index on public.deadlines (project_id, due_date);
create index on public.announcements (project_id, posted_at desc);
create index on public.notifications (user_id, created_at desc);

-- ------------------------------------------------- access helper functions
-- security definer so policies can consult profiles/students without
-- recursing into those tables' own policies.

create function public.current_app_role() returns text
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(
  (select role in ('faculty', 'supervisor', 'admin') from public.profiles where id = auth.uid()),
  false) $$;

create function public.my_student_id() returns text
language sql stable security definer set search_path = ''
as $$ select id from public.students where user_id = auth.uid() $$;

create function public.my_project_id() returns text
language sql stable security definer set search_path = ''
as $$ select project_id from public.students where user_id = auth.uid() $$;

revoke execute on function public.current_app_role(), public.is_staff(),
  public.my_student_id(), public.my_project_id() from public, anon;
grant execute on function public.current_app_role(), public.is_staff(),
  public.my_student_id(), public.my_project_id() to authenticated;

-- ----------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.faculty enable row level security;
alter table public.projects enable row level security;
alter table public.students enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.deadlines enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

-- Nothing is visible before sign-in.
revoke all on all tables in schema public from anon;

-- Writes are opened column by column below; everything else is read-only.
revoke insert, update, delete on all tables in schema public from authenticated;

create policy "own profile, or staff" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

create policy "faculty directory" on public.faculty
  for select to authenticated using (true);

create policy "own project, or staff" on public.projects
  for select to authenticated
  using (id = (select public.my_project_id()) or (select public.is_staff()));

create policy "own record, or staff" on public.students
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy "edit own personal details" on public.students
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Academic columns are never in this list, so they stay read-only.
grant update (full_name, date_of_birth, gender, contact_number, personal_email, address, avatar_url)
  on public.students to authenticated;

create policy "own team, or staff" on public.teams
  for select to authenticated
  using (project_id = (select public.my_project_id()) or (select public.is_staff()));

create policy "own team members, or staff" on public.team_members
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.project_id = (select public.my_project_id())
    )
  );

create policy "own deadlines, or staff" on public.deadlines
  for select to authenticated
  using (
    (select public.is_staff())
    or (
      project_id = (select public.my_project_id())
      and (student_id is null or student_id = (select public.my_student_id()))
    )
  );

create policy "submit own deadlines" on public.deadlines
  for update to authenticated
  using (
    project_id = (select public.my_project_id())
    and (student_id is null or student_id = (select public.my_student_id()))
  )
  with check (status = 'submitted');
grant update (status, submitted_at, file_path, file_name) on public.deadlines to authenticated;

create policy "general or own project, or staff" on public.announcements
  for select to authenticated
  using (
    project_id is null
    or project_id = (select public.my_project_id())
    or (select public.is_staff())
  );

create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant update (read) on public.notifications to authenticated;

-- ----------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('submissions', 'submissions', false, 26214400,
    array['application/pdf', 'application/zip', 'image/png', 'image/jpeg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation']);

-- avatars/<user id>/<file> - each user manages only their own folder.
create policy "read own avatar files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- submissions/<project id>/<deadline id>/<file> - the team uploads, the
-- team and staff can read.
create policy "team uploads submissions" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select public.my_project_id())
  );
create policy "team and staff read submissions" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[1] = (select public.my_project_id())
      or (select public.is_staff())
    )
  );
