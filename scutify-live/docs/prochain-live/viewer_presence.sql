-- PROPOSITION non appliquée (02/11/2026) : compteur de personnes connectées
-- pour l'admin. À intégrer (+ code client et admin) avant un prochain live.

-- =============================================================================
-- Scutify Live — nombre de personnes connectées (admin uniquement)
--
-- Pas de Presence Realtime (O(n²) à 4 000). Chaque page /live appelle
-- viewer_ping() à l'ouverture puis toutes les ~2 min ; l'admin compte les
-- comptes vus depuis moins de 150 s (admins exclus). Jamais montré aux
-- spectateurs (choix de l'utilisateur : pas de compteur public).
-- Charge : ~33 appels/s à 4 000 personnes (capacité mesurée ~350/s).
-- =============================================================================

create unlogged table private.viewer_presence (
  user_id uuid primary key,
  last_seen timestamptz not null default now()
);
create index viewer_presence_last_seen_idx on private.viewer_presence (last_seen);
revoke all on private.viewer_presence from public, anon, authenticated;
alter table private.viewer_presence enable row level security;

create or replace function public.viewer_ping()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.viewer_presence as v (user_id, last_seen)
  select (select auth.uid()), now()
  where (select auth.uid()) is not null
  on conflict (user_id) do update
    set last_seen = excluded.last_seen
    where v.last_seen < now() - interval '30 seconds';
$$;

create or replace function public.admin_viewer_count()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return (
    select count(*)::integer
    from private.viewer_presence v
    where v.last_seen > now() - interval '150 seconds'
      and not exists (select 1 from public.profiles p where p.id = v.user_id and p.role = 'admin')
  );
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
  delete from private.reaction_limits l where l.bucket < now() - interval '1 hour';
  delete from private.viewer_presence v where v.last_seen < now() - interval '1 hour';
  return v_count;
end;
$$;

revoke execute on function private.purge_old_messages() from public, anon, authenticated;
revoke execute on function public.viewer_ping(), public.admin_viewer_count() from public, anon;
grant execute on function public.viewer_ping(), public.admin_viewer_count() to authenticated;
