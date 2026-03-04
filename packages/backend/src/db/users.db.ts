import { randomUUID } from 'crypto';
import type { Db } from './index.js';

type UserRole = 'admin' | 'user';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  auth_method: 'local' | 'oidc';
  password_hash: string | null;
  oidc_subject: string | null;
  oidc_issuer: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserParams {
  email: string;
  name: string;
  passwordHash: string;
  role?: UserRole;
}

export interface UpdateUserParams {
  name?: string;
  email?: string;
  passwordHash?: string;
  role?: UserRole;
  isActive?: boolean;
}

export function findUserByEmail(db: Db, email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function findUserById(db: Db, id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function createUser(db: Db, params: CreateUserParams): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, auth_method)
    VALUES (?, ?, ?, ?, ?, 'local')
  `).run(id, params.email.toLowerCase().trim(), params.name.trim(), params.passwordHash, params.role ?? 'user');
  return id;
}

export function updateUser(db: Db, id: string, params: UpdateUserParams): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (params.name !== undefined) { sets.push('name = ?'); values.push(params.name.trim()); }
  if (params.email !== undefined) { sets.push('email = ?'); values.push(params.email.toLowerCase().trim()); }
  if (params.passwordHash !== undefined) { sets.push('password_hash = ?'); values.push(params.passwordHash); }
  if (params.role !== undefined) { sets.push('role = ?'); values.push(params.role); }
  if (params.isActive !== undefined) { sets.push('is_active = ?'); values.push(params.isActive ? 1 : 0); }

  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteUser(db: Db, id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function listUsers(db: Db): UserSummary[] {
  const rows = db.prepare(
    'SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at ASC'
  ).all() as Array<{ id: string; email: string; name: string; role: UserRole; is_active: number; created_at: string }>;

  return rows.map(r => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
  }));
}

function countUsers(db: Db): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

export function countAdmins(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }).n;
}

export function isFirstUser(db: Db): boolean {
  return countUsers(db) === 0;
}

export function findUserByOidc(db: Db, issuer: string, subject: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE oidc_issuer = ? AND oidc_subject = ?').get(issuer, subject) as UserRow | undefined;
}

export interface CreateOidcUserParams {
  email: string;
  name: string;
  oidcSubject: string;
  oidcIssuer: string;
  role?: UserRole;
}

export function createOidcUser(db: Db, params: CreateOidcUserParams): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, auth_method, oidc_subject, oidc_issuer)
    VALUES (?, ?, ?, NULL, ?, 'oidc', ?, ?)
  `).run(id, params.email.toLowerCase().trim(), params.name.trim(), params.role ?? 'user', params.oidcSubject, params.oidcIssuer);
  return id;
}

export function linkOidcToUser(db: Db, userId: string, oidcIssuer: string, oidcSubject: string): void {
  db.prepare(`
    UPDATE users SET auth_method = 'oidc', oidc_issuer = ?, oidc_subject = ? WHERE id = ?
  `).run(oidcIssuer, oidcSubject, userId);
}
