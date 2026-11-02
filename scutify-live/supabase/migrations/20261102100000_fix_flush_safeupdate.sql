-- =============================================================================
-- Scutify Live — correctif : flush_messages() appelée depuis send_message()
--
-- Supabase charge l'extension pg-safeupdate pour les requêtes PostgREST :
-- tout DELETE / UPDATE sans WHERE y est refusé (« DELETE requires a WHERE
-- clause »), même dans une fonction SECURITY DEFINER. La vidange de la pile
-- des réactions (sans WHERE) faisait donc échouer chaque message visible
-- envoyé depuis le site, alors que l'appel par pg_cron passait. Ajout d'un
-- WHERE toujours vrai (id identité > 0).
-- =============================================================================

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
     where r.id > 0 -- WHERE obligatoire : pg-safeupdate (requêtes PostgREST)
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

revoke execute on function private.flush_messages() from public, anon, authenticated;
