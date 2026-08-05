type InspirationRefreshListener = (spaceId: string | null) => void;

let refreshVersion = 0;
const listeners = new Set<InspirationRefreshListener>();

/** Bump after a successful inspiration save so lists refetch. */
export function notifyInspirationSaved(spaceId: string | null): void {
  refreshVersion += 1;
  listeners.forEach((listener) => listener(spaceId));
}

export function getInspirationRefreshVersion(): number {
  return refreshVersion;
}

export function subscribeInspirationSaved(listener: InspirationRefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
