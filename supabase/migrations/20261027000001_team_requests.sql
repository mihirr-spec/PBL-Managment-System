-- Team requests, one teammate at a time.
--
-- The team lead sends each classmate a request with its own button: the first
-- one creates the team, later ones are added to it. A request goes only to a
-- classmate who has signed up on the portal. A student can hold several
-- requests; accepting one declines the rest, and those team leads are told.

-- Invites one classmate by registration number. Callers check who may invite.
create or replace function app_private.invite_student(gid uuid, p_reg text, p_name text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  s public.students;
  reg text := upper(trim(p_reg));
  leader_name text;
begin
  select * into g from public.groups where id = gid;
  select * into s from public.students where upper(registration_number) = reg;
  if s.id is null or s.user_id is null then
    raise exception 'No student with registration number % has signed up on PACE yet. Ask them to create an account first.', reg;
  end if;
  -- The typed name must start like the roster name, to catch a mistyped number.
  if coalesce(trim(p_name), '') <> ''
     and lower(split_part(trim(p_name), ' ', 1)) <> lower(split_part(trim(s.full_name), ' ', 1)) then
    raise exception 'Registration number % belongs to %, not %.', reg, s.full_name, trim(p_name);
  end if;
  if s.id = g.leader_student_id then raise exception 'You are already in this team.'; end if;
  if exists (select 1 from public.group_members where student_id = s.id) then
    raise exception '% (%) is already in a team.', s.full_name, reg;
  end if;
  if exists (select 1 from public.group_invitations
             where group_id = gid and student_id = s.id and status = 'pending') then
    raise exception '% already has your request.', s.full_name;
  end if;
  if (select count(*) from public.group_members where group_id = gid)
     + (select count(*) from public.group_invitations where group_id = gid and status = 'pending') >= 3 then
    raise exception 'A team has at most 3 students, counting pending requests.';
  end if;

  insert into public.group_invitations (group_id, student_id, invited_by)
  values (gid, s.id, g.leader_student_id);

  leader_name := (select full_name from public.students where id = g.leader_student_id);
  perform app_private.notify(array[s.user_id], 'group',
    leader_name || ' wants you in their team', g.project_title, '/student/requests');
end $$;
revoke execute on function app_private.invite_student from public, anon, authenticated;

-- Declines a student's other pending requests once they are in a team, and
-- tells each of those team leads.
create or replace function app_private.decline_other_invitations(p_student text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  my_name text := (select full_name from public.students where id = p_student);
  r record;
begin
  for r in
    update public.group_invitations i set status = 'declined', decided_at = now()
    from public.groups g
    where i.student_id = p_student and i.status = 'pending' and g.id = i.group_id
    returning g.name, g.leader_student_id
  loop
    perform app_private.notify(array[(select user_id from public.students where id = r.leader_student_id)],
      'group', my_name || ' joined another team', r.name, '/student/group');
  end loop;
end $$;
revoke execute on function app_private.decline_other_invitations from public, anon, authenticated;

-- The team is created with the first request, so it starts with one teammate
-- invited (or none, if the lead adds them later).
create or replace function public.create_group(
  p_name text, p_project_title text, p_project_idea text, p_domain text,
  p_member_regs text[], p_member_names text[] default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me text := app_private.my_student_id();
  gid uuid;
  n int := coalesce(array_length(p_member_regs, 1), 0);
begin
  if me is null then raise exception 'Only students can create teams.'; end if;
  if exists (select 1 from public.group_members where student_id = me) then
    raise exception 'You are already in a team.';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_project_title), '') = '' then
    raise exception 'Give your project a title.';
  end if;
  if n > 2 then
    raise exception 'A team has 2 or 3 students: you plus one or two teammates.';
  end if;

  insert into public.groups (name, project_title, project_idea, domain, leader_student_id)
  values (trim(p_name), trim(p_project_title), coalesce(p_project_idea, ''), coalesce(p_domain, ''), me)
  returning id into gid;
  insert into public.group_members (group_id, student_id, team_role) values (gid, me, 'Team Lead');

  -- Starting your own team answers the requests you had.
  perform app_private.decline_other_invitations(me);

  for i in 1 .. n loop
    perform app_private.invite_student(gid, p_member_regs[i], p_member_names[i]);
  end loop;
  return gid;
end $$;

-- Team lead: send one more classmate a request.
drop function public.invite_member(text);
create function public.invite_member(p_reg text, p_name text default null) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_private.invite_student(app_private.require_leader(), p_reg, p_name);
end $$;

create or replace function public.respond_to_invitation(p_invitation uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me text := app_private.my_student_id();
  i public.group_invitations;
  g public.groups;
  my_name text := (select full_name from public.students where id = me);
begin
  select * into i from public.group_invitations where id = p_invitation for update;
  if i.id is null or i.student_id is distinct from me then raise exception 'Request not found.'; end if;
  if i.status <> 'pending' then raise exception 'This request is no longer open.'; end if;
  select * into g from public.groups where id = i.group_id for update;

  if not p_accept then
    update public.group_invitations set status = 'declined', decided_at = now() where id = i.id;
    perform app_private.notify(array[(select user_id from public.students where id = g.leader_student_id)],
      'group', my_name || ' declined your request', g.name, '/student/group');
    return 'declined';
  end if;

  if exists (select 1 from public.group_members where student_id = me) then
    raise exception 'You are already in a team.';
  end if;
  if (select count(*) from public.group_members where group_id = g.id) >= 3 then
    raise exception 'This team is already full.';
  end if;

  insert into public.group_members (group_id, student_id) values (g.id, me);
  update public.group_invitations set status = 'accepted', decided_at = now() where id = i.id;
  -- One team per student: every other request is declined.
  perform app_private.decline_other_invitations(me);

  perform app_private.notify(
    array(select s.user_id from public.group_members gm join public.students s on s.id = gm.student_id
          where gm.group_id = g.id and gm.student_id <> me),
    'group', my_name || ' joined ' || g.name, g.project_title, '/student/group');
  return 'accepted';
end $$;

revoke execute on function public.create_group, public.invite_member from public, anon;
grant execute on function public.create_group, public.invite_member to authenticated;
