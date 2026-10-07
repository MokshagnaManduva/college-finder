import { toWire } from '../api/index.ts';
import type { ImportRequest, ImportResult, Preferences, WorkspaceEntry } from '../types/index.ts';

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ':' + stable(item)).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function samePreferences(a: Preferences, b: Preferences): boolean {
  return stable({...a, states: [...a.states].sort()}) === stable({...b, states: [...b.states].sort()});
}

export function importSnapshot(entries: WorkspaceEntry[], key: string): ImportRequest {
  return {key, entries: entries.slice(0, 200).map(entry => ({...toWire(entry), clientId: entry.id}))};
}

export function reconcileImport(entries: WorkspaceEntry[], pending: ImportRequest, result: ImportResult) {
  const snapshot = new Map(pending.entries.map(entry => [entry.clientId, entry]));
  const unchanged = (entry: WorkspaceEntry) => stable({...toWire(entry), clientId: entry.id})
    === stable(snapshot.get(entry.id));
  const confirmed = new Set(result.imported.map(entry => entry.clientId));
  const current = new Map(entries.map(entry => [entry.id, entry]));
  return {
    remaining: entries.filter(entry => !confirmed.has(entry.id) || !unchanged(entry)),
    conflicts: result.conflicts.filter(conflict => {
      const entry = current.get(conflict.clientId);
      return Boolean(entry && unchanged(entry));
    }),
  };
}
