-- =============================================================================
-- Scutify Live — réactions 🔥 💰 ❤️ 👍 (sans pseudo, sans rejoindre le chat)
--
-- Tous les spectateurs ont déjà une session anonyme : ils peuvent réagir sans
-- choisir de pseudo. Chaque appui n'est PAS diffusé (4 000 spectateurs ×
-- chaque appui = quota Realtime explosé) :
--   1. le navigateur regroupe les appuis et appelle send_reactions() au plus
--      toutes les ~4 s (compteurs par type) ;
--   2. la base empile ces compteurs dans une table UNLOGGED (insertion seule,
--      aucune contention) ;
--   3. private.flush_messages() (pg_cron, chaque seconde) vide la pile et
--      envoie les totaux DANS LE MÊME lot que les messages : toujours au plus
--      une diffusion toutes les 3 s par spectateur, quota inchangé.
--
-- Limites (réactions au-delà ignorées sans erreur, l'animation locale de
-- l'auteur reste instantanée) :
--   - par compte : reaction_user_limit appels / 10 s (défaut 8) ;
--   - par IP     : ip_reaction_limit appels / 10 s (défaut 150, large : des
--     dizaines de spectateurs peuvent partager une IP mobile) ;
--   - 30 réactions max par type et par appel ; comptes bannis ignorés.
-- 0 = limite désactivée (test de charge depuis une seule machine).
-- =============================================================================

alter table public.chat_settings
  add column reactions_enabled boolean not null default true,
  add column reaction_user_limit smallint not null default 8 check (reaction_user_limit between 0 and 1000),
  add column ip_reaction_limit smallint not null default 150 check (ip_reaction_limit between 0 and 1000);

-- Pile des réactions en attente de diffusion (vidée à chaque lot).
create unlogged table private.reaction_events (
  id bigint generated always as identity primary key,
  fire smallint not null default 0,
  money smallint not null default 0,
  heart smallint not null default 0,
  thumbs smallint not null default 0
);

-- Compteur d'appels par compte (fenêtre fixe de 10 s).
create unlogged table private.reaction_limits (
  user_id uuid primary key,
  bucket timestamptz not null,
  calls integer not null default 1
);

revoke all on private.reaction_events, private.reaction_limits from public, anon, authenticated;
alter table private.reaction_events enable row level security;
alter table private.reaction_limits enable row level security;

-- Renvoie true si les réactions sont comptées, false si ignorées.
create or replace function public.send_reactions(
  fire integer default 0,
  money integer default 0,
  heart integer default 0,
  thumbs integer default 0
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_fire smallint := least(greatest(coalesce(send_reactions.fire, 0), 0), 30);
  v_money smallint := least(greatest(coalesce(send_reactions.money, 0), 0), 30);
  v_heart smallint := least(greatest(coalesce(send_reactions.heart, 0), 0), 30);
  v_thumbs smallint := least(greatest(coalesce(send_reactions.thumbs, 0), 0), 30);
  v_settings public.chat_settings;
  v_calls integer;
begin
  if v_uid is null or v_fire + v_money + v_heart + v_thumbs = 0 then
    return false;
  end if;

  select * into v_settings from public.chat_settings s where s.id = 1;
  if not coalesce(v_settings.reactions_enabled, false) then
    return false;
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid and p.banned) then
    return false;
  end if;

  if coalesce(v_settings.reaction_user_limit, 0) > 0 then
    insert into private.reaction_limits as l (user_id, bucket, calls)
    values (v_uid, date_bin(interval '10 seconds', now(), timestamptz '2000-01-01'), 1)
    on conflict (user_id) do update
      set calls = case when l.bucket = excluded.bucket then l.calls + 1 else 1 end,
          bucket = excluded.bucket
    returning l.calls into v_calls;
    if v_calls > v_settings.reaction_user_limit then
      return false;
    end if;
  end if;

  if not private.ip_rate_allowed('reaction', v_settings.ip_reaction_limit, interval '10 seconds') then
    return false;
  end if;

  insert into private.reaction_events (fire, money, heart, thumbs)
  values (v_fire, v_money, v_heart, v_thumbs);
  return true;
end;
$$;

-- Lot de diffusion : messages visibles en attente + totaux des réactions.
-- Payload : { messages: [...], reactions?: { fire, money, heart, thumbs } }.
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
  v_fire bigint;
  v_money bigint;
  v_heart bigint;
  v_thumbs bigint;
  v_payload jsonb;
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

  -- Les réactions insérées pendant ce lot restent pour le suivant (aucune
  -- perte, aucun double comptage).
  with drained as (
    delete from private.reaction_events r
    returning r.fire, r.money, r.heart, r.thumbs
  )
  select coalesce(sum(d.fire), 0), coalesce(sum(d.money), 0), coalesce(sum(d.heart), 0), coalesce(sum(d.thumbs), 0)
    into v_fire, v_money, v_heart, v_thumbs
  from drained d;

  if v_count = 0 and v_fire + v_money + v_heart + v_thumbs = 0 then
    return 0;
  end if;

  v_payload := jsonb_build_object('messages', coalesce(v_batch, '[]'::jsonb));
  if v_fire + v_money + v_heart + v_thumbs > 0 then
    v_payload := v_payload || jsonb_build_object(
      'reactions',
      jsonb_build_object('fire', v_fire, 'money', v_money, 'heart', v_heart, 'thumbs', v_thumbs)
    );
  end if;

  perform private.broadcast('new_message', v_payload);
  update private.broadcast_state set last_flush_at = clock_timestamp() where id = 1;
  return v_count;
end;
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
    'custom_html_updated_at', s.custom_html_updated_at,
    'quick_replies', s.quick_replies,
    'quick_replies_until', s.quick_replies_until,
    'reactions_enabled', s.reactions_enabled,
    'updated_at', s.updated_at
  );
$$;

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
  delete from cron.job_run_details d where d.end_time < now() - interval '1 day';
  delete from private.rate_limit_hits r where r.bucket < now() - interval '1 hour';
  delete from private.reaction_limits l where l.bucket < now() - interval '1 hour';
  return v_count;
end;
$$;

revoke execute on function
  private.flush_messages(),
  private.settings_payload(public.chat_settings),
  private.purge_old_messages()
from public, anon, authenticated;
revoke execute on function public.send_reactions(integer, integer, integer, integer) from public, anon;
grant execute on function public.send_reactions(integer, integer, integer, integer) to authenticated;

-- Interrupteur « Réactions » dans l'admin (policy « admin update » : admins seuls).
grant update (reactions_enabled) on public.chat_settings to authenticated;
