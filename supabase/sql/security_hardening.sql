-- Security hardening for KnowYourFaculty. Review, then apply once in the Supabase SQL editor.
-- Written against the live schema as read on 2026-11-18 (RLS on, owner policies use "userId" = auth.uid()).
-- Fixes: any signed-in Google account could write courses and read every website_feedback row (emails);
-- nothing server-side enforced the student-domain rule; closed or out-of-range poll votes were accepted;
-- delete_my_account left website_feedback (email) behind; anon/authenticated had far more table
-- privileges than the app uses.
-- Rollback: this file is one transaction; re-create the old policies from the pg_policies export if needed.

begin;

-- 1. Allow-list and admin lists (server-side copy of VITE_EXPLICIT_ALLOWED_EMAILS / VITE_ADMIN_EMAILS).
create table if not exists public.allowed_emails (email text primary key check (email = lower(email)));
create table if not exists public.app_admins (email text primary key check (email = lower(email)));
alter table public.allowed_emails enable row level security;
alter table public.app_admins enable row level security;
revoke all on public.allowed_emails, public.app_admins from anon, authenticated;
insert into public.app_admins (email) values ('venu.23bcb7175@vitapstudent.ac.in') on conflict do nothing;
-- (VITE_EXPLICIT_ALLOWED_EMAILS is empty: only the student domain is allowed)

-- 2. Identity helpers. Same rule as src/lib/firebase/auth.js: explicit list, or the student domain
--    without the ".NNphd" local-part marker.
create or replace function public.is_app_user() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    exists (select 1 from public.allowed_emails a where a.email = lower(auth.jwt() ->> 'email'))
    or (
      lower(auth.jwt() ->> 'email') ~ '^[^@]+@vitapstudent\.ac\.in$'
      and split_part(lower(auth.jwt() ->> 'email'), '@', 1) !~ '\.\d{2}phd'
    ),
    false)
$$;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.app_admins a where a.email = lower(auth.jwt() ->> 'email'))
$$;

revoke execute on function public.is_app_user(), public.is_app_admin() from public;
grant execute on function public.is_app_user(), public.is_app_admin() to anon, authenticated;

-- 3. Writes require an allowed student; deletes of own rows stay open so anyone can leave.
drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews for insert to authenticated
  with check ("userId" = auth.uid() and public.is_app_user());
drop policy if exists "reviews update own" on public.reviews;
create policy "reviews update own" on public.reviews for update to authenticated
  using ("userId" = auth.uid()) with check ("userId" = auth.uid() and public.is_app_user());
drop policy if exists "reviews delete admin" on public.reviews;
create policy "reviews delete admin" on public.reviews for delete to authenticated
  using (public.is_app_admin());

drop policy if exists "polls insert own" on public.polls;
create policy "polls insert own" on public.polls for insert to authenticated
  with check ("userId" = auth.uid() and public.is_app_user());
drop policy if exists "polls update own" on public.polls;
create policy "polls update own" on public.polls for update to authenticated
  using ("userId" = auth.uid()) with check ("userId" = auth.uid() and public.is_app_user());

drop policy if exists "poll votes insert own" on public.poll_votes;
create policy "poll votes insert own" on public.poll_votes for insert to authenticated
  with check ("userId" = auth.uid() and public.is_app_user());
drop policy if exists "poll votes update own" on public.poll_votes;
create policy "poll votes update own" on public.poll_votes for update to authenticated
  using ("userId" = auth.uid()) with check ("userId" = auth.uid() and public.is_app_user());

-- 4. Courses: admin-only writes (was: any authenticated user, "true").
drop policy if exists "courses authenticated write" on public.courses;
drop policy if exists "courses admin write" on public.courses;
create policy "courses admin write" on public.courses for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- 5. website_feedback: own row, or admin (was: every authenticated user could read every row incl. emails).
drop policy if exists "website_feedback_select_all" on public.website_feedback;
drop policy if exists "website_feedback_select_own_or_admin" on public.website_feedback;
create policy "website_feedback_select_own_or_admin" on public.website_feedback for select to authenticated
  using (auth.uid() = auth_user_id or public.is_app_admin());
drop policy if exists "website_feedback_insert_own" on public.website_feedback;
create policy "website_feedback_insert_own" on public.website_feedback for insert to authenticated
  with check (auth.uid() = auth_user_id and public.is_app_user());
drop policy if exists "website_feedback_update_own" on public.website_feedback;
create policy "website_feedback_update_own" on public.website_feedback for update to authenticated
  using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id and public.is_app_user());

-- 6. Poll votes: only on an open poll, inside its window, within the poll's option range.
create or replace function public.poll_votes_validate() returns trigger
language plpgsql set search_path = public as $$
declare p public.polls%rowtype;
begin
  select * into p from public.polls where id = new."pollId";
  if not found then raise exception 'Poll not found'; end if;
  if not coalesce(p."isActive", false) then raise exception 'Poll is not active'; end if;
  if p."pollStartTime" is not null and now() < p."pollStartTime" then raise exception 'Poll has not started'; end if;
  if p."pollEndTime" is not null and now() > p."pollEndTime" then raise exception 'Poll has ended'; end if;
  if new.vote > p."pollType"::int then raise exception 'Vote is out of range for this poll'; end if;
  return new;
end $$;
drop trigger if exists poll_votes_validate on public.poll_votes;
create trigger poll_votes_validate before insert or update on public.poll_votes
  for each row execute function public.poll_votes_validate();

-- 7. Account deletion also removes the email-bearing website_feedback row.
create or replace function public.delete_my_account() returns boolean
language plpgsql security definer set search_path to 'public', 'auth' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.poll_votes where "userId" = uid;
  delete from public.polls where "userId" = uid;
  delete from public.reviews where "userId" = uid;
  delete from public.website_feedback where auth_user_id = uid;
  delete from auth.users where id = uid;

  return true;
end;
$$;

-- 8. Table privileges: the app only needs reads for anon and RLS-checked writes for authenticated.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on public.faculty from authenticated;

commit;
