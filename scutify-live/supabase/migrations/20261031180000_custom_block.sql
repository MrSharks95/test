-- =============================================================================
-- Scutify Live — bloc HTML personnalisé sous la vidéo (offre, bonus, CTA…)
--
-- Le HTML n'est PAS diffusé dans settings_updated (il peut peser plusieurs Ko,
-- × 4 000 spectateurs) : seul custom_html_updated_at l'est, et les clients
-- relisent le bloc via /api/chat/snapshot (cache CDN). Il est nettoyé côté
-- navigateur (DOMPurify : pas de scripts ni de gestionnaires d'événements).
-- =============================================================================

alter table public.chat_settings
  add column custom_html text check (char_length(custom_html) <= 30000),
  add column custom_html_updated_at timestamptz;

create or replace function private.touch_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.custom_html is distinct from old.custom_html then
    new.custom_html_updated_at := now();
  end if;
  return new;
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
    'updated_at', s.updated_at
  );
$$;

revoke execute on function private.touch_settings(), private.settings_payload(public.chat_settings)
  from public, anon, authenticated;

grant update (custom_html) on public.chat_settings to authenticated;
