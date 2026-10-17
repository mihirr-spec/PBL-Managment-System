-- Achievements: a student records something they achieved on their own
-- (a hackathon win, a paper, a medal), with supporting documents. Their
-- group's supervisor reviews it — approves (optionally with bonus marks),
-- asks for more details, comments, or rejects. Approved achievements feed the
-- Student Excellence Award shortlist and a LinkedIn-ready post.
--
-- Achievements are individual, not per group: each student files their own.
-- The categories and question templates live in src/lib/achievements.ts;
-- the answers are kept here as jsonb.

-- ------------------------------------------------------------------ tables

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  -- The supervisor who reviews it: the group's mentor when it was filed.
  faculty_id text references public.faculty (id) on delete set null,
  category text not null,
  template text not null,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  answers jsonb not null default '{}',
  achieved_on date,
  -- [{ "path": "<student id>/<file>", "name": "certificate.pdf" }, ...]
  documents jsonb not null default '[]',
  status text not null default 'submitted'
    check (status in ('submitted', 'needs_info', 'approved', 'rejected')),
  bonus_marks numeric(3, 1),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.achievements (student_id, created_at desc);
create index on public.achievements (faculty_id, status);

-- The conversation and decision trail on one achievement.
create table public.achievement_events (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  actor uuid references auth.users (id) on delete set null,
  actor_name text not null,
  actor_role text not null,
  action text not null
    check (action in ('submitted', 'resubmitted', 'comment', 'needs_info', 'approved', 'rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.achievement_events (achievement_id, created_at);

alter table public.achievements enable row level security;
alter table public.achievement_events enable row level security;
revoke all on public.achievements, public.achievement_events from anon;
revoke insert, update, delete on public.achievements, public.achievement_events from authenticated;

create policy "own achievements, ones I review, or admin" on public.achievements
  for select to authenticated
  using (
    student_id = (select app_private.my_student_id())
    or faculty_id = (select app_private.my_faculty_id())
    or (select app_private.is_admin())
  );

-- Visible exactly when the achievement is (its own policy applies inside).
create policy "events of visible achievements" on public.achievement_events
  for select to authenticated
  using (exists (select 1 from public.achievements a where a.id = achievement_id));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement', 'report', 'grade', 'ticket', 'request', 'group', 'profile',
                  'deadline', 'submission', 'feedback', 'achievement'));

-- ----------------------------------------------------------------- helpers

create or replace function app_private.log_achievement(p_achievement uuid, p_action text, p_note text)
returns void language sql security definer set search_path = ''
as $$
  insert into public.achievement_events (achievement_id, actor, actor_name, actor_role, action, note)
  select p_achievement, p.id, p.display_name, p.role, p_action, coalesce(trim(p_note), '')
  from public.profiles p where p.id = auth.uid()
$$;

-- Every document must sit in the caller's own folder of the bucket.
create or replace function app_private.check_documents(p_documents jsonb, p_student text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare d jsonb;
begin
  if jsonb_typeof(coalesce(p_documents, '[]')) <> 'array' then
    raise exception 'Documents must be a list.';
  end if;
  for d in select * from jsonb_array_elements(coalesce(p_documents, '[]')) loop
    if coalesce(d ->> 'path', '') not like p_student || '/%' or coalesce(d ->> 'name', '') = '' then
      raise exception 'A supporting document was not uploaded correctly. Attach it again.';
    end if;
  end loop;
  return coalesce(p_documents, '[]');
end $$;

-- Who may act on an achievement: its student, its reviewer, or the PBL office.
create or replace function app_private.achievement_party(a public.achievements)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when a.student_id = (select id from public.students where user_id = auth.uid()) then 'student'
    when a.faculty_id is not null and a.faculty_id = (select id from public.faculty where user_id = auth.uid()) then 'reviewer'
    when coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) then 'admin'
  end
$$;

revoke execute on function app_private.log_achievement, app_private.check_documents,
  app_private.achievement_party from public, anon;
grant execute on function app_private.log_achievement, app_private.check_documents,
  app_private.achievement_party to authenticated;

-- ------------------------------------------------------------------ actions

/** Student files an achievement; it goes to their group's supervisor. */
create or replace function public.submit_achievement(
  p_category text, p_template text, p_title text, p_description text,
  p_answers jsonb, p_achieved_on date, p_documents jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s public.students;
  g public.groups;
  new_id uuid;
begin
  select * into s from public.students where user_id = auth.uid();
  if s.id is null then raise exception 'Only students can submit achievements.'; end if;

  select gr.* into g from public.groups gr
  join public.group_members gm on gm.group_id = gr.id
  where gm.student_id = s.id;
  if g.mentor_id is null then
    raise exception 'Your group needs a supervisor first — they are the one who reviews achievements.';
  end if;

  if jsonb_array_length(app_private.check_documents(p_documents, s.id)) = 0 then
    raise exception 'Attach at least one supporting document (certificate, letter, screenshot or link proof).';
  end if;
  if p_achieved_on > current_date then raise exception 'The date of the achievement cannot be in the future.'; end if;

  insert into public.achievements (student_id, group_id, faculty_id, category, template, title,
    description, answers, achieved_on, documents)
  values (s.id, g.id, g.mentor_id, p_category, p_template, trim(p_title), coalesce(trim(p_description), ''),
    coalesce(p_answers, '{}'), p_achieved_on, p_documents)
  returning id into new_id;

  perform app_private.log_achievement(new_id, 'submitted', '');
  perform app_private.notify(array[app_private.faculty_user_id(g.mentor_id)], 'achievement',
    s.full_name || ' submitted an achievement for review', trim(p_title), '/faculty/achievements');
  return new_id;
end $$;

/** Student edits a submission (while it is under review or more details were asked for) and sends it back. */
create or replace function public.update_achievement(
  p_achievement uuid, p_title text, p_description text, p_answers jsonb,
  p_achieved_on date, p_new_documents jsonb, p_note text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare a public.achievements;
begin
  select * into a from public.achievements where id = p_achievement;
  if a.id is null or app_private.achievement_party(a) is distinct from 'student' then
    raise exception 'Only the student who submitted this achievement can edit it.';
  end if;
  if a.status not in ('submitted', 'needs_info') then
    raise exception 'This achievement has been %, so it can no longer be changed.', a.status;
  end if;
  if p_achieved_on > current_date then raise exception 'The date of the achievement cannot be in the future.'; end if;

  update public.achievements set
    title = trim(p_title),
    description = coalesce(trim(p_description), ''),
    answers = coalesce(p_answers, '{}'),
    achieved_on = p_achieved_on,
    documents = documents || app_private.check_documents(p_new_documents, a.student_id),
    status = 'submitted',
    updated_at = now()
  where id = a.id;

  perform app_private.log_achievement(a.id, 'resubmitted', p_note);
  perform app_private.notify(array[app_private.faculty_user_id(a.faculty_id)], 'achievement',
    (select full_name from public.students where id = a.student_id) || ' updated an achievement',
    coalesce(nullif(trim(p_note), ''), trim(p_title)), '/faculty/achievements');
end $$;

/** A comment or feedback note from the student, the reviewer or the PBL office; status is unchanged. */
create or replace function public.comment_achievement(p_achievement uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.achievements;
  party text;
begin
  select * into a from public.achievements where id = p_achievement;
  party := app_private.achievement_party(a);
  if a.id is null or party is null then raise exception 'You cannot comment on this achievement.'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Write a comment first.'; end if;

  perform app_private.log_achievement(a.id, 'comment', p_note);
  if party = 'student' then
    perform app_private.notify(array[app_private.faculty_user_id(a.faculty_id)], 'achievement',
      'New comment on an achievement: ' || a.title, left(trim(p_note), 140), '/faculty/achievements');
  else
    perform app_private.notify(array[(select user_id from public.students where id = a.student_id)], 'achievement',
      'Feedback on your achievement: ' || a.title, left(trim(p_note), 140), '/student/achievements');
  end if;
end $$;

/**
 * Reviewer (or the PBL office) decides: approve (with 0–5 bonus marks),
 * needs_info (asks the student for more details) or reject (a reason is required).
 */
create or replace function public.review_achievement(
  p_achievement uuid, p_decision text, p_note text, p_marks numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.achievements;
  party text;
  marks numeric := coalesce(p_marks, 0);
begin
  select * into a from public.achievements where id = p_achievement;
  party := app_private.achievement_party(a);
  -- coalesce: a caller with no part in it has a null party, and null not in (...) is null, not true.
  if a.id is null or coalesce(party, '') not in ('reviewer', 'admin') then
    raise exception 'Only this student''s supervisor can review the achievement.';
  end if;
  if a.status in ('approved', 'rejected') then
    raise exception 'This achievement has already been %.', a.status;
  end if;
  if p_decision not in ('approve', 'needs_info', 'reject') then raise exception 'Unknown decision.'; end if;
  if p_decision in ('needs_info', 'reject') and coalesce(trim(p_note), '') = '' then
    raise exception 'Tell the student %.',
      case when p_decision = 'reject' then 'why it was rejected' else 'what more you need' end;
  end if;
  if p_decision = 'approve' and (marks < 0 or marks > 5) then
    raise exception 'Bonus marks must be between 0 and 5.';
  end if;

  update public.achievements set
    status = case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_info' end,
    bonus_marks = case when p_decision = 'approve' then marks end,
    reviewed_at = now(),
    updated_at = now()
  where id = a.id;

  perform app_private.log_achievement(a.id,
    case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_info' end, p_note);

  -- Bonus marks are recorded as a grade so they show in Grades & Feedback.
  if p_decision = 'approve' and marks > 0 then
    insert into public.student_grades (student_id, group_id, title, score, max_score, improvements, graded_by)
    values (a.student_id, a.group_id, 'Achievement bonus — ' || a.title, marks, 5,
      coalesce(trim(p_note), ''), app_private.my_faculty_id());
  end if;

  perform app_private.notify(array[(select user_id from public.students where id = a.student_id)], 'achievement',
    case p_decision
      when 'approve' then 'Achievement approved: ' || a.title
        || case when marks > 0 then ' (+' || marks || ' bonus marks)' else '' end
      when 'reject' then 'Achievement not approved: ' || a.title
      else 'More details needed: ' || a.title
    end,
    left(coalesce(trim(p_note), ''), 140), '/student/achievements');
end $$;

revoke execute on function public.submit_achievement, public.update_achievement,
  public.comment_achievement, public.review_achievement from public, anon;
grant execute on function public.submit_achievement, public.update_achievement,
  public.comment_achievement, public.review_achievement to authenticated;

-- The achievement notification already says it; skip the generic grade one.
create or replace function app_private.on_grade() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.title like 'Achievement bonus — %' then return new; end if;
  perform app_private.notify(
    array[(select user_id from public.students where id = new.student_id)], 'grade',
    'New grade: ' || new.title || ' — ' || new.score || '/' || new.max_score, new.improvements,
    '/student/grades');
  return new;
end $$;

-- ----------------------------------------------------------------- storage

-- achievements/<student id>/<timestamp>-<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('achievements', 'achievements', false, 15728640,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

create policy "students upload own achievement files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'achievements'
    and (storage.foldername(name))[1] = (select app_private.my_student_id())
  );
create policy "student and staff read achievement files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'achievements'
    and (
      (storage.foldername(name))[1] = (select app_private.my_student_id())
      or (select app_private.is_staff())
    )
  );

-- -------------------------------------------------------------- demo data

-- The sample student (Group 1, supervised by Dr. Anagha Deshpande): one
-- approved, one waiting on more details, one waiting for review.
do $$
declare
  gid uuid := (select id from public.groups where number = 1);
  a1 uuid; a2 uuid; a3 uuid;
  student_user uuid := 'a1000000-0000-4000-8000-000000001001';
  mentor_user uuid := 'a1000000-0000-4000-8000-000000002001';
begin
  if not exists (select 1 from public.students where id = 's-2201') or gid is null then return; end if;

  insert into public.achievements (student_id, group_id, faculty_id, category, template, title, description,
    answers, achieved_on, status, bonus_marks, reviewed_at, created_at)
  values ('s-2201', gid, 'f-301', 'hackathons', 'hackathon_win',
    '1st Prize — Smart India Hackathon 2026 (Software Edition)',
    'Our team of six built an offline crop-disease detector for farmers; I led model training and on-device optimisation.',
    jsonb_build_object('event', 'Smart India Hackathon 2026 — Grand Finale', 'position', '1st Prize',
      'organiser', 'Ministry of Education''s Innovation Cell & AICTE', 'venue', 'IIT Jammu',
      'team', 'Team Kisan (6 members)', 'problem', 'Offline crop-disease detection for low-connectivity districts',
      'prize', '₹1,00,000 cash prize', 'role', 'Team lead — model training and quantisation'),
    current_date - 30, 'approved', 4, now() - interval '20 days', now() - interval '25 days')
  returning id into a1;

  insert into public.achievements (student_id, group_id, faculty_id, category, template, title, description,
    answers, achieved_on, status, created_at)
  values ('s-2201', gid, 'f-301', 'research', 'paper_presented',
    'Paper presented at ICICV 2026',
    'Presented our paper on lightweight CNNs for leaf-disease classification.',
    jsonb_build_object('paper', 'Lightweight CNNs for On-Device Leaf Disease Classification',
      'conference', 'International Conference on Intelligent Computing and Vision (ICICV 2026)',
      'publisher', 'Springer', 'coauthors', 'Rahul Verma, Dr. Anagha Deshpande'),
    current_date - 12, 'needs_info', now() - interval '10 days')
  returning id into a2;

  insert into public.achievements (student_id, group_id, faculty_id, category, template, title, description,
    answers, achieved_on, status, created_at)
  values ('s-2201', gid, 'f-301', 'sports', 'sports_medal',
    'Gold — Inter-University Table Tennis (Singles)',
    'Won the singles final 3–1 representing MUJ.',
    jsonb_build_object('sport', 'Table Tennis (Men''s Singles)', 'event', 'West Zone Inter-University Championship 2026',
      'medal', 'Gold', 'level', 'Zonal', 'organiser', 'Association of Indian Universities'),
    current_date - 4, 'submitted', now() - interval '2 days')
  returning id into a3;

  insert into public.achievement_events (achievement_id, actor, actor_name, actor_role, action, note, created_at) values
    (a1, student_user, 'Mihir Sanghvi', 'student', 'submitted', '', now() - interval '25 days'),
    (a1, mentor_user, 'Dr. Anagha Deshpande', 'faculty', 'comment',
      'Congratulations! Could you add the winners'' list from the SIH portal as well?', now() - interval '23 days'),
    (a1, student_user, 'Mihir Sanghvi', 'student', 'comment', 'Added the screenshot of the official results page.', now() - interval '22 days'),
    (a1, mentor_user, 'Dr. Anagha Deshpande', 'faculty', 'approved',
      'Verified with the SIH nodal centre. Well deserved — nominated for the Student Excellence Award.', now() - interval '20 days'),
    (a2, student_user, 'Mihir Sanghvi', 'student', 'submitted', '', now() - interval '10 days'),
    (a2, mentor_user, 'Dr. Anagha Deshpande', 'faculty', 'needs_info',
      'Please attach the presentation certificate and the DOI / proceedings link once it is out.', now() - interval '8 days'),
    (a3, student_user, 'Mihir Sanghvi', 'student', 'submitted', '', now() - interval '2 days');

  insert into public.student_grades (student_id, group_id, title, score, max_score, improvements, graded_by, created_at)
  values ('s-2201', gid, 'Achievement bonus — 1st Prize — Smart India Hackathon 2026 (Software Edition)', 4, 5,
    'Verified with the SIH nodal centre. Well deserved — nominated for the Student Excellence Award.', 'f-301',
    now() - interval '20 days');
end $$;
