-- Sign-up by name: supervisors and administrators find themselves in the MUJ
-- faculty list while typing their name, and picking a row fills in their email.
-- A row whose stored email is blank or mistyped can still be claimed by the
-- address the person verifies, as long as they picked that row.

create extension if not exists pg_trgm with schema extensions;

/** Faculty names close to what is being typed on the sign-up page (no login needed). */
create or replace function public.search_faculty_directory(p_query text)
returns table (
  id text,
  full_name text,
  department text,
  designation text,
  email text,
  is_admin boolean,
  has_account boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select lower(trim(p_query)) as t),
  f as (
    select fac.*,
      lower(regexp_replace(fac.full_name, '^\s*((dr|mr|mrs|ms|prof)\.?\s+)+', '', 'i')) as bare
    from public.faculty fac
  )
  select f.id, f.full_name, f.department, f.designation, coalesce(f.email, ''),
    exists (select 1 from app_private.admin_emails a where a.email = lower(f.email)),
    f.user_id is not null
  from f, q
  where length(q.t) >= 2
    and (f.bare like '%' || q.t || '%'
         or extensions.word_similarity(q.t, f.bare) > 0.4)
  order by (f.bare like q.t || '%') desc,
           extensions.word_similarity(q.t, f.bare) desc,
           f.full_name
  limit 8;
$$;

revoke all on function public.search_faculty_directory(text) from public;
grant execute on function public.search_faculty_directory(text) to anon, authenticated;

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

  select * into s from public.students where lower(university_email) = em for update;
  if s.id is null and email_reg is not null then
    select * into s from public.students where registration_number = email_reg for update;
  end if;

  if s.id is not null then
    if s.user_id is not null then
      raise exception 'An account already exists for this student.';
    end if;
    update public.students set user_id = new.id, university_email = em where id = s.id
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
