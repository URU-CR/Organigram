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
