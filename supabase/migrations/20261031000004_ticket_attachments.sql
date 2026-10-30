-- Files attached to a student query: screenshots, PDFs, certificates. The
-- files themselves go in the private `submissions` bucket, already readable
-- by the ticket's group and staff; this table records which belong to which
-- ticket so the query pages can list and count them.

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  unique (ticket_id, file_path)
);

alter table public.ticket_attachments enable row level security;

create policy "attachments: the ticket's group and staff" on public.ticket_attachments
  for select to authenticated
  using (
    exists (select 1 from public.tickets t
            join public.group_members gm on gm.group_id = t.group_id
            where t.id = ticket_id and gm.student_id = app_private.my_student_id())
    or (
      app_private.is_staff()
      and exists (select 1 from public.tickets t
                  join public.groups g on g.id = t.group_id
                  where t.id = ticket_id
                    and (app_private.mentors_group(g.id) or app_private.is_admin()))
    )
  );

create policy "attachments: the student who raised the ticket adds files" on public.ticket_attachments
  for insert to authenticated
  with check (
    exists (select 1 from public.tickets t
            where t.id = ticket_id and t.student_id = app_private.my_student_id())
  );
