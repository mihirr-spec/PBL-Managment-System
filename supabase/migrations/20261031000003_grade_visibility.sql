-- Publishing the final grading: a saved 100-point score stays hidden from the
-- students until the supervisor publishes it, and publishing is refused until
-- every group the supervisor mentors has a saved grading. The supervisor can
-- also correct an individual student's mark after entering it.

alter table public.group_grades
  add column visible boolean not null default false;

-- Students only see a grading that has been published.
drop policy "grades: the group's members" on public.group_grades;
create policy "grades: the group's members, published only" on public.group_grades
  for select to authenticated
  using (
    visible
    and exists (select 1 from public.group_members gm
                where gm.group_id = group_id and gm.student_id = app_private.my_student_id())
  );

/** Makes the group's saved grading visible to its students. The supervisor
 *  must have saved a grading for every group they mentor first; the PBL
 *  office is exempt from that check. */
create or replace function public.publish_group_grades(p_group uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (app_private.mentors_group(p_group) or app_private.is_admin()) then
    raise exception 'Only this group''s supervisor can publish its grading.';
  end if;
  if not exists (select 1 from public.group_grades where group_id = p_group) then
    raise exception 'Save the grading for this group before publishing it.';
  end if;
  if not app_private.is_admin() then
    if exists (
      select 1 from public.groups g
      where g.mentor_id = (select mentor_id from public.groups where id = p_group)
        and g.mentor_id is not null
        and not exists (select 1 from public.group_grades gg where gg.group_id = g.id)
    ) then
      raise exception 'Grade every group you supervise before publishing scores to the students.';
    end if;
  end if;
  update public.group_grades set visible = true where group_id = p_group;

  perform app_private.notify(
    app_private.group_user_ids(p_group), 'grade',
    'Your final grading is now available',
    'The 100-point assessment has been published. See your grades.',
    '/student/grades');
end $$;

revoke execute on function public.publish_group_grades(uuid) from public, anon;
grant execute on function public.publish_group_grades(uuid) to authenticated;

/** Corrects one student's existing mark. The student's own group's supervisor
 *  (or the PBL office) may change the score or the note on what to improve. */
create or replace function public.update_student_grade(p_grade uuid, p_score numeric, p_improvements text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.student_grades;
begin
  select * into r from public.student_grades where id = p_grade;
  if r.id is null then raise exception 'No such grade.'; end if;
  if not (app_private.mentors_group(r.group_id) or app_private.is_admin()) then
    raise exception 'Only this student''s supervisor can edit their grade.';
  end if;
  if p_score is not null and (p_score < 0 or p_score > r.max_score) then
    raise exception 'Score must be between 0 and %.', r.max_score;
  end if;
  update public.student_grades
  set score = coalesce(p_score, score),
      improvements = coalesce(p_improvements, improvements)
  where id = p_grade;
end $$;

revoke execute on function public.update_student_grade(uuid, numeric, text) from public, anon;
grant execute on function public.update_student_grade(uuid, numeric, text) to authenticated;
