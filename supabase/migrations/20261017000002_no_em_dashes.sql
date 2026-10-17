-- No em dashes anywhere: in the messages the database functions write, or in
-- stored text. " <em dash> " becomes " - ", any other em dash becomes "-".
-- The em dash is written as chr(8212) so this file contains none itself.

-- Functions: recreate each one whose body has an em dash. This also keeps the
-- "Achievement bonus - " title in review_achievement and on_grade in step.
do $$
declare
  f record;
  d text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private') and p.prosrc like '%' || chr(8212) || '%'
  loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, ' ' || chr(8212) || ' ', ' - ');
    d := replace(d, chr(8212), '-');
    execute d;
  end loop;
end $$;

-- Stored text and jsonb in every public table.
do $$
declare
  c record;
  dash text := chr(8212);
begin
  for c in
    select table_name, column_name, data_type from information_schema.columns
    where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb')
  loop
    execute format(
      'update public.%1$I set %2$I = replace(replace(%2$I::text, %3$L, %4$L), %5$L, %6$L)::%7$s where %2$I::text like %8$L',
      c.table_name, c.column_name, ' ' || dash || ' ', ' - ', dash, '-',
      case when c.data_type = 'jsonb' then 'jsonb' else 'text' end, '%' || dash || '%');
  end loop;
end $$;
