-- Role names: teachers are "team supervisors" and the PBL office is the
-- "administrator". Rewrites the messages inside the database functions and
-- the stored display names that still say PBL office.

do $$
declare
  fn regprocedure;
  d text;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private') and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* '(pbl office|this teacher|a teacher who)'
  loop
    d := pg_get_functiondef(fn);
    d := replace(d, 'Only the PBL office', 'Only the administrator');
    d := replace(d, 'or the PBL office', 'or the administrator');
    d := replace(d, 'waiting for the PBL office', 'waiting for the administrator');
    d := replace(d, 'with the PBL office', 'with the administrator');
    d := replace(d, 'forwarded to the PBL office', 'forwarded to the administrator');
    d := replace(d, 'Contact the PBL office', 'Contact the administrator');
    d := replace(d, '''PBL Office''', '''Administrator''');
    d := replace(d, 'requested this teacher', 'requested this supervisor');
    d := replace(d, 'request with this teacher', 'request with this supervisor');
    d := replace(d, 'Pick a teacher who', 'Pick a supervisor who');
    execute d;
  end loop;
end $$;

update public.profiles set display_name = 'Administrator' where display_name = 'PBL Office';
update app_private.linkedin_account set connected_by = 'Administrator' where connected_by = 'PBL Office';
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"full_name":"Administrator"}'
where raw_user_meta_data ->> 'full_name' = 'PBL Office';
