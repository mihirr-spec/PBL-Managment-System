-- Students write weekly reports directly (row level security limits them to
-- their own group, ungraded weeks). The `files` column added for multi-file
-- uploads was missing from the columns they may write, so every submission
-- failed with "permission denied for table weekly_reports".
grant insert (files) on public.weekly_reports to authenticated;
grant update (files) on public.weekly_reports to authenticated;
