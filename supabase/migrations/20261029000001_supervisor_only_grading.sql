-- Grading and the number of weekly reports belong to the team's supervisor.
-- The administrator oversees supervisors and makes announcements, but does not grade.

create or replace function public.grade_report(p_report uuid, p_grade numeric, p_feedback text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare gid uuid;
begin
  select group_id into gid from public.weekly_reports where id = p_report;
  if gid is null or not app_private.mentors_group(gid) then
    raise exception 'Only this group''s supervisor can grade its reports.';
  end if;
  update public.weekly_reports
  set grade = p_grade, feedback = coalesce(p_feedback, ''), graded_at = now()
  where id = p_report;
end $function$;

create or replace function public.grade_student(p_student text, p_title text, p_score numeric, p_max numeric, p_improvements text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare gid uuid;
begin
  select group_id into gid from public.group_members where student_id = p_student;
  if gid is null or not app_private.mentors_group(gid) then
    raise exception 'Only this student''s supervisor can grade them.';
  end if;
  if p_score < 0 or p_score > p_max then raise exception 'Score must be between 0 and %.', p_max; end if;
  insert into public.student_grades (student_id, group_id, title, score, max_score, improvements, graded_by)
  values (p_student, gid, trim(p_title), p_score, p_max, coalesce(p_improvements, ''), app_private.my_faculty_id());
end $function$;

create or replace function public.set_report_count(p_group uuid, p_count integer)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not app_private.mentors_group(p_group) then
    raise exception 'Only this group''s supervisor can change the number of reports.';
  end if;
  if p_count not between 1 and 10 then raise exception 'Choose between 1 and 10 reports.'; end if;
  update public.groups set report_count = p_count where id = p_group;
  perform app_private.refresh_progress(p_group);
end $function$;
