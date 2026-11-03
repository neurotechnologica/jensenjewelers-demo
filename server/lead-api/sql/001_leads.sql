-- Lead store schema (PostgreSQL 13+). Applied automatically at start-up when DATABASE_URL is set (idempotent), or run by hand:
--   psql "$DATABASE_URL" -f server/lead-api/sql/001_leads.sql
CREATE TABLE IF NOT EXISTS leads (
  id               uuid PRIMARY KEY,
  created_at       timestamptz NOT NULL DEFAULT now(),
  name             text NOT NULL,
  email            text NOT NULL,
  phone            text NOT NULL DEFAULT '',
  store            text NOT NULL,
  plan             text NOT NULL,
  billing_cycle    text NOT NULL DEFAULT 'monthly',
  notes            text NOT NULL DEFAULT '',
  crm              text NOT NULL DEFAULT '',
  total            numeric(12,2),
  currency         char(3),
  page_url         text NOT NULL DEFAULT '',
  idempotency_key  text UNIQUE,
  payment_status   text NOT NULL DEFAULT 'unpaid',
  ip_hash          text NOT NULL DEFAULT '',
  user_agent       text NOT NULL DEFAULT '',
  notify           jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- fields added by other modules (payment provider ids, etc.) live here so the table does not need a migration per feature
  extra            jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (lower(email));
CREATE INDEX IF NOT EXISTS leads_notify_pending_idx ON leads (created_at) WHERE (notify->>'done') IS DISTINCT FROM 'true';
