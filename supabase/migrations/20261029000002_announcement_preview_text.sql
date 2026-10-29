-- Announcements can now carry formatting (**bold**, lists, [links](url), | tables |).
-- The notification preview shows the plain words, without those marks.

create or replace function app_private.plain_preview(p_body text)
returns text
language sql
immutable
set search_path to ''
as $$
  select left(trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p_body, ''), '\[([^]]+)\]\([^)]*\)', '\1', 'g'),
        '^\s*\|?\s*:?-{2,}[-|: ]*$', '', 'gn'),
      '^\s*(#{1,3}|[-*]|\d+[.)])\s+', '', 'gn'),
    '\*\*|\|', ' ', 'g'),
  '\s+', ' ', 'g')), 140)
$$;

create or replace function app_private.on_announcement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare targets uuid[];
begin
  if new.scope = 'all' then
    select coalesce(array_agg(user_id), '{}') into targets from public.students where user_id is not null;
  else
    select coalesce(array_agg(s.user_id), '{}') into targets
    from public.groups g
    join public.group_members gm on gm.group_id = g.id
    join public.students s on s.id = gm.student_id
    where g.mentor_id = new.faculty_id and s.user_id is not null;
  end if;
  perform app_private.notify(targets, 'announcement',
    'New from ' || new.posted_by_name || ': ' || new.title,
    case when new.attachment_name is not null then 'Includes a file: ' || new.attachment_name
         else app_private.plain_preview(new.body) end,
    '/student/notifications');
  return new;
end $function$;
