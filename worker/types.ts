/**
 * DigiExplodeAI — Cloudflare Worker Types & Auth Interfaces
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; meta?: any }>;
  all<T = unknown>(): Promise<{ results?: T[]; success: boolean; meta?: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<any[]>;
  exec<T = unknown>(query: string): Promise<any>;
}

export interface KVNamespace {
  get(key: string, options?: any): Promise<any>;
  put(key: string, value: any, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export type CanonicalRole =
  | 'superAdmin'
  | 'admin'
  | 'teamLeader'
  | 'employee'
  | 'hr'
  | 'accounts'
  | 'client';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: CanonicalRole;
  clientId?: string;
  employeeId?: string;
  status: 'active' | 'inactive';
  isProvisioned: boolean;
  isAnonymous: boolean;
  tokenClaims: Record<string, any>;
}

export interface Env {
  DB: D1Database;
  KV?: KVNamespace;
  FIREBASE_PROJECT_ID?: string;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
  TEST_JWKS?: any[];
}

export type AuthResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; status: number; error: string };
