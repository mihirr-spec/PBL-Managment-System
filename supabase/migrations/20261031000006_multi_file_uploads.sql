-- Every upload slot accepts several files, picked together in one go.
--
-- mentor_requests, weekly_reports and group_milestones each gain a
-- `files` array ([{"path": "<group id>/<folder>/<file>", "name": "..."}]).
-- The old single-file columns stay filled with the first file, so anything
-- that still reads them keeps working.

alter table public.mentor_requests add column files jsonb not null default '[]'::jsonb;
alter table public.weekly_reports add column files jsonb not null default '[]'::jsonb;
alter table public.group_milestones add column files jsonb not null default '[]'::jsonb;

update public.mentor_requests
set files = jsonb_build_array(jsonb_build_object('path', form_path, 'name', form_name))
where form_path is not null and form_path <> '' and files = '[]'::jsonb;

update public.weekly_reports
set files = jsonb_build_array(jsonb_build_object('path', file_path, 'name', file_name))
where file_path is not null and file_path <> '' and files = '[]'::jsonb;

update public.group_milestones
set files = jsonb_build_array(jsonb_build_object('path', file_path, 'name', file_name))
where file_path is not null and file_path <> '' and files = '[]'::jsonb;

/** The group's own folder only, for every path in the set. */
create or replace function app_private.check_files(gid uuid, p_files jsonb)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  f jsonb;
begin
  if p_files is null or jsonb_array_length(p_files) = 0 then
    raise exception 'Upload the signed PBL form first.';
  end if;
  for f in select * from jsonb_array_elements(p_files)
  loop
    if coalesce(f ->> 'path', '') = '' or coalesce(f ->> 'name', '') = '' then
      raise exception 'One of the uploaded files is incomplete.';
    end if;
    if split_part(f ->> 'path', '/', 1) <> gid::text then
      raise exception 'The files must be uploaded to your group''s folder.';
    end if;
  end loop;
end $$;

revoke execute on function app_private.check_files(uuid, jsonb) from public, anon, authenticated;

/* ------------------------------------------------- mentor requests */

drop function public.request_mentor(text, text, text, text);

create or replace function public.request_mentor(p_faculty_id text, p_message text, p_files jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare gid uuid := app_private.require_leader();
begin
  if (select mentor_id from public.groups where id = gid) is not null then
    raise exception 'Your group already has a mentor.';
  end if;
  perform app_private.check_files(gid, p_files);
  if exists (select 1 from public.mentor_requests
             where group_id = gid and faculty_id = p_faculty_id and app_private.is_open_request(status)) then
    raise exception 'You already have an open request with this teacher.';
  end if;
  if (select count(*) from public.mentor_requests
      where group_id = gid and app_private.is_open_request(status)) >= 3 then
    raise exception 'You can have at most 3 open requests at a time.';
  end if;
  insert into public.mentor_requests (group_id, faculty_id, message, form_path, form_name, files)
  values (gid, p_faculty_id, coalesce(p_message, ''),
    p_files -> 0 -> 'path' ->> 0, p_files -> 0 -> 'name' ->> 0, p_files);
end $$;

revoke execute on function public.request_mentor(text, text, jsonb) from public, anon;
grant execute on function public.request_mentor(text, text, jsonb) to authenticated;

drop function public.resubmit_mentor_request(uuid, text, text, text);

create or replace function public.resubmit_mentor_request(p_request uuid, p_message text, p_files jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid := app_private.require_leader();
  r public.mentor_requests;
begin
  select * into r from public.mentor_requests where id = p_request for update;
  if r.id is null or r.group_id <> gid then raise exception 'Request not found.'; end if;
  if r.status <> 'changes_requested' then
    raise exception 'This request is not waiting for changes.';
  end if;
  if (select mentor_id from public.groups where id = gid) is not null then
    raise exception 'Your group already has a mentor.';
  end if;
  perform app_private.check_files(gid, p_files);
  update public.mentor_requests
  set status = 'pending',
      form_path = p_files -> 0 -> 'path' ->> 0,
      form_name = p_files -> 0 -> 'name' ->> 0,
      files = p_files,
      message = coalesce(nullif(trim(p_message), ''), message),
      resubmitted_at = now(), decided_at = null
  where id = r.id;
end $$;

revoke execute on function public.resubmit_mentor_request(uuid, text, jsonb) from public, anon;
grant execute on function public.resubmit_mentor_request(uuid, text, jsonb) to authenticated;

/* -------------------------------------------------- milestone slots */

drop function public.submit_milestone(text, text, text);

/** Adds files to one milestone slot; the set grows, it is never lost. */
create or replace function public.submit_milestone(p_slot text, p_files jsonb)
returns void
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
  if (select leader_student_id from public.groups where id = gid) is distinct from app_private.my_student_id() then
    raise exception 'Only the team lead can upload milestone files.';
  end if;
  perform app_private.check_files(gid, p_files);
  insert into public.group_milestones (group_id, slot, file_path, file_name, files, submitted_by)
  values (gid, p_slot,
    p_files -> 0 -> 'path' ->> 0, p_files -> 0 -> 'name' ->> 0,
    p_files, app_private.my_student_id())
  on conflict (group_id, slot) do update
    set files = public.group_milestones.files || p_files,
        submitted_by = excluded.submitted_by,
        submitted_at = now();
end $$;

revoke execute on function public.submit_milestone(text, jsonb) from public, anon;
grant execute on function public.submit_milestone(text, jsonb) to authenticated;
