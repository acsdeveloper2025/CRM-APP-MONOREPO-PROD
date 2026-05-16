import jwt from 'jsonwebtoken';

/**
 * Verify a JWT with rotation overlap support (NEW-HIGH-2, AUDIT 2026-05-17).
 *
 * Tries the primary secret first. If — and only if — verification fails
 * with a signature error (i.e. `JsonWebTokenError` that is NOT
 * `TokenExpiredError` / `NotBeforeError`), retries with the fallback
 * secret. Expired / not-yet-valid / malformed tokens bubble up unchanged
 * so callers still surface the correct error code to the client.
 *
 * Rotation flow (zero forced logouts):
 *   1. Set OLD_JWT_SECRET=<current>, JWT_SECRET=<new>. Deploy.
 *      New tokens sign with NEW; tokens signed with OLD still verify.
 *   2. Wait > max access TTL (24h for mobile).
 *   3. Remove OLD_JWT_SECRET. Deploy. Old tokens now rejected naturally.
 *
 * Why fallback only on signature error:
 *   - TokenExpiredError → token is genuinely expired; fallback would
 *     extend its life past the intended TTL.
 *   - NotBeforeError → nbf claim future; fallback meaningless.
 *   - Malformed (`jwt malformed`) → not a real token; fallback wastes cycles.
 *   - Signature mismatch → could be a valid token signed with OLD; this
 *     is the only legitimate fallback case.
 */
export function verifyJwtWithRotation<T = jwt.JwtPayload>(
  token: string,
  primarySecret: jwt.Secret,
  fallbackSecret?: jwt.Secret,
  options?: jwt.VerifyOptions
): T {
  try {
    return jwt.verify(token, primarySecret, options) as T;
  } catch (err) {
    if (!fallbackSecret) {
      throw err;
    }
    // Narrow to signature-mismatch case only.
    const isSignatureError =
      err instanceof jwt.JsonWebTokenError &&
      !(err instanceof jwt.TokenExpiredError) &&
      !(err instanceof jwt.NotBeforeError) &&
      // jsonwebtoken sets err.message='invalid signature' for sig mismatch.
      // Other JsonWebTokenError messages (jwt malformed, invalid token, etc.)
      // are NOT rotation-related — don't try fallback.
      err.message === 'invalid signature';
    if (!isSignatureError) {
      throw err;
    }
    try {
      return jwt.verify(token, fallbackSecret, options) as T;
    } catch {
      // Re-throw the ORIGINAL primary-verify error so callers see
      // consistent error semantics (`invalid signature`) rather than
      // whatever the fallback attempt raised.
      throw err;
    }
  }
}
