-- =============================================================================
-- Scutify Live — pseudo seul pour écrire (email facultatif)
--
-- Le chat reste lisible par tous sans rien saisir ; pour écrire, un pseudo
-- suffit. L'email devient facultatif (validé seulement s'il est fourni ; un
-- email déjà enregistré est conservé si on change de pseudo).
-- =============================================================================

alter table public.profiles alter column email drop not null;

create or replace function public.set_profile(pseudo text, email text default null)
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
  -- Email FACULTATIF (pseudo seul pour écrire) ; validé seulement s'il est fourni.
  v_email text := nullif(lower(btrim(coalesce(set_profile.email, ''))), '');
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

  if v_email is not null
     and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$') then
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
        email = coalesce(excluded.email, p.email)
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

revoke execute on function public.set_profile(text, text) from public, anon;
grant execute on function public.set_profile(text, text) to authenticated;
