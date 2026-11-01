-- =============================================================================
-- Scutify Live — salle d'attente
--
-- Tant que live_open = false, les spectateurs ne voient qu'un compte à rebours
-- (jusqu'à live_starts_at) : ni vidéo, ni chat, ni réactions. L'équipe voit la
-- page normale (pour vérifier StreamYard). « Ouvrir le live » dans l'admin
-- passe live_open à true : un seul settings_updated diffusé, la vidéo apparaît
-- chez tout le monde sans recharger la page.
-- =============================================================================

alter table public.chat_settings
  add column live_open boolean not null default false,
  -- Lundi 2 novembre 2026, 20h00 à Paris (heure d'hiver, UTC+1).
  add column live_starts_at timestamptz default '2026-11-02 19:00:00+00';

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
    'live_open', s.live_open,
    'live_starts_at', s.live_starts_at,
    'updated_at', s.updated_at
  );
$$;

-- Admins seuls (policy « chat_settings: admin update »).
grant update (live_open, live_starts_at) on public.chat_settings to authenticated;
