-- ============================================================
-- EU Withdrawal App — Migration 002
-- Merchant-editable acknowledgement email template (Prompt 5)
-- ============================================================

-- Optional per-shop email template overrides. Shape (all keys optional):
--   { "subject_fr", "body_fr", "subject_en", "body_en" }
-- A missing field falls back to the built-in default template (lib/email).
alter table shops
  add column if not exists email_template jsonb;
