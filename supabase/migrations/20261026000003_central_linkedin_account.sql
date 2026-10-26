-- One central LinkedIn account posts every approved achievement, instead of
-- each teacher's own profile. The PBL office connects it once (signing in on
-- LinkedIn's page, so no one in the portal ever sees its password); teachers
-- only preview the post and click "Approve and post".
--
-- The access token is stored encrypted (AES-256-GCM) with a key that exists
-- only on the server (derived from the LinkedIn client secret), so even the
-- staff who may fetch the row through linkedin_credentials() get nothing usable.

drop table if exists public.linkedin_accounts;

create table app_private.linkedin_account (
  -- A single row.
  id boolean primary key default true check (id),
  member_urn text not null,
  name text not null default '',
  picture text,
  token_enc text not null,
  expires_at timestamptz not null,
  connected_by text not null default '',
  connected_at timestamptz not null default now()
);
revoke all on app_private.linkedin_account from public, anon, authenticated;

/** PBL office: saves (or replaces) the central account after "Connect LinkedIn". */
create or replace function public.save_linkedin_account(
  p_member_urn text, p_name text, p_picture text, p_token_enc text, p_expires_at timestamptz
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app_private.is_admin() then
    raise exception 'Only the PBL office can connect the portal''s LinkedIn account.';
  end if;
  insert into app_private.linkedin_account (id, member_urn, name, picture, token_enc, expires_at, connected_by, connected_at)
  values (true, p_member_urn, coalesce(p_name, ''), p_picture, p_token_enc, p_expires_at,
    coalesce((select display_name from public.profiles where id = auth.uid()), ''), now())
  on conflict (id) do update set
    member_urn = excluded.member_urn, name = excluded.name, picture = excluded.picture,
    token_enc = excluded.token_enc, expires_at = excluded.expires_at,
    connected_by = excluded.connected_by, connected_at = excluded.connected_at;
end $$;

/** Staff: which account posts go out from (no token), for the preview. */
create or replace function public.linkedin_account()
returns table (name text, picture text, expires_at timestamptz, connected_by text, connected_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select name, picture, expires_at, connected_by, connected_at
  from app_private.linkedin_account
  where app_private.is_staff()
$$;

/** Staff, through /api/linkedin/post: the encrypted token, only usable by the server. */
create or replace function public.linkedin_credentials()
returns table (member_urn text, token_enc text, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select member_urn, token_enc, expires_at
  from app_private.linkedin_account
  where app_private.is_staff()
$$;

/** PBL office: stop posting from the central account. */
create or replace function public.disconnect_linkedin_account() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app_private.is_admin() then
    raise exception 'Only the PBL office can disconnect the portal''s LinkedIn account.';
  end if;
  delete from app_private.linkedin_account;
end $$;

revoke execute on function public.save_linkedin_account, public.linkedin_account,
  public.linkedin_credentials, public.disconnect_linkedin_account from public, anon;
grant execute on function public.save_linkedin_account, public.linkedin_account,
  public.linkedin_credentials, public.disconnect_linkedin_account to authenticated;
