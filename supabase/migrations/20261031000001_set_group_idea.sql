-- The project idea is normally saved with the team on creation, but a team made
-- before that field existed has an empty idea. Let its lead backfill it so the
-- supervisor's dashboard can always show what the team plans to build.

create or replace function public.set_group_idea(p_idea text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid := app_private.my_group_id();
begin
  if gid is null then raise exception 'Form or join a group first.'; end if;
  if (select leader_student_id from public.groups where id = gid) is distinct from app_private.my_student_id() then
    raise exception 'Only the team lead can edit the project idea.';
  end if;
  update public.groups set project_idea = coalesce(trim(p_idea), '') where id = gid;
end $$;

revoke execute on function public.set_group_idea(text) from public, anon;
grant execute on function public.set_group_idea(text) to authenticated;
