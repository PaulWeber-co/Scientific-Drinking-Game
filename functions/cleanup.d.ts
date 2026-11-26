/** Typen für tests/functions/cleanup.test.ts – die Functions selbst sind CommonJS. */
interface Ref {
  orderByChild(path: string): { endAt(v: number): { get(): Promise<{ forEach(cb: (s: { key: string }) => void): void }> } };
  transaction(fn: (cur: unknown) => unknown): Promise<unknown>;
}
interface UserPage {
  users: { uid: string; providerData?: unknown[]; metadata?: Record<string, string | undefined> }[];
  pageToken?: string;
}
export function removeExpiredLobbies(db: { ref(path: string): Ref }, now: number): Promise<number>;
export function removeStaleAnonymousUsers(
  auth: {
    listUsers(max: number, token?: string): Promise<UserPage>;
    deleteUsers(uids: string[]): Promise<{ successCount: number }>;
  },
  now: number,
  maxAgeMs?: number,
): Promise<number>;
export const ANON_MAX_AGE_MS: number;
