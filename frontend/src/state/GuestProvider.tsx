import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { workspaceApi, profileApi, fromWire } from '../api';
import { APIError, currentToken } from '../api/client';
import { optionKey } from '../domain/college';
import { importSnapshot, reconcileImport, samePreferences } from '../domain/sync';
import { useAuth } from './AuthProvider';
import { EMPTY_PREFERENCES, GUEST_KEY, readGuest, validateGuest } from './guestStorage';
import type { GuestState, Option, Preferences, WorkspaceEntry, ImportConflict, ImportRequest, EntryPayload } from '../types';

interface GuestContextValue {
  state: GuestState; storageError: string; notice: string;
  loading: boolean; saving: boolean; syncError: string;
  conflicts: ImportConflict[]; preferenceConflict: Preferences | null;
  editConflicts: Record<string, WorkspaceEntry>;
  recoveryAvailable: boolean;
  recoveryBackup(): GuestState | null;
  notify(message: string): void;
  addEntry(option: Option, scenario?: WorkspaceEntry['scenario']): Promise<boolean>;
  updateEntry(id: string, patch: Partial<WorkspaceEntry>): Promise<boolean>;
  removeEntry(id: string, revision?: number): Promise<boolean>;
  toggleCompare(option: Option): void;
  setCompare(options: Option[]): void;
  setPreferences(preferences: Preferences): Promise<boolean>;
  retrySync(): Promise<void>;
  resolveImport(clientId: string, useGuest: boolean): Promise<void>;
  resolvePreferences(useGuest: boolean): Promise<void>;
  importBackup(value: unknown): Promise<boolean>;
}

const GuestContext = createContext<GuestContextValue | null>(null);

