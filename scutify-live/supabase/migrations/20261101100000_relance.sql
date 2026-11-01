-- =============================================================================
-- Scutify Live — relances (boutons de réponse rapide)
--
-- L'équipe lance une relance depuis /admin : un message Équipe + des boutons
-- de réponse rapide (« OUI 🔥 », « Chaud ! »…) affichés aux spectateurs
-- pendant N secondes. Un appui envoie la réponse via send_message : slow
-- mode, anti-spam par IP et mots-clés s'appliquent comme pour un message tapé.
-- Les boutons voyagent dans settings_updated (quelques octets).
-- =============================================================================

alter table public.chat_settings
  add column quick_replies text[] check (quick_replies is null or cardinality(quick_replies) <= 4),
  add column quick_replies_until timestamptz;

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
    'updated_at', s.updated_at
  );
$$;

-- Lance une relance (ou l'arrête si seconds <= 0 ou aucune réponse valide).
-- Durée calculée côté serveur, 10 min max ; 4 réponses max, 1 à 40 caractères.
create or replace function public.admin_set_quick_replies(replies text[], seconds integer)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_clean text[];
  v_until timestamptz;
begin
  perform private.assert_admin();
  select coalesce(array_agg(x.c order by x.i), '{}')
    into v_clean
  from (
    select private.clean_text(t.r) as c, t.i
    from unnest(coalesce(admin_set_quick_replies.replies, '{}')) with ordinality as t(r, i)
    where char_length(private.clean_text(t.r)) between 1 and 40
    order by t.i
    limit 4
  ) x;

  if coalesce(admin_set_quick_replies.seconds, 0) <= 0 or cardinality(v_clean) = 0 then
    update public.chat_settings set quick_replies = null, quick_replies_until = null where id = 1;
    return null;
  end if;

  v_until := now() + make_interval(secs => least(admin_set_quick_replies.seconds, 600));
  update public.chat_settings set quick_replies = v_clean, quick_replies_until = v_until where id = 1;
  return v_until;
end;
$$;

revoke execute on function private.settings_payload(public.chat_settings) from public, anon, authenticated;
revoke execute on function public.admin_set_quick_replies(text[], integer) from public, anon;
grant execute on function public.admin_set_quick_replies(text[], integer) to authenticated;
