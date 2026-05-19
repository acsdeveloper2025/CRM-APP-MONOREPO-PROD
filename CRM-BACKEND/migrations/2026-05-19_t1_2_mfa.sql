-- T1-2 MFA — 2026-05-19
--
-- AUDIT_2026_05_17 §13 T1-2: TOTP-based MFA for admin / billing.approve /
-- settings.manage roles. This migration ships the schema only — the
-- login-flow enforcement and role seeding land in a later commit so MFA
-- cannot be required before the verify endpoint exists.
--
-- Schema:
--   roles_v2.mfa_required      — flag a role as requiring MFA at login
--   user_mfa_secrets           — per-user TOTP secret (encrypted) + 10
--                                recovery-code HASHES (one-time pads)
--
-- Recovery codes are hashed (SHA-256), not encrypted: they are compared
-- on use, never decrypted, and are shown to the user only once at
-- enrollment time. Decryption is a strictly larger attack surface that
-- buys us nothing here.

BEGIN;

ALTER TABLE public.roles_v2
  ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.user_mfa_secrets (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  -- AES-256-GCM ciphertext: 12-byte IV || 16-byte authTag || ciphertext.
  -- Key lives in MFA_ENCRYPTION_KEY env (32 bytes, base64-encoded).
  secret_encrypted bytea NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at timestamptz,
  -- Exactly 10 single-use recovery codes. Stored as SHA-256 hashes; the
  -- matching plaintext is shown to the user exactly once at enrollment.
  recovery_code_hashes bytea[] NOT NULL CHECK (array_length(recovery_code_hashes, 1) = 10),
  -- Parallel array — recovery_code_used_at[i] is NULL until code i is
  -- consumed, at which point it stores the use timestamp. Array length
  -- must match recovery_code_hashes.
  recovery_code_used_at timestamptz[] NOT NULL DEFAULT ARRAY[NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL]::timestamptz[]
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_secrets_enrolled
  ON public.user_mfa_secrets (enrolled_at);

COMMIT;
