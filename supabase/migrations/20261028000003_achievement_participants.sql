-- Achievements with the people who were part of them, and LinkedIn profiles.
--
-- A student files the achievement and may add whoever achieved it with them:
-- teammates from their group or students outside it. Only those people are
-- told about it; with nobody added, only the student who filed it is. Each
-- person can give a LinkedIn profile, which the LinkedIn post names.
--
-- participants: [{ "name", "registration_number", "student_id", "linkedin", "in_team" }]
-- student_id is set when the registration number belongs to a student on the portal.

alter table public.achievements
  add column if not exists linkedin text not null default '',
  add column if not exists participants jsonb not null default '[]';

-- Remembered so the next achievement form starts with it.
alter table public.students add column if not exists linkedin text not null default '';

-- Participants on the portal can see the achievement they were added to.
drop policy if exists "own achievements, ones I review, or admin" on public.achievements;
create policy "own achievements, ones I review, or admin" on public.achievements
  for select to authenticated
  using (
    student_id = (select app_private.my_student_id())
    or faculty_id = (select app_private.my_faculty_id())
    or (select app_private.is_admin())
    or participants @> jsonb_build_array(jsonb_build_object('student_id', (select app_private.my_student_id())))
  );

-- A LinkedIn profile link (or just the name in it), stored as the full link; '' when empty.
create or replace function app_private.clean_linkedin(p text)
returns text language plpgsql immutable set search_path = ''
as $$
declare
  v text := trim(coalesce(p, ''));
  handle text;
begin
  if v = '' then return ''; end if;
  v := regexp_replace(v, '^@', '');
  v := regexp_replace(v, '^(https?://)?([a-z]{2,3}\.)?', '', 'i');
  handle := (regexp_match(v, '^linkedin\.com/in/([A-Za-z0-9_%-]+)/?(\?.*)?$', 'i'))[1];
  if handle is null and v ~ '^[A-Za-z0-9_-]{3,100}$' then handle := v; end if;
  if handle is null then
    raise exception 'Use a LinkedIn profile link like linkedin.com/in/your-name (got %).', p;
  end if;
  return 'https://www.linkedin.com/in/' || handle;
end $$;

-- Checks the people added to an achievement and fills in the portal's details.
create or replace function app_private.clean_participants(p jsonb, p_me text, p_group uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  item jsonb;
  picked jsonb := '[]';
  reg text;
  s public.students;
begin
  if jsonb_typeof(coalesce(p, '[]')) <> 'array' then raise exception 'Participants must be a list.'; end if;
  if jsonb_array_length(coalesce(p, '[]')) > 10 then raise exception 'Add at most 10 people.'; end if;

  for item in select * from jsonb_array_elements(coalesce(p, '[]')) loop
    reg := upper(trim(coalesce(item ->> 'registration_number', '')));
    s := null;
    if reg <> '' then select * into s from public.students where registration_number = reg; end if;
    if s.id = p_me then continue; end if;
    if s.id is null and trim(coalesce(item ->> 'name', '')) = '' then
      raise exception 'Give the name of everyone you add.';
    end if;
    if s.id is not null and picked @> jsonb_build_array(jsonb_build_object('student_id', s.id)) then continue; end if;

    picked := picked || jsonb_build_array(jsonb_build_object(
      'name', coalesce(s.full_name, trim(item ->> 'name')),
      'registration_number', coalesce(s.registration_number, reg),
      'student_id', s.id,
      'linkedin', app_private.clean_linkedin(item ->> 'linkedin'),
      'in_team', s.id is not null and exists (
        select 1 from public.group_members where group_id = p_group and student_id = s.id)
    ));
  end loop;
  return picked;
end $$;

-- Everyone told about an achievement: the student who filed it and the people added.
create or replace function app_private.achievement_users(a public.achievements)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct s.user_id), '{}')
  from public.students s
  where s.user_id is not null
    and (s.id = a.student_id or s.id in (
      select p ->> 'student_id' from jsonb_array_elements(a.participants) p))
$$;

revoke execute on function app_private.clean_linkedin, app_private.clean_participants,
  app_private.achievement_users from public, anon;
grant execute on function app_private.clean_linkedin, app_private.clean_participants,
  app_private.achievement_users to authenticated;

-- ------------------------------------------------------------------ actions

