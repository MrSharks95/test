-- ============================================================
-- EU Withdrawal App — Migration 003
-- Security hardening: pin set_updated_at search_path
-- (Supabase linter 0011 function_search_path_mutable)
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;
