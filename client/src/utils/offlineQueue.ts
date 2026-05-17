/**
 * offlineQueue — Write-behind queue for session mutations that fail due to
 * network loss. Persists to localStorage so it survives page refreshes.
 * Replays on next `online` event.
 */

export interface QueuedWrite {
  id: string;            // client-side UUID for dedup
  url: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
  addedAt: number;       // ms timestamp
}

const QUEUE_KEY = 'pomodoro:offline_queue';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // drop writes older than 24h

const load = (): QueuedWrite[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: QueuedWrite[] = JSON.parse(raw);
    // Prune stale entries
    const now = Date.now();
    return parsed.filter((w) => now - w.addedAt < MAX_AGE_MS);
  } catch {
    return [];
  }
};

const save = (queue: QueuedWrite[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full — ignore
  }
};

export const offlineQueue = {
  enqueue(write: Omit<QueuedWrite, 'id' | 'addedAt'>) {
    const queue = load();
    queue.push({
      ...write,
      id: crypto.randomUUID(),
      addedAt: Date.now(),
    });
    save(queue);
  },

  dequeue(id: string) {
    const queue = load().filter((w) => w.id !== id);
    save(queue);
  },

  getAll(): QueuedWrite[] {
    return load();
  },

  clear() {
    localStorage.removeItem(QUEUE_KEY);
  },
};

/**
 * Replay all queued writes. Called on `online` event.
 * Each write is attempted once; on success it is removed from the queue.
 * On failure it remains for the next replay.
 */
export const replayOfflineQueue = async (
  apiBase = '/api',
  getToken: () => string | null
) => {
  const queue = offlineQueue.getAll();
  if (queue.length === 0) return;

  console.info(`[offline-queue] Replaying ${queue.length} queued write(s)…`);

  for (const write of queue) {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}${write.url}`, {
        method: write.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(write.body),
        credentials: 'include',
      });

      if (res.ok || res.status === 404) {
        // 404 = session already ended server-side; treat as success
        offlineQueue.dequeue(write.id);
        console.info(`[offline-queue] Replayed: ${write.method} ${write.url}`);
      } else {
        console.warn(`[offline-queue] Replay failed (${res.status}): ${write.url}`);
      }
    } catch (err) {
      console.warn(`[offline-queue] Network error during replay: ${write.url}`, err);
    }
  }
};
