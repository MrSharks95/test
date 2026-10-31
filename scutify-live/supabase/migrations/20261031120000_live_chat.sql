-- =============================================================================
-- Scutify Live — chat modéré
--
-- Tables      : profiles, messages, chat_settings, blocked_keywords
-- Sécurité    : RLS stricte. Les viewers ne peuvent RIEN écrire directement :
--               toute écriture passe par des fonctions SECURITY DEFINER.
-- Temps réel  : Realtime Broadcast sur le canal privé "live-chat", alimenté
--               par la base via realtime.send(). Les messages 'shadow' ne sont
--               JAMAIS diffusés.
-- Échelle     : dimensionné pour ~4 000 spectateurs. Les nouveaux messages sont
--               diffusés PAR LOTS (au plus 1 diffusion / broadcast_interval_seconds),
--               car chaque diffusion compte une fois par spectateur dans le quota
--               Realtime : 4 000 spectateurs / 2 s = 2 000 événements/s, quel que
--               soit le débit du chat (contre 20 000/s à 5 msg/s sans lots).
-- Stockage    : éphémère (une soirée). messages est UNLOGGED (pas de WAL, pas
--               de sauvegarde) et purgé automatiquement après 12 h.
--
-- À exécuter une fois dans le SQL Editor Supabase (ou `supabase db push`).
-- =============================================================================

create extension if not exists unaccent with schema extensions;
-- Cron Supabase : diffusion des lots chaque seconde + purge des messages.
create extension if not exists pg_cron;

-- Schéma interne (non exposé par l'API Data) pour les fonctions utilitaires.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  pseudo      text not null check (char_length(pseudo) between 2 and 20),
  email       text not null check (char_length(email) between 3 and 254),
  role        text not null default 'viewer' check (role in ('viewer', 'admin')),
  muted_until timestamptz,
  banned      boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Un profil par utilisateur Supabase (anonyme pour les viewers, email/mot de passe pour l''équipe).';

create index profiles_moderated_idx on public.profiles (muted_until)
  where banned or muted_until is not null;

-- UNLOGGED : les messages ne servent que pendant la soirée (écritures plus
-- rapides, aucune rétention dans les sauvegardes, vidés si la base redémarre).
create unlogged table public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  pseudo     text not null,
  content    text not null check (char_length(content) between 1 and 300),
  status     text not null default 'visible' check (status in ('visible', 'shadow', 'deleted')),
  -- Dénormalisé (comme le pseudo) : les viewers ne peuvent pas lire les profils
  -- des autres, et le payload Broadcast doit suffire à afficher le badge.
  is_team    boolean not null default false,
  created_at timestamptz not null default now(),
  -- NULL = message visible pas encore diffusé (en attente du prochain lot).
  broadcast_at timestamptz
);

create index messages_status_created_at_idx on public.messages (status, created_at desc);
create index messages_user_created_at_idx on public.messages (user_id, created_at desc);
create index messages_pending_broadcast_idx on public.messages (created_at)
  where status = 'visible' and broadcast_at is null;

create table public.chat_settings (
  id                smallint primary key default 1 check (id = 1),
  chat_enabled      boolean not null default true,
  slow_mode_seconds integer not null default 0 check (slow_mode_seconds between 0 and 3600),
  links_allowed     boolean not null default false,
  pinned_message    text check (char_length(pinned_message) <= 280),
  -- Uniquement http(s) : empêche tout lien javascript: dans le bouton épinglé.
  pinned_url        text check (pinned_url ~* '^https?://[^[:space:]]+$' and char_length(pinned_url) <= 2048),
  pinned_label      text check (char_length(pinned_label) <= 60),
  -- Intervalle minimal entre deux diffusions de lots. Événements Realtime/s
  -- ≈ nombre de spectateurs / intervalle : doit rester sous le quota du plan.
  broadcast_interval_seconds smallint not null default 2 check (broadcast_interval_seconds between 1 and 10),
  updated_at        timestamptz not null default now()
);

insert into public.chat_settings (id) values (1);

create table public.blocked_keywords (
  id         bigint generated always as identity primary key,
  keyword    text not null unique check (char_length(keyword) between 1 and 60),
  created_at timestamptz not null default now()
);

