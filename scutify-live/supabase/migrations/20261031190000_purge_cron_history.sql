-- pg_cron journalise chaque exécution (la diffusion tourne chaque seconde :
-- ~86 000 lignes/jour dans cron.job_run_details). La purge des messages
-- nettoie aussi cet historique (> 1 jour).
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
  return v_count;
end;
$$;

revoke execute on function private.purge_old_messages() from public, anon, authenticated;

-- 4 000 spectateurs : 1 diffusion / 3 s ≈ 1 330 événements/s (plafond 2 500/s).
update public.chat_settings set broadcast_interval_seconds = 3 where id = 1;
