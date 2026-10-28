-- Test logins for trying the whole flow, LinkedIn posting included. The demo
-- logins are gone. Every password is pace@2026, and every address is
-- confirmed already, so no verification email is needed.
--
--   teststudent1@muj.manipal.edu         Test Student 1        2427000001
--   teststudent2@muj.manipal.edu         Test Student 2        2427000002
--   teststudent3@muj.manipal.edu         Test Student 3        2427000003
--   testteacher1@jaipur.manipal.edu      Test Teacher 1        (faculty f-test-1)
--   testadministrator1@jaipur.manipal.edu  Test Administrator 1

delete from public.students where university_email = 'demo.2400000001@muj.manipal.edu';
delete from auth.users where email in ('demo.2400000001@muj.manipal.edu', 'demo.teacher@jaipur.manipal.edu', 'demo.admin@jaipur.manipal.edu');
delete from public.faculty where id = 'f-demo';
delete from app_private.admin_emails where email = 'demo.admin@jaipur.manipal.edu';

-- The sign-up trigger links each account: the teacher to this faculty row,
-- the administrator through admin_emails, the students by registration number.
insert into public.faculty (id, full_name, department, designation, email, source)
values ('f-test-1', 'Test Teacher 1', 'Computer Science & Engineering', 'Assistant Professor',
  'testteacher1@jaipur.manipal.edu', 'demo');
insert into app_private.admin_emails (email) values ('testadministrator1@jaipur.manipal.edu') on conflict do nothing;

with accounts (email, meta) as (
  values
    ('teststudent1@muj.manipal.edu', '{"full_name":"Test Student 1","registration_number":"2427000001"}'::jsonb),
    ('teststudent2@muj.manipal.edu', '{"full_name":"Test Student 2","registration_number":"2427000002"}'::jsonb),
    ('teststudent3@muj.manipal.edu', '{"full_name":"Test Student 3","registration_number":"2427000003"}'::jsonb),
    ('testteacher1@jaipur.manipal.edu', '{"full_name":"Test Teacher 1"}'::jsonb),
    ('testadministrator1@jaipur.manipal.edu', '{"full_name":"Test Administrator 1"}'::jsonb)
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', email,
  extensions.crypt('pace@2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', meta,
  now(), now(), '', '', '', ''
from accounts;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like 'test%@%manipal.edu'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);
