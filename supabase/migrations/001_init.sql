-- ============================================================
-- EU Withdrawal App — Migration initiale (Module 1 MVP)
-- Directive UE 2023/2673 — bouton de rétractation
-- Postgres / Supabase. Région EU. RLS par shop_id.
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- shops : boutiques ayant installé l'app
-- ------------------------------------------------------------
create table if not exists shops (
  id              uuid primary key default gen_random_uuid(),
  shop_domain     text not null unique,           -- xxx.myshopify.com
  access_token    text,                            -- à chiffrer côté app
  email_from      text,                            -- expéditeur configuré
  default_country text not null default 'FR',      -- fallback pays
  installed_at    timestamptz not null default now(),
  uninstalled_at  timestamptz
);

-- ------------------------------------------------------------
-- withdrawal_rules : moteur de délai (différenciant)
-- pays × catégorie produit → délai + exonération
-- ------------------------------------------------------------
create table if not exists withdrawal_rules (
  id               uuid primary key default gen_random_uuid(),
  country_code     text not null,                  -- FR, DE, IT...
  product_category text not null default 'standard',
  cooling_off_days int  not null default 14,
  is_exempt        boolean not null default false,
  legal_ref        text,
  unique (country_code, product_category)
);

-- ------------------------------------------------------------
-- withdrawals : demandes de rétractation (cœur)
-- ------------------------------------------------------------
create table if not exists withdrawals (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references shops(id) on delete cascade,
  reference           text not null,               -- WR-XXXXXX
  customer_name       text,
  customer_email      text not null,
  order_number        text not null,               -- saisi par le client
  shopify_order_id    bigint,                       -- résolu après matching
  order_verified      boolean not null default false,
  customer_country    text,
  items               jsonb not null default '[]',
  reason              text,
  status              text not null default 'new',  -- new|in_progress|done|refused
  shipped_at          timestamptz,
  deadline_at         timestamptz,                  -- calculé pays × produit
  deadline_status     text default 'unknown',       -- within|late|exempt|unknown
  refund_deadline_at  timestamptz,                  -- 14j remboursement
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (shop_id, reference)
);

create index if not exists idx_withdrawals_shop    on withdrawals(shop_id);
create index if not exists idx_withdrawals_status  on withdrawals(shop_id, status);
create index if not exists idx_withdrawals_email   on withdrawals(shop_id, customer_email);

-- ------------------------------------------------------------
-- withdrawal_events : timeline horodatée
-- ------------------------------------------------------------
create table if not exists withdrawal_events (
  id             uuid primary key default gen_random_uuid(),
  withdrawal_id  uuid not null references withdrawals(id) on delete cascade,
  type           text not null,    -- created|email_sent|order_verified|status_changed|refunded
  actor          text not null default 'system', -- system|client|merchant
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_events_withdrawal on withdrawal_events(withdrawal_id);

-- ------------------------------------------------------------
-- withdrawal_notes : notes internes marchand
-- ------------------------------------------------------------
create table if not exists withdrawal_notes (
  id             uuid primary key default gen_random_uuid(),
  withdrawal_id  uuid not null references withdrawals(id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- updated_at auto
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_withdrawals_updated on withdrawals;
create trigger trg_withdrawals_updated
  before update on withdrawals
  for each row execute function set_updated_at();

-- ============================================================
-- RLS — isolation stricte par shop_id
-- L'app backend utilise la service key (bypass RLS) ; ces
-- policies protègent tout accès via clé anon/authenticated.
-- ============================================================
alter table shops              enable row level security;
alter table withdrawals        enable row level security;
alter table withdrawal_events  enable row level security;
alter table withdrawal_notes   enable row level security;
alter table withdrawal_rules   enable row level security;

-- Par défaut : aucune policy publique = tout refusé sauf service key.
-- withdrawal_rules en lecture seule publique (référentiel non sensible) :
drop policy if exists rules_read on withdrawal_rules;
create policy rules_read on withdrawal_rules
  for select using (true);

-- ============================================================
-- SEED — withdrawal_rules
-- ============================================================
insert into withdrawal_rules (country_code, product_category, cooling_off_days, is_exempt, legal_ref) values
  ('FR', 'standard',          14, false, 'Code de la consommation art. L221-18'),
  ('DE', 'standard',          14, false, 'BGB §355'),
  -- Exonérations communes (directive 2011/83 art. 16, repris par 2023/2673)
  ('FR', 'custom',            14, true,  'Bien confectionné sur mesure — exonéré'),
  ('FR', 'perishable',        14, true,  'Bien périssable — exonéré'),
  ('FR', 'digital_unsealed',  14, true,  'Contenu numérique descellé — exonéré'),
  ('DE', 'custom',            14, true,  'Maßanfertigung — ausgenommen'),
  ('DE', 'perishable',        14, true,  'Verderbliche Ware — ausgenommen'),
  ('DE', 'digital_unsealed',  14, true,  'Entsiegelte digitale Inhalte — ausgenommen')
on conflict (country_code, product_category) do nothing;
