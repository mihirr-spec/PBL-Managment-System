-- Staff (team supervisors and the administrator) can set their own profile
-- photo too. Students keep theirs on the students row; this sets the photo on
-- the caller's profiles row and, for a supervisor, on their faculty row. The
-- URL must point into the caller's own folder of the public avatars bucket.

create or replace function public.set_my_avatar(p_url text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_url is not null and position('/storage/v1/object/public/avatars/' || auth.uid()::text || '/' in p_url) = 0 then
    raise exception 'That photo is not in your own folder.';
  end if;
  update public.profiles set avatar_url = p_url where id = auth.uid();
  update public.faculty set avatar_url = p_url where user_id = auth.uid();
end $$;

revoke execute on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
