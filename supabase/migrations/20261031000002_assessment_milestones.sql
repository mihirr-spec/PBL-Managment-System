-- Semester assessment: eight weekly reports plus two milestone phases, and a
-- final-grading window that adds up to 100.
--
-- Midterm (after week 3): the analysis PPT and a synopsis.
-- Endterm (after week 7): the updated PPT and the updated synopsis.
--
-- The 100 points:
--   Internal assessment (60)
--     Updated synopsis            10   (the two synopsis marks average to 10)
--     Weekly progress report      15   (average of the 8 weekly /10 grades,
--                                       times 1.5; the supervisor may override)
--     Analysis process PPT       15
--     Design & implementation    20
--   End term exam                40
--   Total                       100

alter table public.groups alter column report_count set default 8;
update public.groups set report_count = 8 where report_count <> 8;

-- ---------------------------------------------------------- final grading
-- Built first: the milestone rules below keep files editable until this row
-- exists for the group.

create table public.group_grades (
  group_id uuid primary key references public.groups (id) on delete cascade,
  synopsis1 numeric check (synopsis1 between 0 and 10),
  synopsis2 numeric check (synopsis2 between 0 and 10),
  weekly15 numeric check (weekly15 between 0 and 15),
  ppt15 numeric check (ppt15 between 0 and 15),
  design20 numeric check (design20 between 0 and 20),
  ete40 numeric check (ete40 between 0 and 40),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.group_grades enable row level security;

create policy "grades: the group's members" on public.group_grades
  for select to authenticated
  using (
    exists (select 1 from public.group_members gm
            where gm.group_id = group_id and gm.student_id = app_private.my_student_id())
  );

create policy "grades: the group's supervisor or admin" on public.group_grades
  for select to authenticated
  using (
    app_private.is_staff()
    and (app_private.mentors_group(group_id) or app_private.is_admin())
  );

/** Saves one group's final grading. Weekly may be left out to keep the
 *  average of the eight weekly grades; the supervisor may set it by hand. */
create or replace function public.save_group_grades(
  p_group uuid, p_s1 numeric, p_s2 numeric, p_weekly numeric,
  p_ppt numeric, p_design numeric, p_ete numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (app_private.mentors_group(p_group) or app_private.is_admin()) then
    raise exception 'Only this group''s supervisor can save its final grading.';
  end if;
  if p_s1 is not null and p_s1 not between 0 and 10 then raise exception 'Synopsis 1 is out of range.'; end if;
  if p_s2 is not null and p_s2 not between 0 and 10 then raise exception 'Synopsis 2 is out of range.'; end if;
  if p_weekly is not null and p_weekly not between 0 and 15 then raise exception 'Weekly is out of range.'; end if;
  if p_ppt is not null and p_ppt not between 0 and 15 then raise exception 'PPT is out of range.'; end if;
  if p_design is not null and p_design not between 0 and 20 then raise exception 'Design is out of range.'; end if;
  if p_ete is not null and p_ete not between 0 and 40 then raise exception 'ETE is out of range.'; end if;

  insert into public.group_grades (group_id, synopsis1, synopsis2, weekly15, ppt15, design20, ete40, updated_by)
  values (p_group, p_s1, p_s2, p_weekly, p_ppt, p_design, p_ete, auth.uid())
  on conflict (group_id) do update
    set synopsis1 = excluded.synopsis1,
        synopsis2 = excluded.synopsis2,
        weekly15 = excluded.weekly15,
        ppt15 = excluded.ppt15,
        design20 = excluded.design20,
        ete40 = excluded.ete40,
        updated_by = excluded.updated_by,
        updated_at = now();

  perform app_private.notify(
    app_private.group_user_ids(p_group), 'grade',
    'Final grading saved for your group',
    'The supervisor has saved the 100-point assessment. See your grades.',
    '/student/grades');
end $$;

revoke execute on function public.save_group_grades(uuid, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.save_group_grades(uuid, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------- milestones

create table public.group_milestones (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  slot text not null check (slot in ('mid_ppt', 'mid_synopsis', 'ete_ppt', 'ete_synopsis')),
  file_path text,
  file_name text,
  submitted_by text references public.students (id),
  submitted_at timestamptz not null default now(),
  unique (group_id, slot)
);

alter table public.group_milestones enable row level security;

create policy "milestones: my group's members" on public.group_milestones
  for select to authenticated
  using (
    exists (select 1 from public.group_members gm
            where gm.group_id = group_id and gm.student_id = app_private.my_student_id())
  );

create policy "milestones: my group's supervisor or admin" on public.group_milestones
  for select to authenticated
  using (
    app_private.is_staff()
    and (app_private.mentors_group(group_id) or app_private.is_admin())
  );

-- The team lead uploads, and may replace a file, until the final grading is saved.
create policy "milestones: team lead before final grading" on public.group_milestones
  for insert to authenticated
  with check (
    exists (select 1 from public.groups g
            where g.id = group_id
              and g.leader_student_id = app_private.my_student_id())
    and not exists (select 1 from public.group_grades where group_id = group_id)
  );

create policy "milestones: team lead may replace before grading" on public.group_milestones
  for update to authenticated
  using (
    exists (select 1 from public.groups g
            where g.id = group_id
              and g.leader_student_id = app_private.my_student_id())
    and not exists (select 1 from public.group_grades where group_id = group_id)
  );

/** Uploads (or replaces) one milestone file for the caller's own group. */
create or replace function public.submit_milestone(p_slot text, p_file_path text, p_file_name text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid := app_private.my_group_id();
begin
  if gid is null then raise exception 'Form or join a group first.'; end if;
  if p_slot not in ('mid_ppt', 'mid_synopsis', 'ete_ppt', 'ete_synopsis') then
    raise exception 'Unknown milestone slot.';
  end if;
  if exists (select 1 from public.group_grades where group_id = gid) then
    raise exception 'The final grading is saved, so milestones can no longer be changed.';
  end if;
  insert into public.group_milestones (group_id, slot, file_path, file_name, submitted_by)
  values (gid, p_slot, p_file_path, p_file_name, app_private.my_student_id())
  on conflict (group_id, slot) do update
    set file_path = excluded.file_path, file_name = excluded.file_name,
        submitted_by = excluded.submitted_by, submitted_at = now();
end $$;

revoke execute on function public.submit_milestone(text, text, text) from public, anon;
grant execute on function public.submit_milestone(text, text, text) to authenticated;