export function GuestProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [guest, setGuest] = useState(readGuest);
  const guestRef = useRef(guest);
  const [account, setAccount] = useState<{entries: WorkspaceEntry[]; preferences: Preferences}>({
    entries: [], preferences: EMPTY_PREFERENCES,
  });
  const [loaded, setLoaded] = useState(!user);
  const [saving, setSaving] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [recoveryAvailable, setRecoveryAvailable] = useState(() => {
    try { return Boolean(localStorage.getItem(GUEST_KEY + '-recovery')); } catch { return false; }
  });
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [preferenceConflict, setPreferenceConflict] = useState<Preferences | null>(null);
  const [editConflicts, setEditConflicts] = useState<Record<string, WorkspaceEntry>>({});
  const alive = useRef(true);
  const busy = useRef(false);
  const session = currentToken();
  const stillCurrent = () => alive.current && (!user || session === currentToken());
  const state: GuestState = { ...guest, ...(user ? account : {}) };

  const commitGuest = (next: GuestState) => {
    guestRef.current = next;
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('Browser storage is unavailable. Unsynced changes last only for this visit.'); }
    setGuest(next);
  };
  const backup = (): boolean => {
    try {
      const previous = validateGuest(JSON.parse(localStorage.getItem(GUEST_KEY + '-recovery') ?? 'null'));
      const current = guestRef.current;
      const entries = new Map((previous?.entries ?? []).map(entry => [optionKey(entry), entry]));
      current.entries.forEach(entry => entries.set(optionKey(entry), entry));
      const hasPreferences = Boolean(current.preferences.degree || current.preferences.states.length
        || current.preferences.budget !== null);
      const recovery = {...current, entries: [...entries.values()],
        preferences: hasPreferences ? current.preferences : previous?.preferences ?? current.preferences};
      localStorage.setItem(GUEST_KEY + '-recovery', JSON.stringify(recovery));
      setRecoveryAvailable(true);
      return true;
    } catch {
      setStorageError('Could not save a recovery copy. Export a backup before discarding browser notes.');
      return false;
    }
  };
  const removeGuest = (ids: string[]) => commitGuest({
    ...guestRef.current, entries: guestRef.current.entries.filter(entry => !ids.includes(entry.id)),
  });
  const fail = (error: unknown) => {
    if (!stillCurrent()) return false;
    setNotice(error instanceof Error ? error.message : 'Your changes could not be saved. Try again.');
    return false;
  };
  const sync = async () => {
    if (!user || busy.current) return;
    busy.current = true;
    try {
      const [entries, profile] = await Promise.all([workspaceApi.list(), profileApi.get()]);
      if (!stillCurrent()) return;
      setAccount({ entries, preferences: profile ?? guestRef.current.preferences });
      const localPreferences = guestRef.current.preferences;
      if (guestRef.current.entries.length || localPreferences.degree || localPreferences.states.length
        || localPreferences.budget !== null) backup();
      const hasPreferences = Boolean(localPreferences.degree || localPreferences.states.length || localPreferences.budget !== null);
      if (!profile) {
        await profileApi.save(localPreferences);
        if (!stillCurrent()) return;
        commitGuest({ ...guestRef.current, preferences: EMPTY_PREFERENCES });
      } else if (hasPreferences && !samePreferences(profile, localPreferences)) {
        setPreferenceConflict(localPreferences);
      } else if (hasPreferences) commitGuest({ ...guestRef.current, preferences: EMPTY_PREFERENCES });
      const pendingKey = GUEST_KEY + '-import-' + user.id;
      let pending: ImportRequest | null = null;
      try {
        const stored = JSON.parse(localStorage.getItem(pendingKey) ?? 'null');
        if (stored && typeof stored.key === 'string' && Array.isArray(stored.entries)) pending = stored;
      } catch { /* Build a new request from the preserved guest data. */ }
      const importConflicts: ImportConflict[] = [];
      // Replay interrupted requests, then send additions/edits made after their snapshot.
      while (stillCurrent()) {
        const conflicted = new Set(importConflicts.map(conflict => conflict.clientId));
        const candidates = guestRef.current.entries.filter(entry => !conflicted.has(entry.id));
        if (!pending && !candidates.length) break;
        if (!pending) {
          pending = importSnapshot(candidates, crypto.randomUUID());
          try { localStorage.setItem(pendingKey, JSON.stringify(pending)); }
          catch { setStorageError('Could not persist the retry key. Browser notes remain recoverable.'); }
        }
        const result = await workspaceApi.import(pending);
        if (!stillCurrent()) return;
        const reconciled = reconcileImport(guestRef.current.entries, pending, result);
        commitGuest({...guestRef.current, entries: reconciled.remaining});
        importConflicts.push(...reconciled.conflicts);
        try { localStorage.removeItem(pendingKey); } catch { /* Uniqueness still protects retries. */ }
        pending = null;
      }
      if (!stillCurrent()) return;
      setConflicts(importConflicts);
      const refreshed = await workspaceApi.list();
      if (!stillCurrent()) return;
      setAccount(current => ({...current, entries: refreshed}));
      setLoaded(true); setSyncError('');
    } catch (error) {
      if (stillCurrent()) setSyncError(error instanceof Error ? error.message : 'Sync could not finish. Retry when connected.');
    } finally { busy.current = false; }
  };
  useEffect(() => {
    alive.current = true;
    void sync();
    return () => { alive.current = false; };
    // Provider is remounted for every authenticated identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addEntry = async (option: Option, scenario?: WorkspaceEntry['scenario']) => {
    if (user && !loaded) { setNotice('Wait for your account workspace to load, or retry sync.'); return false; }
    const existing = state.entries.find(entry => optionKey(entry) === optionKey(option));
    if (existing) {
      if (scenario) return updateEntry(existing.id, { scenario });
      setNotice('This option is already in your workspace.'); return true;
    }
    const payload: EntryPayload = {
      ...option, stage: 'Researching', notes: '', nextAction: '', targetDate: '',
      ...(scenario ? { scenario } : {}),
    };
    if (!user) {
      commitGuest({ ...guestRef.current, entries: [...guestRef.current.entries, {
        ...payload, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
      }] });
      setNotice('Added to your browser workspace.'); return true;
    }
    setSaving(count => count + 1);
    try {
      const entry = await workspaceApi.create(payload);
      if (!stillCurrent()) return false;
      setAccount(current => ({ ...current, entries: [...current.entries, entry] }));
      setNotice('Added to your account workspace.'); return true;
    } catch (error) { return fail(error); }
    finally { if (stillCurrent()) setSaving(count => count - 1); }
  };
  const updateEntry = async (id: string, patch: Partial<WorkspaceEntry>) => {
    if (!user) {
      commitGuest({ ...guestRef.current, entries: guestRef.current.entries.map(entry => entry.id === id
        ? { ...entry, ...patch, id: entry.id, collegeId: entry.collegeId, courseId: entry.courseId } : entry) });
      return true;
    }
    const existing = account.entries.find(entry => entry.id === id);
    if (!existing) return false;
    setSaving(count => count + 1);
    try {
      const entry = await workspaceApi.update(id, patch, patch.revision ?? existing.revision ?? 1);
      if (!stillCurrent()) return false;
      setAccount(current => ({ ...current, entries: current.entries.map(item => item.id === id ? entry : item) }));
      setEditConflicts(current => { const next = { ...current }; delete next[id]; return next; });
      return true;
    } catch (error) {
      if (stillCurrent() && error instanceof APIError && error.current) {
        const latest = fromWire(error.current);
        setEditConflicts(current => ({ ...current, [id]: latest }));
        setConflicts(current => current.map(conflict => conflict.account.id === id
          ? {...conflict, account: latest} : conflict));
        setAccount(current => ({ ...current, entries: current.entries.map(item => item.id === id ? latest : item) }));
      }
      return fail(error);
    } finally { if (stillCurrent()) setSaving(count => count - 1); }
  };
  const removeEntry = async (id: string, revision?: number) => {
    if (!user) { removeGuest([id]); setNotice('Option removed from workspace.'); return true; }
    const existing = account.entries.find(entry => entry.id === id);
    if (!existing) return false;
    try {
      await workspaceApi.remove(id, revision ?? existing.revision ?? 1);
      if (!stillCurrent()) return false;
      setAccount(current => ({ ...current, entries: current.entries.filter(entry => entry.id !== id) }));
      setNotice('Option removed from your account.'); return true;
    } catch (error) {
      if (stillCurrent() && error instanceof APIError && error.current) {
        const latest = fromWire(error.current);
        setEditConflicts(current => ({...current, [id]: latest}));
        setAccount(current => ({...current, entries: current.entries.map(item => item.id === id ? latest : item)}));
      }
      return fail(error);
    }
  };
  const setPreferences = async (preferences: Preferences) => {
    if (!user) { commitGuest({ ...guestRef.current, preferences }); return true; }
    setSaving(count => count + 1);
    try {
      const saved = await profileApi.save(preferences);
      if (!stillCurrent()) return false;
      setAccount(current => ({ ...current, preferences: saved })); return true;
    } catch (error) { return fail(error); }
    finally { if (stillCurrent()) setSaving(count => count - 1); }
  };
  const resolveImport = async (clientId: string, useGuest: boolean) => {
    const conflict = conflicts.find(item => item.clientId === clientId);
    if (!conflict) return;
    if (useGuest && !await updateEntry(conflict.account.id, {
      ...conflict.guest, targetDate: conflict.guest.targetDate ?? '', revision: conflict.account.revision,
    })) return;
    if (!backup()) return;
    removeGuest([clientId]);
    setConflicts(current => current.filter(item => item.clientId !== clientId));
    setNotice(useGuest ? 'Your browser version is saved to your account.' : 'Your account version was kept. A browser recovery copy is available.');
  };
  const resolvePreferences = async (useGuest: boolean) => {
    if (!preferenceConflict) return;
    if (useGuest && !await setPreferences(preferenceConflict)) return;
    if (!backup()) return;
    commitGuest({ ...guestRef.current, preferences: EMPTY_PREFERENCES });
    setPreferenceConflict(null);
  };
  const importBackup = async (value: unknown) => {
    const imported = validateGuest(value);
    if (!imported || !value || typeof value !== 'object' || !('entries' in value)
      || !Array.isArray(value.entries) || imported.entries.length !== value.entries.length) {
      setNotice('This backup contains invalid or duplicate options. Nothing was imported.'); return false;
    }
    if (!backup()) return false;
    const existing = new Set(guestRef.current.entries.map(optionKey));
    commitGuest({ ...guestRef.current,
      entries: [...guestRef.current.entries, ...imported.entries.filter(entry => !existing.has(optionKey(entry)))],
      preferences: imported.preferences, compare: imported.compare,
    });
    if (user) await sync();
    else setNotice('Workspace backup imported. Existing browser options were kept.');
    return true;
  };

  return <GuestContext.Provider value={{ state, storageError, notice, loading: Boolean(user && !loaded),
    saving: saving > 0, syncError, conflicts, preferenceConflict, editConflicts, recoveryAvailable,
    recoveryBackup: () => {
      try { return validateGuest(JSON.parse(localStorage.getItem(GUEST_KEY + '-recovery') ?? 'null')); }
      catch { return null; }
    },
    notify: setNotice, addEntry, updateEntry, removeEntry, setPreferences, resolveImport,
    resolvePreferences, retrySync: sync, importBackup,
    toggleCompare: option => {
      const exists = guestRef.current.compare.some(item => optionKey(item) === optionKey(option));
      if (!exists && guestRef.current.compare.length >= 3) { setNotice('Compare holds up to three options. Remove one to add another.'); return; }
      commitGuest({ ...guestRef.current, compare: exists
        ? guestRef.current.compare.filter(item => optionKey(item) !== optionKey(option))
        : [...guestRef.current.compare, option] });
      setNotice(exists ? 'Removed from comparison.' : 'Added to comparison.');
    },
    setCompare: compare => commitGuest({ ...guestRef.current, compare }),
  }}>{user && !loaded ? <div className="connection-screen">
    <h1>{syncError ? "Let's reconnect your workspace." : 'Bringing your workspace together…'}</h1>
    <p>{syncError || 'Your browser notes are kept safe while your account loads.'}</p>
    {syncError && <div><button className="button primary" onClick={() => void sync()}>Retry sync</button>
      <button className="button secondary" onClick={logout}>Continue as a guest</button></div>}
  </div> : children}</GuestContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGuest() {
  const value = useContext(GuestContext);
  if (!value) throw new Error('GuestProvider is required');
  return value;
}