comment on column public.blocked_keywords.keyword is
  'Stocké normalisé (minuscules, sans accents). Correspondance sur mot entier ; * = joker (ex. arnaque*).';

-- État interne de la diffusion par lots (non exposé).
create table private.broadcast_state (
  id            smallint primary key default 1 check (id = 1),
  last_flush_at timestamptz not null default '-infinity'
);
insert into private.broadcast_state (id) values (1);

-- -----------------------------------------------------------------------------
-- Fonctions utilitaires (schéma private)
-- -----------------------------------------------------------------------------

-- Minuscules + suppression des accents : base de toutes les comparaisons.
create or replace function private.normalize_text(p_text text)
returns text
language sql
stable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, '')));
$$;

-- Nettoie les espaces : supprime les caractères invisibles, remplace tout
-- blanc / caractère de contrôle (y compris retours à la ligne) par un espace
-- simple, puis trim.
create or replace function private.clean_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(coalesce(p_text, ''), '[​-‍⁠﻿­]', '', 'g'),
      '[[:space:][:cntrl:]   -     　]+',
      ' ',
      'g'
    )
  );
$$;

-- Détection de liens sur un texte déjà normalisé (minuscules, sans accents).
-- Couvre : http(s)://, www., et domaine.tld (y compris les obfuscations
-- domaine[.]com / domaine(dot)fr).
create or replace function private.contains_link(p_normalized text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_normalized ~ (
    'https?:/{1,2}'
    || '|www\.'
    || '|[a-z0-9-](\.|\[\.\]|\(\.\)|\[dot\]|\(dot\))'
    || '(com|fr|net|org|io|co|be|ch|ca|eu|info|biz|xyz|app|dev|me|ly|gg|tv|link|site|online'
    || '|shop|store|club|live|pro|top|uk|de|ru|us|ai|cc|ws|vip|icu|cn|tk|ml|ga|cf|gq|gl|sh|lu|re|mq|gp)'
    || '([^a-z0-9]|$)'
  );
$$;

-- Transforme un mot-clé normalisé en motif regex : échappe les métacaractères,
-- puis * devient un joker alphanumérique.
create or replace function private.keyword_regex(p_keyword text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select '(^|[^a-z0-9])'
    || replace(regexp_replace(p_keyword, '([.^$+?(){}|\[\]\\])', '\\\1', 'g'), '*', '[a-z0-9]*')
    || '($|[^a-z0-9])';
$$;

create or replace function private.has_blocked_keyword(p_normalized text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocked_keywords k
    where p_normalized ~ private.keyword_regex(k.keyword)
  );
$$;

-- Utilisé par les policies RLS : SECURITY DEFINER pour lire profiles sans
-- récursion de policy.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Action réservée à l''équipe.' using errcode = '42501', hint = 'forbidden';
  end if;
end;
$$;

-- Payload public d'un message (jamais le statut, jamais l'email).
create or replace function private.message_payload(m public.messages)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'user_id', m.user_id,
    'pseudo', m.pseudo,
    'content', m.content,
    'is_team', m.is_team,
    'created_at', m.created_at
  );
$$;

create or replace function private.settings_payload(s public.chat_settings)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'chat_enabled', s.chat_enabled,
    'slow_mode_seconds', s.slow_mode_seconds,
    'links_allowed', s.links_allowed,
    'pinned_message', s.pinned_message,
    'pinned_url', s.pinned_url,
    'pinned_label', s.pinned_label,
    'updated_at', s.updated_at
  );
$$;

-- -----------------------------------------------------------------------------
-- Diffusion Realtime (Broadcast, canal privé "live-chat")
-- -----------------------------------------------------------------------------

