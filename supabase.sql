-- Obsazení organigramu ÚRÚ ČR – databázové tabulky
-- Spusťte v Supabase: SQL Editor → New query → Run

-- 1) Jediný řádek se stavem aplikace (organigram + lidé + obsazení)
create table if not exists organigram_state (
  id text primary key,
  data jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- 2) Historie změn (kdo, kdy, co)
create table if not exists organigram_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_email text,
  action text not null,
  detail text
);

alter table organigram_state enable row level security;
alter table organigram_log enable row level security;

-- Přístup mají jen přihlášení uživatelé (magic link); nepřihlášení nevidí nic.
create policy "state: authenticated full access" on organigram_state
  for all to authenticated using (true) with check (true);

create policy "log: authenticated read" on organigram_log
  for select to authenticated using (true);
create policy "log: authenticated insert" on organigram_log
  for insert to authenticated with check (true);

-- 3) Živé obnovení stavu v dalších otevřených oknech
alter publication supabase_realtime add table organigram_state;

-- 4) Role uživatelů (nepřihlášený/bez záznamu = plný admin přístup)
--    role: 'admin' (vše), 'it' (jen pohled IT), 'personalista' (přidávání/úprava/umisťování
--    osob jen v prostoru ÚRÚ ČR, bez úprav struktury a lokalit)
-- Záznamy se přidávají ručně v Table Editoru: email (přesně jako přihlašovací e-mail), role.
create table if not exists organigram_roles (
  email text primary key,
  role text not null default 'admin'
);
alter table organigram_roles enable row level security;
create policy "roles: authenticated read" on organigram_roles
  for select to authenticated using (true);

-- 5) Zjednodušený seznam obsazených osob ÚRÚ ČR – publikuje ho organigram při každém uložení.
--    Slouží jako zdroj pro onboarding (bez nutnosti ručního importu JSON): obsahuje jen jméno,
--    zdrojový úřad, pracoviště, lokalitu, nadřízeného a úvazek – nikoliv celou strukturu/historii.
--    Čtení je povoleno i nepřihlášeným (anon) – onboarding se připojuje samostatným anon klíčem
--    jen k tomuto projektu/tabulce, ne k organigram_state.
create table if not exists organigram_roster (
  person_id text primary key,
  name text not null,
  src text,
  unit_path text,
  position_label text,
  position_kind text,
  employment_type text,
  pay_grade integer,
  management_level integer,
  location_id text,
  location_name text,
  supervisor_name text,
  fte numeric,
  updated_at timestamptz not null default now()
);
-- Pokud jste tabulku organigram_roster založili už dřív (create table if not exists výše byl
-- v tom případě no-op), doplní tento řádek nový sloupec employment_type (služební/pracovní poměr).
alter table organigram_roster add column if not exists employment_type text;
-- Platová třída místa a stupeň řízení (u vedoucích) pro onboarding:
alter table organigram_roster add column if not exists pay_grade integer;
alter table organigram_roster add column if not exists management_level integer;
alter table organigram_roster enable row level security;
create policy "roster: anon read" on organigram_roster
  for select to anon using (true);
create policy "roster: authenticated full access" on organigram_roster
  for all to authenticated using (true) with check (true);

-- 6) Explicitní oprávnění pro Data API (supabase-js / PostgREST)
--    Od 30. 10. 2026 Supabase u nově založených tabulek ve schématu public už nepřiděluje přístup
--    automaticky. Stávající tabulky to nemění; tento blok je potřeba při založení nového projektu,
--    obnově schématu nebo na preview větvi. Spuštění na existujícím projektu nic nerozbije.
--    Kdo co smí, dál určují RLS politiky výše; anon dostává jen čtení organigram_roster (onboarding).
grant select, insert, update, delete on public.organigram_state  to authenticated, service_role;
grant select, insert, update, delete on public.organigram_log    to authenticated, service_role;
grant select, insert, update, delete on public.organigram_roles  to authenticated, service_role;
grant select, insert, update, delete on public.organigram_roster to authenticated, service_role;
grant select on public.organigram_roster to anon;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- 7) Omezený přístup pro externí spolupracovníky (listopad 2026)
--    Role 'kraj' + scope = id řádku organigram_state, do kterého uživatel smí (např. 'kraj-vysocina-2').
--    Takový uživatel vidí a upravuje jen tento řádek a historii s app = scope; organigram ÚRÚ ČR, TOM,
--    seznam osob ani ostatní role nevidí. Uživatelé bez omezení (admin/it/personalista/bez záznamu) beze změny.
--    Přidání uživatele: insert into organigram_roles(email,role,scope) values ('jmeno@kr-vysocina.cz','kraj','kraj-vysocina-2');
alter table organigram_roles add column if not exists scope text;
alter table organigram_roles drop constraint if exists organigram_roles_role_check;
alter table organigram_roles add constraint organigram_roles_role_check
  check (role = any (array['admin','it','personalista','kraj']) and (role <> 'kraj' or scope is not null));
create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.uru_scope() returns text
language sql stable security definer set search_path = public as $$
  select r.scope from public.organigram_roles r
  where lower(r.email) = lower(auth.jwt() ->> 'email') and r.role = 'kraj' limit 1
$$;
revoke all on function private.uru_scope() from public, anon;
grant execute on function private.uru_scope() to authenticated;
drop policy if exists "state: authenticated full access" on organigram_state;
create policy "state: full access (bez omezení)" on organigram_state for all to authenticated
  using (private.uru_scope() is null) with check (private.uru_scope() is null);
create policy "state: kraj read own" on organigram_state for select to authenticated using (id = private.uru_scope());
create policy "state: kraj insert own" on organigram_state for insert to authenticated with check (id = private.uru_scope());
create policy "state: kraj update own" on organigram_state for update to authenticated
  using (id = private.uru_scope()) with check (id = private.uru_scope());
drop policy if exists "log: authenticated read" on organigram_log;
drop policy if exists "log: authenticated insert" on organigram_log;
create policy "log: read" on organigram_log for select to authenticated using (private.uru_scope() is null or app = private.uru_scope());
create policy "log: insert" on organigram_log for insert to authenticated with check (private.uru_scope() is null or app = private.uru_scope());
drop policy if exists "roles: authenticated read" on organigram_roles;
create policy "roles: read own row" on organigram_roles for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));
create policy "roles: authenticated read (bez omezení)" on organigram_roles for select to authenticated using (private.uru_scope() is null);
drop policy if exists "roster: authenticated full access" on organigram_roster;
create policy "roster: authenticated full access (bez omezení)" on organigram_roster for all to authenticated
  using (private.uru_scope() is null) with check (private.uru_scope() is null);
