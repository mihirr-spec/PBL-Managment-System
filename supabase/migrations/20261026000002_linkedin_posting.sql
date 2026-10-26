-- Posting approved achievements straight to LinkedIn.
--
-- A supervisor (or the PBL office) connects their own LinkedIn account once
-- (OAuth, scopes openid profile w_member_social); the portal keeps the access
-- token here and posts on their behalf from the achievement preview. The
-- LinkedIn app's client secret never reaches the browser: the exchange and
-- the post happen in the Next.js route handlers under src/app/api/linkedin.

create table public.linkedin_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- urn:li:person:<sub>
  member_urn text not null,
  name text not null default '',
  picture text,
  access_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now()
);

alter table public.linkedin_accounts enable row level security;
revoke all on public.linkedin_accounts from anon;

-- Only the owner sees or changes their connection.
create policy "own linkedin connection" on public.linkedin_accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------- posted achievements

alter table public.achievements
  add column linkedin_post_urn text,
  add column linkedin_posted_at timestamptz,
  add column linkedin_posted_by text;

alter table public.achievement_events drop constraint if exists achievement_events_action_check;
alter table public.achievement_events add constraint achievement_events_action_check
  check (action in ('submitted', 'resubmitted', 'comment', 'needs_info', 'approved', 'rejected', 'posted'));

/** Records that an approved achievement went out on LinkedIn (called by /api/linkedin/post). */
create or replace function public.record_linkedin_post(p_achievement uuid, p_urn text) returns void
language plpgsql security definer set search_path = ''
as $$
declare a public.achievements;
begin
  select * into a from public.achievements where id = p_achievement;
  if a.id is null or coalesce(app_private.achievement_party(a), '') not in ('reviewer', 'admin') then
    raise exception 'Only the student''s supervisor or the PBL office can post this achievement.';
  end if;
  if a.status <> 'approved' then raise exception 'Only approved achievements can be posted.'; end if;
  if coalesce(trim(p_urn), '') = '' then raise exception 'The LinkedIn post id is missing.'; end if;

  update public.achievements set
    linkedin_post_urn = trim(p_urn),
    linkedin_posted_at = now(),
    linkedin_posted_by = (select display_name from public.profiles where id = auth.uid())
  where id = a.id;

  perform app_private.log_achievement(a.id, 'posted', '');
  perform app_private.notify(array[(select user_id from public.students where id = a.student_id)], 'achievement',
    'Your achievement is on LinkedIn: ' || a.title, 'Posted from the PBL portal.', '/student/achievements');
end $$;

revoke execute on function public.record_linkedin_post from public, anon;
grant execute on function public.record_linkedin_post to authenticated;
