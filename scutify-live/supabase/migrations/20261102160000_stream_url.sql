-- =============================================================================
-- Scutify Live — lien StreamYard modifiable depuis l'admin
--
-- stream_url (NULL = lien par défaut du code) : changer de diffusion
-- StreamYard (test, relance après une coupure…) sans redéploiement ; tous les
-- spectateurs basculent via settings_updated.
-- =============================================================================

alter table public.chat_settings
  add column stream_url text
    check (stream_url ~ '^https://streamyard\.com/watch/[A-Za-z0-9_-]{6,40}\?embed=true$');

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
    'stream_url', s.stream_url,
    'updated_at', s.updated_at
  );
$$;

-- Admins seuls (policy « chat_settings: admin update »).
grant update (stream_url) on public.chat_settings to authenticated;