drop function if exists public.submit_achievement(text, text, text, text, jsonb, date, jsonb);
create function public.submit_achievement(
  p_category text, p_template text, p_title text, p_description text,
  p_answers jsonb, p_achieved_on date, p_documents jsonb,
  p_participants jsonb default '[]', p_linkedin text default ''
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s public.students;
  g public.groups;
  a public.achievements;
  others uuid[];
begin
  select * into s from public.students where user_id = auth.uid();
  if s.id is null then raise exception 'Only students can submit achievements.'; end if;

  select gr.* into g from public.groups gr
  join public.group_members gm on gm.group_id = gr.id
  where gm.student_id = s.id;
  if g.mentor_id is null then
    raise exception 'Your group needs a supervisor first - they are the one who reviews achievements.';
  end if;

  if jsonb_array_length(app_private.check_documents(p_documents, s.id)) = 0 then
    raise exception 'Attach at least one supporting document (certificate, letter, screenshot or link proof).';
  end if;
  if p_achieved_on > current_date then raise exception 'The date of the achievement cannot be in the future.'; end if;

  insert into public.achievements (student_id, group_id, faculty_id, category, template, title,
    description, answers, achieved_on, documents, linkedin, participants)
  values (s.id, g.id, g.mentor_id, p_category, p_template, trim(p_title), coalesce(trim(p_description), ''),
    coalesce(p_answers, '{}'), p_achieved_on, p_documents, app_private.clean_linkedin(p_linkedin),
    app_private.clean_participants(p_participants, s.id, g.id))
  returning * into a;

  if trim(coalesce(p_linkedin, '')) <> '' then
    update public.students set linkedin = a.linkedin where id = s.id;
  end if;

  perform app_private.log_achievement(a.id, 'submitted', '');
  perform app_private.notify(array[app_private.faculty_user_id(g.mentor_id)], 'achievement',
    s.full_name || ' submitted an achievement for review', trim(p_title), '/faculty/achievements');

  others := array_remove(app_private.achievement_users(a), auth.uid());
  if cardinality(others) > 0 then
    perform app_private.notify(others, 'achievement',
      s.full_name || ' added you to an achievement', trim(p_title), '/student/achievements');
  end if;
  return a.id;
end $$;

drop function if exists public.update_achievement(uuid, text, text, jsonb, date, jsonb, text);
create function public.update_achievement(
  p_achievement uuid, p_title text, p_description text, p_answers jsonb, p_achieved_on date,
  p_new_documents jsonb, p_note text, p_participants jsonb default null, p_linkedin text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.achievements;
  had uuid[];
  added uuid[];
begin
  select * into a from public.achievements where id = p_achievement;
  if a.id is null or app_private.achievement_party(a) is distinct from 'student' then
    raise exception 'Only the student who submitted this achievement can edit it.';
  end if;
  if a.status not in ('submitted', 'needs_info') then
    raise exception 'This achievement has been %, so it can no longer be changed.', a.status;
  end if;
  if p_achieved_on > current_date then raise exception 'The date of the achievement cannot be in the future.'; end if;
  had := app_private.achievement_users(a);

  update public.achievements set
    title = trim(p_title),
    description = coalesce(trim(p_description), ''),
    answers = coalesce(p_answers, '{}'),
    achieved_on = p_achieved_on,
    documents = documents || app_private.check_documents(p_new_documents, a.student_id),
    linkedin = case when p_linkedin is null then linkedin else app_private.clean_linkedin(p_linkedin) end,
    participants = case when p_participants is null then participants
                   else app_private.clean_participants(p_participants, a.student_id, a.group_id) end,
    status = 'submitted',
    updated_at = now()
  where id = a.id
  returning * into a;

  perform app_private.log_achievement(a.id, 'resubmitted', p_note);
  perform app_private.notify(array[app_private.faculty_user_id(a.faculty_id)], 'achievement',
    (select full_name from public.students where id = a.student_id) || ' updated an achievement',
    coalesce(nullif(trim(p_note), ''), trim(p_title)), '/faculty/achievements');

  added := array(select unnest(app_private.achievement_users(a)) except select unnest(had));
  if cardinality(added) > 0 then
    perform app_private.notify(added, 'achievement',
      (select full_name from public.students where id = a.student_id) || ' added you to an achievement',
      trim(p_title), '/student/achievements');
  end if;
end $$;

revoke execute on function public.submit_achievement, public.update_achievement from public, anon;
grant execute on function public.submit_achievement, public.update_achievement to authenticated;

-- Decisions and the LinkedIn post reach everyone on the achievement, not just the filer.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.review_achievement(uuid, text, text, numeric)'::regprocedure);
  if position('array[(select user_id from public.students where id = a.student_id)], ''achievement'',
    case p_decision' in d) = 0 then raise exception 'review_achievement has changed; update this migration.'; end if;
  d := replace(d,
    'perform app_private.notify(array[(select user_id from public.students where id = a.student_id)], ''achievement'',
    case p_decision',
    'perform app_private.notify(app_private.achievement_users(a), ''achievement'',
    case p_decision');
  execute d;

  d := pg_get_functiondef('public.record_linkedin_post(uuid, text)'::regprocedure);
  if position('array[(select user_id from public.students where id = a.student_id)], ''achievement'',
    ''Your achievement' in d) = 0 then raise exception 'record_linkedin_post has changed; update this migration.'; end if;
  d := replace(d,
    'perform app_private.notify(array[(select user_id from public.students where id = a.student_id)], ''achievement'',
    ''Your achievement is on LinkedIn',
    'perform app_private.notify(app_private.achievement_users(a), ''achievement'',
    ''Your achievement is on LinkedIn');
  execute d;
end $$;