create or replace function private.broadcast(p_event text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send(p_payload, p_event, 'live-chat', true);
$$;

-- Diffusion PAR LOTS des messages visibles en attente (broadcast_at IS NULL).
-- Appelée par send_message (diffusion immédiate si le dernier lot est assez
-- ancien) et par pg_cron chaque seconde (messages arrivés entre deux lots).
-- Au plus une diffusion par broadcast_interval_seconds, et au plus les 100
-- derniers messages par lot (les clients n'en affichent que 200).
create or replace function private.flush_messages()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_interval integer;
  v_batch jsonb;
  v_count integer;
begin
  -- Un seul diffuseur à la fois ; les autres passent leur tour sans attendre.
  if not pg_try_advisory_xact_lock(hashtext('scutify-live:flush')) then
    return 0;
  end if;

  select s.broadcast_interval_seconds into v_interval from public.chat_settings s where s.id = 1;
  if exists (
    select 1 from private.broadcast_state b
    where b.id = 1 and b.last_flush_at > clock_timestamp() - make_interval(secs => coalesce(v_interval, 2))
  ) then
    return 0;
  end if;

  with pending as (
    update public.messages m
       set broadcast_at = clock_timestamp()
     where m.status = 'visible' and m.broadcast_at is null
    returning m.id, m.user_id, m.pseudo, m.content, m.is_team, m.created_at
  ), latest as (
    select * from pending order by created_at desc limit 100
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'user_id', l.user_id,
        'pseudo', l.pseudo,
        'content', l.content,
        'is_team', l.is_team,
        'created_at', l.created_at
      )
      order by l.created_at
    ),
    count(*)
  into v_batch, v_count
  from latest l;

  if v_count > 0 then
    perform private.broadcast('new_message', jsonb_build_object('messages', v_batch));
    update private.broadcast_state set last_flush_at = clock_timestamp() where id = 1;
  end if;
  return v_count;
end;
$$;

-- Suppression / masquage (niveau instruction, tables de transition) :
-- visible -> deleted/shadow => un seul message_deleted { ids: [...] }.
create or replace function private.on_messages_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select array_agg(n.id order by n.created_at)
    into v_ids
  from new_rows n
  join old_rows o on o.id = n.id
  where o.status = 'visible' and n.status <> 'visible';

  if v_ids is not null then
    perform private.broadcast('message_deleted', jsonb_build_object('ids', to_jsonb(v_ids)));
  end if;
  return null;
end;
$$;

create trigger messages_broadcast_update
  after update on public.messages
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.on_messages_update();

create or replace function private.on_settings_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast('settings_updated', private.settings_payload(new));
  return null;
end;
$$;

create or replace function private.touch_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger chat_settings_touch
  before update on public.chat_settings
  for each row execute function private.touch_settings();

create trigger chat_settings_broadcast
  after update on public.chat_settings
  for each row execute function private.on_settings_update();

create or replace function private.on_profile_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.broadcast('user_muted', jsonb_build_object(
    'user_id', new.id,
    'muted_until', new.muted_until,
    'banned', new.banned
  ));
  return null;
end;
$$;

create trigger profiles_broadcast_moderation
  after update of muted_until, banned on public.profiles
  for each row
  when (old.muted_until is distinct from new.muted_until or old.banned is distinct from new.banned)
  execute function private.on_profile_moderation();

-- Mots-clés : stockés normalisés (minuscules, sans accents, espaces nettoyés).
create or replace function private.normalize_keyword()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.keyword := private.normalize_text(private.clean_text(new.keyword));
  if char_length(new.keyword) = 0 or new.keyword ~ '^\*+$' then
    raise exception 'Mot-clé invalide.' using errcode = '22023', hint = 'invalid_keyword';
  end if;
  return new;
end;
$$;

create trigger blocked_keywords_normalize
  before insert or update on public.blocked_keywords
  for each row execute function private.normalize_keyword();

-- -----------------------------------------------------------------------------
-- API publique (RPC)
-- -----------------------------------------------------------------------------

-- Crée / met à jour le profil du viewer connecté (pseudo + email uniquement :
-- role, muted_until et banned ne sont jamais modifiables par l'utilisateur).
create or replace function public.set_profile(pseudo text, email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_pseudo text := private.clean_text(set_profile.pseudo);
  v_email text := lower(btrim(coalesce(set_profile.email, '')));
  v_role text;
  v_norm text;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Connexion au chat impossible, recharge la page.'
      using errcode = 'P0001', hint = 'not_authenticated';
  end if;

  if char_length(v_pseudo) < 2 or char_length(v_pseudo) > 20 then
    raise exception 'Ton pseudo doit contenir entre 2 et 20 caractères.'
      using errcode = 'P0001', hint = 'invalid_pseudo';
  end if;

  if v_pseudo !~ '^[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ _.''’-]+$' then
    raise exception 'Ton pseudo ne peut contenir que des lettres, des chiffres, des espaces et . _ - ''.'
      using errcode = 'P0001', hint = 'invalid_pseudo';
  end if;

  if char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then
    raise exception 'Ton adresse email n''est pas valide.'
      using errcode = 'P0001', hint = 'invalid_email';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;

  if coalesce(v_role, 'viewer') <> 'admin' then
    v_norm := private.normalize_text(v_pseudo);
    if v_norm ~ '(scutify|admin|moderat|equipe|staff|support)' then
      raise exception 'Ce pseudo est réservé à l''équipe, choisis-en un autre.'
        using errcode = 'P0001', hint = 'reserved_pseudo';
    end if;
    if private.has_blocked_keyword(v_norm) then
      raise exception 'Ce pseudo n''est pas autorisé, choisis-en un autre.'
        using errcode = 'P0001', hint = 'invalid_pseudo';
    end if;
  end if;

  insert into public.profiles as p (id, pseudo, email)
  values (v_uid, v_pseudo, v_email)
  on conflict (id) do update
    set pseudo = excluded.pseudo,
        email = excluded.email
  returning p.* into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'pseudo', v_profile.pseudo,
    'email', v_profile.email,
    'role', v_profile.role,
    'muted_until', v_profile.muted_until,
    'banned', v_profile.banned
  );
end;
$$;

-- Envoi d'un message. Contrôles, dans cet ordre :
--   1. chat fermé (sauf admin)
--   2. banni / muté
--   3. anti-flood : slow_mode_seconds, minimum 2 s (sauf admin)
--   4. longueur 1..300 après nettoyage des espaces
--   5. liens interdits si links_allowed = false (sauf admin)
--   6. mots-clés bloqués => status 'shadow' (visible par l'auteur seul)
--   7. sinon 'visible'
create or replace function public.send_message(content text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_settings public.chat_settings;
  v_is_admin boolean;
  v_wait integer;
  v_last timestamptz;
  v_remaining integer;
  v_content text;
  v_norm text;
  v_status text := 'visible';
  v_message public.messages;
begin
  if v_uid is null then
    raise exception 'Connexion au chat impossible, recharge la page.'
      using errcode = 'P0001', hint = 'not_authenticated';
  end if;

  -- FOR UPDATE : sérialise les envois concurrents d'un même utilisateur, ce
  -- qui rend l'anti-flood fiable même en cas de double-clic / script.
  select * into v_profile from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'Choisis un pseudo avant d''écrire dans le chat.'
      using errcode = 'P0001', hint = 'no_profile';
  end if;

  v_is_admin := v_profile.role = 'admin';
  select * into v_settings from public.chat_settings s where s.id = 1;

  -- 1. Chat fermé
  if not coalesce(v_settings.chat_enabled, false) and not v_is_admin then
    raise exception 'Le chat est fermé pour le moment.'
      using errcode = 'P0001', hint = 'chat_closed';
  end if;

  -- 2. Banni / muté
  if v_profile.banned or coalesce(v_profile.muted_until > now(), false) then
    raise exception 'Tu ne peux plus écrire dans le chat.'
      using errcode = 'P0001', hint = 'muted';
  end if;

  -- 3. Anti-flood
  if not v_is_admin then
    v_wait := greatest(coalesce(v_settings.slow_mode_seconds, 0), 2);
    select max(m.created_at) into v_last from public.messages m where m.user_id = v_uid;
    if v_last is not null and v_last > clock_timestamp() - make_interval(secs => v_wait) then
      v_remaining := greatest(
        1,
        ceil(extract(epoch from (v_last + make_interval(secs => v_wait) - clock_timestamp())))::integer
      );
      raise exception 'Doucement ! Attends encore % s avant ton prochain message.', v_remaining
        using errcode = 'P0001', hint = 'slow_mode', detail = v_remaining::text;
    end if;
  end if;

  -- 4. Longueur (après nettoyage des espaces)
  v_content := private.clean_text(send_message.content);
  if char_length(v_content) = 0 then
    raise exception 'Ton message est vide.'
      using errcode = 'P0001', hint = 'empty';
  end if;
  if char_length(v_content) > 300 then
    raise exception 'Ton message est trop long (300 caractères maximum).'
      using errcode = 'P0001', hint = 'too_long';
  end if;

  v_norm := private.normalize_text(v_content);

  -- 5. Liens
  if not v_settings.links_allowed and not v_is_admin and private.contains_link(v_norm) then
    raise exception 'Les liens ne sont pas autorisés dans le chat.'
      using errcode = 'P0001', hint = 'links';
  end if;

  -- 6. Mots-clés bloqués => shadow (les messages de l'équipe ne sont pas filtrés)
  if not v_is_admin and private.has_blocked_keyword(v_norm) then
    v_status := 'shadow';
  end if;

  -- 7. Enregistrement (created_at = horloge réelle, pas le début de transaction)
  insert into public.messages as m (user_id, pseudo, content, status, is_team, created_at)
  values (v_uid, v_profile.pseudo, v_content, v_status, v_is_admin, clock_timestamp())
  returning m.* into v_message;

  -- Diffusion immédiate si le dernier lot est assez ancien ; sinon le
  -- message part avec le prochain lot (pg_cron, chaque seconde).
  if v_status = 'visible' then
    perform private.flush_messages();
  end if;

  return private.message_payload(v_message);
end;
$$;

-- ---------------------------------------------------------------- Admin ------

create or replace function public.admin_set_message_status(message_id uuid, status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.assert_admin();
  if admin_set_message_status.status not in ('visible', 'deleted') then
    raise exception 'Statut invalide.' using errcode = '22023', hint = 'invalid_status';
  end if;
  update public.messages m
     set status = admin_set_message_status.status,
         -- Rendu visible : repart dans le prochain lot de diffusion.
         broadcast_at = case when admin_set_message_status.status = 'visible' then null else m.broadcast_at end
   where m.id = admin_set_message_status.message_id
     and m.status <> admin_set_message_status.status;
  if admin_set_message_status.status = 'visible' then
    perform private.flush_messages();
  end if;
end;
$$;

-- minutes NULL ou 0 => démuter.
create or replace function public.admin_mute_user(user_id uuid, minutes integer)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_until timestamptz;
  v_role text;
begin
  perform private.assert_admin();
  select p.role into v_role from public.profiles p where p.id = admin_mute_user.user_id;
  if not found then
    raise exception 'Utilisateur introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_role = 'admin' and coalesce(admin_mute_user.minutes, 0) > 0 then
    raise exception 'Impossible de muter un membre de l''équipe.' using errcode = 'P0001', hint = 'target_admin';
  end if;
  if coalesce(admin_mute_user.minutes, 0) > 0 then
    v_until := now() + make_interval(mins => least(admin_mute_user.minutes, 60 * 24 * 7));
  end if;
  update public.profiles p set muted_until = v_until where p.id = admin_mute_user.user_id;
  return v_until;
end;
$$;

-- Bannir masque aussi tous les messages (visibles ou bloqués) de l'utilisateur.
create or replace function public.admin_ban_user(user_id uuid, banned boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_role text;
begin
  perform private.assert_admin();
  select p.role into v_role from public.profiles p where p.id = admin_ban_user.user_id;
  if not found then
    raise exception 'Utilisateur introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_role = 'admin' and admin_ban_user.banned then
    raise exception 'Impossible de bannir un membre de l''équipe.' using errcode = 'P0001', hint = 'target_admin';
  end if;
  update public.profiles p set banned = admin_ban_user.banned where p.id = admin_ban_user.user_id;
  if admin_ban_user.banned then
    update public.messages m
       set status = 'deleted'
     where m.user_id = admin_ban_user.user_id
       and m.status in ('visible', 'shadow');
  end if;
end;
$$;

-- "Vider le chat" : efface définitivement tous les messages (stockage
-- éphémère) et diffuse un seul événement message_deleted { all: true }.
create or replace function public.admin_clear_chat()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.assert_admin();
  delete from public.messages m where m.status in ('visible', 'shadow');
  get diagnostics v_count = row_count;
  delete from public.messages m where m.status = 'deleted';
  perform private.broadcast('message_deleted', jsonb_build_object('all', true));
  return v_count;
end;
$$;

-- À lancer depuis le SQL Editor uniquement (non exposé à l'API) :
--   select private.promote_to_admin('toi@scutify.fr', 'Scutify');
create or replace function private.promote_to_admin(p_email text, p_pseudo text default 'Équipe Scutify')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  select u.id into v_uid from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_uid is null then
    raise exception 'Aucun utilisateur Auth avec l''email %. Crée-le d''abord (Authentication > Users > Add user).', p_email;
  end if;
  insert into public.profiles (id, pseudo, email, role)
  values (v_uid, left(btrim(p_pseudo), 20), lower(btrim(p_email)), 'admin')
  on conflict (id) do update set role = 'admin', pseudo = excluded.pseudo, email = excluded.email;
  return v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tâches planifiées (pg_cron)
-- -----------------------------------------------------------------------------

create or replace function private.purge_old_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.messages m where m.created_at < now() - interval '12 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Diffuse chaque seconde les messages arrivés depuis le dernier lot.
select cron.schedule('scutify-live-flush', '1 seconds', 'select private.flush_messages()');
-- Stockage éphémère : efface les messages de plus de 12 h.
select cron.schedule('scutify-live-purge', '*/10 * * * *', 'select private.purge_old_messages()');

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.chat_settings enable row level security;
alter table public.blocked_keywords enable row level security;

-- profiles : chacun lit son profil, l'équipe lit tout. Aucune écriture directe.
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- messages : visibles pour tous, 'shadow' pour leur auteur, tout pour l'équipe.
-- Aucune policy INSERT / UPDATE / DELETE => écriture uniquement via les RPC.
create policy "messages: read visible"
  on public.messages for select to anon, authenticated
  using (status = 'visible');

create policy "messages: read own shadow"
  on public.messages for select to authenticated
  using (status = 'shadow' and user_id = (select auth.uid()));

create policy "messages: admin reads all"
  on public.messages for select to authenticated
  using ((select private.is_admin()));

-- chat_settings : lecture publique, modification par l'équipe uniquement.
create policy "chat_settings: public read"
  on public.chat_settings for select to anon, authenticated
  using (true);

create policy "chat_settings: admin update"
  on public.chat_settings for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- blocked_keywords : réservé à l'équipe (les viewers ne doivent pas voir la liste).
create policy "blocked_keywords: admin read"
  on public.blocked_keywords for select to authenticated
  using ((select private.is_admin()));

create policy "blocked_keywords: admin insert"
  on public.blocked_keywords for insert to authenticated
  with check ((select private.is_admin()));

create policy "blocked_keywords: admin delete"
  on public.blocked_keywords for delete to authenticated
  using ((select private.is_admin()));

-- Realtime : réception du canal privé "live-chat" pour les utilisateurs
-- connectés (anonymes compris). Aucune policy INSERT => aucun client ne peut
-- diffuser sur ce canal ; seule la base (realtime.send) le peut.
create policy "live-chat: authenticated can receive"
  on realtime.messages for select to authenticated
  using (
    (select realtime.topic()) = 'live-chat'
    and realtime.messages.extension = 'broadcast'
  );

-- -----------------------------------------------------------------------------
-- Privilèges (défense en profondeur, en plus de RLS)
-- -----------------------------------------------------------------------------

revoke all on public.profiles, public.messages, public.chat_settings, public.blocked_keywords
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.messages to anon, authenticated;
grant select on public.chat_settings to anon, authenticated;
grant update (chat_enabled, slow_mode_seconds, links_allowed, pinned_message, pinned_url, pinned_label)
  on public.chat_settings to authenticated;
grant select, insert, delete on public.blocked_keywords to authenticated;

revoke all on private.broadcast_state from public, anon, authenticated;

-- Fonctions : rien n'est exécutable par défaut…
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.set_profile(text, text),
  public.send_message(text),
  public.admin_set_message_status(uuid, text),
  public.admin_mute_user(uuid, integer),
  public.admin_ban_user(uuid, boolean),
  public.admin_clear_chat()
from public, anon;

-- …sauf ce qui est nécessaire aux utilisateurs connectés.
grant execute on function private.is_admin() to authenticated;
grant execute on function
  public.set_profile(text, text),
  public.send_message(text),
  public.admin_set_message_status(uuid, text),
  public.admin_mute_user(uuid, integer),
  public.admin_ban_user(uuid, boolean),
  public.admin_clear_chat()
to authenticated;
