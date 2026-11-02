-- Split the PPT score into a midterm half and an endterm half, each /15.
-- ppt15 is kept as the average of whatever is set.
alter table public.group_grades
  add column if not exists ppt_mid numeric check (ppt_mid between 0 and 15),
  add column if not exists ppt_end numeric check (ppt_end between 0 and 15);

-- backfill: whatever is in ppt15 goes to ppt_mid (one-time)
update public.group_grades set ppt_mid = ppt15 where ppt_mid is null and ppt15 is not null;

-- drop the old RPC and recreate with ppt_mid + ppt_end
drop function if exists public.save_group_grades(uuid, numeric, numeric, numeric, numeric, numeric, numeric);

create or replace function public.save_group_grades(
  p_group uuid, p_s1 numeric, p_s2 numeric, p_weekly numeric,
  p_ppt_mid numeric, p_ppt_end numeric, p_design numeric, p_ete numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_ppt numeric;
begin
  if not (app_private.mentors_group(p_group) or app_private.is_admin()) then
    raise exception 'Only this group''s supervisor can save its final grading.';
  end if;
  if p_s1 is not null and p_s1 not between 0 and 10 then raise exception 'Synopsis 1 is out of range.'; end if;
  if p_s2 is not null and p_s2 not between 0 and 10 then raise exception 'Synopsis 2 is out of range.'; end if;
  if p_weekly is not null and p_weekly not between 0 and 15 then raise exception 'Weekly is out of range.'; end if;
  if p_ppt_mid is not null and p_ppt_mid not between 0 and 15 then raise exception 'Midterm PPT is out of range.'; end if;
  if p_ppt_end is not null and p_ppt_end not between 0 and 15 then raise exception 'Endterm PPT is out of range.'; end if;
  if p_design is not null and p_design not between 0 and 20 then raise exception 'Design is out of range.'; end if;
  if p_ete is not null and p_ete not between 0 and 40 then raise exception 'ETE is out of range.'; end if;

  v_ppt := case
    when p_ppt_mid is null and p_ppt_end is null then null
    when p_ppt_mid is null then p_ppt_end
    when p_ppt_end is null then p_ppt_mid
    else round(((p_ppt_mid + p_ppt_end) / 2.0)::numeric, 2)
  end;

  insert into public.group_grades (
    group_id, synopsis1, synopsis2, weekly15, ppt_mid, ppt_end, ppt15, design20, ete40, updated_by
  )
  values (p_group, p_s1, p_s2, p_weekly, p_ppt_mid, p_ppt_end, v_ppt, p_design, p_ete, auth.uid())
  on conflict (group_id) do update
    set synopsis1 = excluded.synopsis1,
        synopsis2 = excluded.synopsis2,
        weekly15 = excluded.weekly15,
        ppt_mid = excluded.ppt_mid,
        ppt_end = excluded.ppt_end,
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

revoke execute on function public.save_group_grades(uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.save_group_grades(uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;
