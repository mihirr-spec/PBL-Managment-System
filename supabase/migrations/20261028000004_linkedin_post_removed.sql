-- A LinkedIn post can be taken back. When a post is deleted (on LinkedIn, or
-- with "Remove from LinkedIn" in the portal) the achievement keeps its
-- approval but loses the post, and goes back to the supervisor's "Action
-- needed" list so it can be posted again.

alter table public.achievements add column if not exists linkedin_removed_at timestamptz;

alter table public.achievement_events drop constraint if exists achievement_events_action_check;
alter table public.achievement_events add constraint achievement_events_action_check
  check (action in ('submitted', 'resubmitted', 'comment', 'needs_info', 'approved', 'rejected', 'posted', 'unposted'));

-- Posting again clears the "removed" mark.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.record_linkedin_post(uuid, text)'::regprocedure);
  if position('linkedin_posted_at = now(),' in d) = 0 then
    raise exception 'record_linkedin_post has changed; update this migration.';
  end if;
  d := replace(d, 'linkedin_posted_at = now(),', 'linkedin_posted_at = now(),
    linkedin_removed_at = null,');
  execute d;
end $$;

/** The post is gone from LinkedIn: forget it and put the achievement back in the supervisor's list. */
create or replace function public.unrecord_linkedin_post(p_achievement uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.achievements;
  reviewer uuid;
begin
  select * into a from public.achievements where id = p_achievement for update;
  if a.id is null or coalesce(app_private.achievement_party(a), '') not in ('reviewer', 'admin') then
    raise exception 'Only the student''s supervisor or the administrator can change this post.';
  end if;
  if a.linkedin_post_urn is null then return; end if;

  update public.achievements set
    linkedin_post_urn = null,
    linkedin_posted_at = null,
    linkedin_posted_by = null,
    linkedin_removed_at = now()
  where id = a.id;

  perform app_private.log_achievement(a.id, 'unposted', p_note);
  reviewer := app_private.faculty_user_id(a.faculty_id);
  if reviewer is not null and reviewer <> auth.uid() then
    perform app_private.notify(array[reviewer], 'achievement',
      'LinkedIn post removed: ' || a.title, 'It is back in your Action needed list to post again.', '/faculty/achievements');
  end if;
end $$;

revoke execute on function public.unrecord_linkedin_post from public, anon;
grant execute on function public.unrecord_linkedin_post to authenticated;
