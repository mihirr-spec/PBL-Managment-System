-- Removing a student who is their team's lead picks a remaining teammate
-- (at random) to take over, and clears the references that would otherwise
-- block the row from being deleted: their open tickets, and their name on
-- any report or milestone they submitted.

create or replace function app_private.on_student_deleting()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  new_lead text;
begin
  for g in select * from public.groups where leader_student_id = old.id
  loop
    select gm.student_id into new_lead
    from public.group_members gm
    where gm.group_id = g.id and gm.student_id <> old.id
    order by random()
    limit 1;
    if new_lead is not null then
      update public.groups set leader_student_id = new_lead where id = g.id;
      update public.group_members set team_role = 'Team Lead'
      where group_id = g.id and student_id = new_lead;
    end if;
  end loop;

  delete from public.tickets where student_id = old.id;
  update public.weekly_reports set submitted_by = null where submitted_by = old.id;
  update public.group_milestones set submitted_by = null where submitted_by = old.id;
  return old;
end $$;

create trigger on_student_deleting before delete on public.students
for each row execute function app_private.on_student_deleting();
