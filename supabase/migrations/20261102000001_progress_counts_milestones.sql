-- Progress matches the "Weekly reports" card: weekly reports plus the midterm
-- and endterm uploads, so a group owing seven reports has nine submissions.

create or replace function app_private.refresh_progress(gid uuid) returns void
language sql security definer set search_path = ''
as $$
  update public.groups g
  set progress = round(100.0 *
    (
      (select count(*) from public.weekly_reports r
       where r.group_id = g.id and r.week <= g.report_count)
      + (case when exists (select 1 from public.group_milestones m
            where m.group_id = g.id
              and m.slot in ('mid_ppt', 'mid_synopsis')
              and jsonb_array_length(m.files) > 0)
           then 1 else 0 end)
      + (case when exists (select 1 from public.group_milestones m
            where m.group_id = g.id
              and m.slot in ('ete_ppt', 'ete_synopsis')
              and jsonb_array_length(m.files) > 0)
           then 1 else 0 end)
    ) / (g.report_count + 2))
  where g.id = gid
$$;

-- Milestone uploads move the bar too, not only weekly reports.
create trigger milestone_progress
  after insert or update or delete on public.group_milestones
  for each row execute function app_private.on_report_progress();

-- Every group picked up the new formula right away.
do $$
declare g uuid;
begin
  for g in select id from public.groups loop
    perform app_private.refresh_progress(g);
  end loop;
end
$$;
