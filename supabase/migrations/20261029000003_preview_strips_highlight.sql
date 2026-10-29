-- Notification previews also drop the ==green highlight== mark.

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
    '\*\*|==|\|', ' ', 'g'),
  '\s+', ' ', 'g')), 140)
$$;
