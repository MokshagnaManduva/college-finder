import type { WorkspaceEntry } from '../types';

const TOKEN_KEY = 'college-finder-session';
export const SESSION_EVENT = 'college-finder-session-change';
export const DEMO_MODE = typeof window === 'undefined' || window.location.protocol === 'file:'
  || import.meta.env?.VITE_DATA_MODE === 'demo';
const BASE = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');

function initialToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
let sessionToken = initialToken();
export function currentToken() { return sessionToken; }

export function storeToken(token: string | null, dispatch = false): boolean {
  sessionToken = token;
  let persisted = true;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { persisted = false; }
  if (dispatch && typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EVENT));
  return persisted;
}
export function isSessionStorageEvent(event: StorageEvent) { return event.key === TOKEN_KEY; }

export class APIError extends Error {
  status: number;
  current?: WorkspaceEntry;
  constructor(status: number, detail: unknown) {
    let message = 'Something went wrong. Please try again.';
    if (typeof detail === 'string') message = detail;
    else if (Array.isArray(detail)) message = detail.slice(0, 3).map(item => item.msg ?? 'Invalid input').join('. ');
    else if (detail && typeof detail === 'object' && 'message' in detail) message = String(detail.message);
    super(message);
    this.status = status;
    if (detail && typeof detail === 'object' && 'current' in detail) this.current = detail.current as WorkspaceEntry;
  }
}

export async function request<T>(path: string, options: {
  method?: string; body?: unknown; token?: string | null;
} = {}): Promise<T> {
  const token = options.token === undefined ? sessionToken : options.token;
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch { throw new APIError(0, 'We could not reach the server. Your input has been kept; try again.'); }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token && token === sessionToken) storeToken(null, true);
    throw new APIError(response.status, data.detail);
  }
  return data as T;
}
