-- Start clean: remove every old demo and test account and all the sample data
-- made with them (groups, reports, queries, grades, notifications,
-- announcements, achievements and their uploaded files), then create three
-- fresh demo logins - one per portal - for working on the dashboards.
--
-- What stays: the 821 MUJ faculty from the directory (source 'muj', without
-- logins) and the PBL office address in app_private.admin_emails. Real
-- people sign up with their university address and the sign-up trigger
-- links them as before.
--
--   demo.2400000001@muj.manipal.edu   Demo Student   password pace@2026
--   demo.teacher@jaipur.manipal.edu   Demo Teacher   password pace@2026
--   demo.admin@jaipur.manipal.edu     PBL Office     password pace@2026

-- ------------------------------------------------------------- sample data

delete from public.achievement_events;
delete from public.achievements;
delete from public.notifications;
delete from public.student_grades;
delete from public.weekly_reports;
delete from public.tickets;
delete from public.announcements;
delete from public.group_invitations;
delete from public.mentor_requests;
delete from public.supervisor_changes;
delete from public.group_members;
delete from public.groups;
delete from public.students;
delete from public.faculty where source = 'demo';
update public.faculty set user_id = null where user_id is not null;
delete from legacy.announcements;

-- Uploaded files of the sample data (submissions, announcements, achievements).
set local storage.allow_delete_query = 'true';
delete from storage.objects
where bucket_id in ('avatars', 'submissions', 'announcements', 'achievements');

-- ---------------------------------------------------------------- accounts

delete from public.profiles;
delete from auth.users;

-- --------------------------------------------------- test-login machinery

-- Sign-up without the test-login shortcuts (fixed demo ids, test addresses).
do $$
declare d text;
begin
  d := pg_get_functiondef('app_private.on_auth_user_created()'::regprocedure);
  d := replace(d, E'  if new.id::text like ''a1000000-0000-4000-8000-%'' then return new; end if;\n', '');
  d := replace(d, E'  if app_private.link_test_account(new.id, em) then return new; end if;\n', '');
  execute d;
end $$;

drop function if exists app_private.link_test_account(uuid, text);
drop table if exists app_private.test_accounts;

-- -------------------------------------------------------- demo logins

-- The sign-up trigger sets each one up like a real account: the student
-- record from the address, the teacher from their faculty row, the PBL
-- office from admin_emails.
insert into public.faculty (id, full_name, department, designation, email, source)
values ('f-demo', 'Demo Teacher', 'Computer Science & Engineering', 'Assistant Professor',
  'demo.teacher@jaipur.manipal.edu', 'demo');
insert into app_private.admin_emails (email) values ('demo.admin@jaipur.manipal.edu') on conflict do nothing;

with accounts (email, full_name) as (
  values
    ('demo.2400000001@muj.manipal.edu', 'Demo Student'),
    ('demo.teacher@jaipur.manipal.edu', 'Demo Teacher'),
    ('demo.admin@jaipur.manipal.edu', 'PBL Office')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', email,
  extensions.crypt('pace@2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name),
  now(), now(), '', '', '', ''
from accounts;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email in ('demo.2400000001@muj.manipal.edu', 'demo.teacher@jaipur.manipal.edu', 'demo.admin@jaipur.manipal.edu');
