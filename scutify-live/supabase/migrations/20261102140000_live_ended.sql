-- =============================================================================
-- Scutify Live — fin du live
--
-- live_ended = true : tous les spectateurs basculent (sans recharger) sur une
-- page de remerciement avec l'offre ; vidéo, chat et réactions disparaissent.
-- L'admin ferme aussi le chat au même moment (envoi refusé côté serveur).
-- Réversible (« Rouvrir le live »).
-- =============================================================================

alter table public.chat_settings
  add column live_ended boolean not null default false;

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
    'pinned_enabled', s.pinned_enabled,
    'custom_html_updated_at', s.custom_html_updated_at,
    'custom_html_enabled', s.custom_html_enabled,
    'quick_replies', s.quick_replies,
    'quick_replies_until', s.quick_replies_until,
    'reactions_enabled', s.reactions_enabled,
    'live_open', s.live_open,
    'live_starts_at', s.live_starts_at,
    'live_ended', s.live_ended,
    'updated_at', s.updated_at
  );
$$;

-- Admins seuls (policy « chat_settings: admin update »).
grant update (live_ended) on public.chat_settings to authenticated;
