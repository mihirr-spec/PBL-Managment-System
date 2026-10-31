-- Seven weekly reports per team: the ETE evaluation after week 7 is the last
-- one, and the final score is worked out from there. No week-8 report exists.
alter table public.groups alter column report_count set default 7;
update public.groups set report_count = 7 where report_count <> 7;
