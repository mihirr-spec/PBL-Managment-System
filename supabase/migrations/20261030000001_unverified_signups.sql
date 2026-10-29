-- A sign-up that was never verified no longer holds on to a registration
-- number or faculty record. Going back from the code screen deletes it (the
-- password typed on the form proves it is theirs), and a later sign-up for the
-- same student or faculty member takes over one that was simply abandoned.

-- Deletes the account if it was never verified, with the student record its
-- sign-up created (unless a team already refers to it). True when deleted.
create or replace function app_private.release_unverified(p_user uuid, p_keep uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not exists (
    select 1 from auth.users
    where id = p_user and id is distinct from p_keep and email_confirmed_at is null
  ) then
    return false;
  end if;
  delete from public.students st
  where st.user_id = p_user
    and not exists (select 1 from public.group_members m where m.student_id = st.id)
    and not exists (select 1 from public.groups g where g.leader_student_id = st.id)
    and not exists (select 1 from public.group_invitations i where st.id in (i.student_id, i.invited_by));
  delete from auth.users where id = p_user;
  return true;
end $function$;

revoke all on function app_private.release_unverified(uuid, uuid) from public;

-- "Wrong details? Go back": removes a sign-up still waiting for its code.
-- The password typed on the form proves the sign-up is the caller's.
create or replace function public.discard_unverified_signup(p_email text, p_password text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid;
begin
  select id into uid from auth.users
  where lower(email) = lower(trim(p_email))
    and email_confirmed_at is null
    and encrypted_password = extensions.crypt(p_password, encrypted_password);
  if uid is null then return false; end if;
  return app_private.release_unverified(uid, null);
end $function$;

revoke all on function public.discard_unverified_signup(text, text) from public;
grant execute on function public.discard_unverified_signup(text, text) to anon, authenticated;

create or replace function app_private.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  em text := lower(trim(new.email));
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  f public.faculty;
  s public.students;
  email_reg text;
  reg text;
  start_year int;
  term_start int;
  took_over boolean := false;
begin

  if em like '%@jaipur.manipal.edu' then
    if exists (select 1 from app_private.admin_emails where email = em) then
      insert into public.profiles (id, email, role, display_name, profile_id)
      values (new.id, em, 'admin',
        coalesce((select full_name from public.faculty where lower(email) = em limit 1),
                 nullif(trim(meta ->> 'full_name'), ''), 'Administrator'),
        'admin');
      return new;
    end if;

    -- Free the faculty record from an earlier sign-up that was never verified.
    perform app_private.release_unverified(user_id, new.id)
    from public.faculty
    where user_id is not null
      and (lower(email) = em or id = nullif(meta ->> 'faculty_id', ''));

    if exists (select 1 from public.faculty where lower(email) = em and user_id is not null) then
      raise exception 'An account already exists for %.', em;
    end if;

    select * into f from public.faculty
    where lower(email) = em and user_id is null
    order by id limit 1 for update;

    -- The row picked on the sign-up page, when its stored email is blank or
    -- not a valid MUJ staff address (the verified address replaces it).
    if f.id is null and nullif(meta ->> 'faculty_id', '') is not null then
      select * into f from public.faculty
      where id = meta ->> 'faculty_id' and user_id is null
        and lower(coalesce(email, '')) not like '%@jaipur.manipal.edu'
      for update;
    end if;

    if f.id is null then
      raise exception 'No MUJ faculty record has the address %. Contact the administrator.', em;
    end if;
    update public.faculty set user_id = new.id, email = em where id = f.id;
    insert into public.profiles (id, email, role, display_name, profile_id)
    values (new.id, em, 'faculty', f.full_name, f.id);
    return new;
  end if;

  if em not like '%@muj.manipal.edu' then
    raise exception 'Use your university email: name.registrationno@muj.manipal.edu.';
  end if;

  email_reg := substring(split_part(em, '@', 1) from '(\d{6,})$');

  -- Free this student from an earlier sign-up that was never verified.
  select coalesce(bool_or(app_private.release_unverified(user_id, new.id)), false) into took_over
  from public.students
  where user_id is not null and (lower(university_email) = em or registration_number = email_reg);

  select * into s from public.students where lower(university_email) = em for update;
  if s.id is null and email_reg is not null then
    select * into s from public.students where registration_number = email_reg for update;
  end if;

  if s.id is not null then
    if s.user_id is not null then
      raise exception 'An account already exists for this student.';
    end if;
    -- A record kept from an abandoned sign-up takes the details typed now;
    -- a record from the class list keeps its own.
    update public.students set
      user_id = new.id,
      university_email = em,
      full_name = case when took_over then coalesce(nullif(trim(meta ->> 'full_name'), ''), full_name) else full_name end,
      programme = case when took_over then coalesce(nullif(trim(meta ->> 'programme'), ''), programme) else programme end,
      branch = case when took_over then coalesce(nullif(trim(meta ->> 'branch'), ''), branch) else branch end,
      semester = case when took_over then coalesce(nullif(meta ->> 'semester', '')::int, semester) else semester end,
      section = case when took_over then coalesce(nullif(upper(trim(meta ->> 'section')), ''), section) else section end
    where id = s.id
    returning * into s;
  else
    reg := coalesce(email_reg, nullif(upper(trim(meta ->> 'registration_number')), ''));
    if reg is null then raise exception 'Your registration number is required.'; end if;
    if exists (select 1 from public.students where registration_number = reg) then
      raise exception 'Registration number % is already registered.', reg;
    end if;

    start_year := case when reg ~ '^\d{2}' then 2000 + left(reg, 2)::int
                       else extract(year from now())::int end;
    term_start := (extract(year from now())::int - start_year) * 2
                  + case when extract(month from now()) >= 7 then 1 else 0 end;

    insert into public.students (
      id, user_id, full_name, registration_number, university_email,
      programme, branch, specialization, semester, section, batch
    ) values (
      's-' || reg, new.id,
      coalesce(nullif(trim(meta ->> 'full_name'), ''), initcap(split_part(split_part(em, '@', 1), '.', 1))),
      reg, em,
      coalesce(nullif(trim(meta ->> 'programme'), ''), 'B.Tech'),
      coalesce(nullif(trim(meta ->> 'branch'), ''), 'Computer Science & Engineering'),
      coalesce(trim(meta ->> 'specialization'), ''),
      coalesce(nullif(meta ->> 'semester', '')::int, greatest(1, least(8, term_start))),
      upper(coalesce(trim(meta ->> 'section'), '')),
      start_year || ' – ' || (start_year + 4)
    )
    returning * into s;
  end if;

  insert into public.profiles (id, email, role, display_name, profile_id)
  values (new.id, em, 'student', s.full_name, s.id);

  perform app_private.notify(array[new.id], 'group',
    l.full_name || ' has invited you to join ' || g.name, g.project_title, '/student/requests')
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  join public.students l on l.id = i.invited_by
  where i.student_id = s.id and i.status = 'pending';

  return new;
end $function$;
