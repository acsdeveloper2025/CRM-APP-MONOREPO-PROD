/**
 * Integration-test auth helper. Mints a real access token for a seeded user
 * so supertest requests pass the authenticateToken middleware. The token
 * shape matches authController (userId / authMethod / tokenVersion) and is
 * signed with the live jwtSecret; tokenVersion is read from the DB so the
 * middleware's revocation check passes.
 */
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { query } from '@/config/db';

export interface SeededUser {
  id: string;
  username: string;
  tokenVersion: number;
}

export async function findActiveUserByRole(roleName: string): Promise<SeededUser> {
  const { rows } = await query<{ id: string; username: string; token_version: number }>(
    `SELECT u.id, u.username, u.token_version
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles_v2 r ON r.id = ur.role_id
      WHERE u.is_active = true AND r.name = $1
      ORDER BY u.created_at
      LIMIT 1`,
    [roleName]
  );
  if (rows.length === 0) {
    throw new Error(`No active seeded user found with role ${roleName}`);
  }
  const u = rows[0];
  return { id: u.id, username: u.username, tokenVersion: u.token_version };
}

export function mintAccessToken(user: SeededUser): string {
  return jwt.sign(
    { userId: user.id, authMethod: 'PASSWORD', tokenVersion: user.tokenVersion },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as string & jwt.SignOptions['expiresIn'] }
  );
}

export async function authHeaderForRole(roleName: string): Promise<string> {
  return `Bearer ${mintAccessToken(await findActiveUserByRole(roleName))}`;
}
