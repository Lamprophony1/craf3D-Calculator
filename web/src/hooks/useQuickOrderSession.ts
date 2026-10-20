import { useRef } from 'react';

const KEY = 'printcost.quick-order-session.v1';
const documentId = crypto.randomUUID();
interface Session { id: string; sequence: number; key: string; owner?: string; }
const claims = new Map<string, Promise<boolean>>();
function claim(id: string, owner?: string): Promise<boolean> {
  const previous = claims.get(id);
  if (previous) return previous;
  // A browser duplicates sessionStorage along with the tab. A document-held
  // lock distinguishes that copy from a reload, where the old lock is released.
  const pending = navigator.locks
    ? new Promise<boolean>(resolve => {
      void navigator.locks.request(`printcost.quick.${id}`, { ifAvailable: true }, lock => {
        resolve(Boolean(lock));
        return lock ? new Promise<void>(() => {}) : undefined;
      }).catch(() => resolve(false));
    })
    // Older browsers get a fresh session after navigation, never a shared writer.
    : Promise.resolve(owner === documentId);
  claims.set(id, pending);
  return pending;
}
function restore(): Session | null {
  try { const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Session | null;
    return value && typeof value.id === 'string' && Number.isInteger(value.sequence) ? value : null;
  } catch { return null; }
}
export function useQuickOrderSession() {
  const current = useRef<Session | null>(restore());
  const active = useRef(Boolean(current.current));
  const edited = useRef(false);
  const ready = useRef<Promise<void> | null>(null);
  if (!ready.current) {
    const restored = current.current;
    ready.current = restored ? claim(restored.id, restored.owner).then(owned => {
      if (!owned && current.current === restored) {
        current.current = null; active.current = edited.current; sessionStorage.removeItem(KEY);
      }
    }) : Promise.resolve();
  }
  return {
    active,
    ready: () => ready.current!,
    start: () => { edited.current = true; active.current = true; },
    next: async (payload: unknown) => {
      await ready.current;
      const key = JSON.stringify(payload);
      const previous = current.current;
      const value = { id: previous?.id ?? crypto.randomUUID(), sequence: previous ? previous.sequence + (key === previous.key ? 0 : 1) : 1, key, owner: documentId };
      current.current = value; sessionStorage.setItem(KEY, JSON.stringify(value));
      if (!previous) await claim(value.id, documentId);
      return { sessionId: value.id, sequence: value.sequence };
    },
    reset: () => { current.current = null; edited.current = false; active.current = false; sessionStorage.removeItem(KEY); }
  };
}
