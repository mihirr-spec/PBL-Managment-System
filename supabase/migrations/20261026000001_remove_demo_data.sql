-- Start clean: remove every demo and test account and all the sample data
-- made with them (groups, reports, queries, grades, notifications,
-- announcements, achievements and their uploaded files).
--
-- What stays: the 821 MUJ faculty from the directory (source 'muj', without
-- logins) and the PBL office address in app_private.admin_emails. Real
-- people sign up with their university address and the sign-up trigger
-- links them as before.

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
