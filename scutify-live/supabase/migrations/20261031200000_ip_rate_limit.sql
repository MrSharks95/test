-- =============================================================================
-- Scutify Live — anti-spam par connexion (IP)
--
-- Le slow mode et l'anti-flood sont PAR COMPTE : un robot qui crée des
-- dizaines de comptes anonymes les contourne. On limite donc aussi, par IP :
--   - les messages : ip_message_limit par 10 s (défaut 20) ;
--   - les nouveaux pseudos : ip_profile_limit par 10 min (défaut 30).
-- 0 = limite désactivée (ex. pendant un test de charge lancé depuis une seule
-- machine). Les admins ne sont jamais limités.
--
-- IP = en-tête cf-connecting-ip, posé par Cloudflare et NON falsifiable
-- (Cloudflare rejette une requête qui tente de le fournir). X-Forwarded-For
-- est falsifiable : seul son dernier élément (ajouté par le proxy) sert de
-- secours.
-- =============================================================================

alter table public.chat_settings
  add column ip_message_limit smallint not null default 20 check (ip_message_limit between 0 and 1000),
  add column ip_profile_limit smallint not null default 30 check (ip_profile_limit between 0 and 1000);

create unlogged table private.rate_limit_hits (
  action text not null,
  ip     text not null,
  bucket timestamptz not null,
  hits   integer not null default 1,
  primary key (action, ip, bucket)
);
revoke all on private.rate_limit_hits from public, anon, authenticated;

create or replace function private.client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(coalesce(
    h->>'cf-connecting-ip',
    reverse(split_part(reverse(coalesce(h->>'x-forwarded-for', '')), ',', 1))
  )), '')
  from (select nullif(current_setting('request.headers', true), '')::json as h) t;
$$;

-- Compte une tentative pour (action, ip) dans une fenêtre fixe ; true si sous
-- la limite. Sans IP connue (appel SQL direct) ou limite 0 : toujours permis.
create or replace function private.ip_rate_allowed(p_action text, p_limit integer, p_window interval)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ip text := private.client_ip();
  v_hits integer;
begin
  if p_limit is null or p_limit <= 0 or v_ip is null then
    return true;
  end if;
  insert into private.rate_limit_hits as r (action, ip, bucket, hits)
  values (p_action, v_ip, date_bin(p_window, now(), timestamptz '2000-01-01'), 1)
  on conflict (action, ip, bucket) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

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
    -- Anti-spam par IP : nombre de NOUVEAUX pseudos par connexion.
    if v_role is null and not private.ip_rate_allowed(
      'profile',
      (select s.ip_profile_limit from public.chat_settings s where s.id = 1),
      interval '10 minutes'
    ) then
      raise exception 'Trop de comptes créés depuis ta connexion. Réessaie dans quelques minutes.'
        using errcode = 'P0001', hint = 'ip_rate_limit';
    end if;
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
    -- Anti-spam par IP : bloque un robot qui multiplie les comptes depuis
    -- une même connexion (le slow mode, lui, est par compte).
    if not private.ip_rate_allowed('message', v_settings.ip_message_limit, interval '10 seconds') then
      raise exception 'Trop de messages depuis ta connexion. Patiente quelques secondes.'
        using errcode = 'P0001', hint = 'ip_rate_limit';
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
  return v_count;
end;
$$;

revoke execute on function
  private.client_ip(),
  private.ip_rate_allowed(text, integer, interval),
  private.purge_old_messages()
from public, anon, authenticated;
revoke execute on function public.set_profile(text, text), public.send_message(text) from public, anon;
grant execute on function public.set_profile(text, text), public.send_message(text) to authenticated;

-- Tables internes : RLS activée sans policy (défense en profondeur ; elles ne
-- sont ni exposées par l'API ni accessibles aux rôles anon / authenticated, et
-- les fonctions SECURITY DEFINER du propriétaire ne sont pas concernées).
alter table private.rate_limit_hits enable row level security;
alter table private.broadcast_state enable row level security;
