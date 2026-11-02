-- Per-student override of the final /100. The group's shared total still
-- comes from `group_grades`; this column lets the supervisor adjust an
-- individual student up or down based on their contribution.
alter table public.group_members add column if not exists final_override numeric check (final_override between 0 and 150);

create or replace function public.set_student_final(p_student text, p_override numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_group uuid;
begin
  select group_id into v_group from public.group_members where student_id = p_student;
  if v_group is null then raise exception 'This student is not in a group.'; end if;
  if not (app_private.mentors_group(v_group) or app_private.is_admin()) then
    raise exception 'Only this group''s supervisor can set a student''s final.';
  end if;
  if p_override is not null and p_override not between 0 and 150 then
    raise exception 'Final is out of range.';
  end if;
  update public.group_members set final_override = p_override where student_id = p_student;
end $$;

revoke execute on function public.set_student_final(text, numeric) from public, anon;
grant execute on function public.set_student_final(text, numeric) to authenticated;

-- The semester has seven weekly reports plus the midterm and endterm phases.
alter table public.groups alter column report_count set default 7;
