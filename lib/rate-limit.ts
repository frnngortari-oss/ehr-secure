type AttemptEntry = {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
};

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

declare global {
  // eslint-disable-next-line no-var
  var __ehrLoginAttempts: Map<string, AttemptEntry> | undefined;
}

function getStore() {
  if (!global.__ehrLoginAttempts) {
    global.__ehrLoginAttempts = new Map<string, AttemptEntry>();
  }
  return global.__ehrLoginAttempts;
}

function keyFor(clientId: string, username: string) {
  return `${clientId}|${username.trim().toLowerCase() || "unknown"}`;
}

function prune(store: Map<string, AttemptEntry>, now: number) {
  for (const [key, value] of store.entries()) {
    const expiredWindow = now - value.firstAttemptAt > WINDOW_MS;
    const expiredBlock = value.blockedUntil !== null && now >= value.blockedUntil;
    if (expiredWindow && expiredBlock) {
      store.delete(key);
    }
  }
}

export function getLoginBlockRemainingMs(clientId: string, username: string) {
  const now = Date.now();
  const store = getStore();
  prune(store, now);
  const entry = store.get(keyFor(clientId, username));
  if (!entry || entry.blockedUntil === null) return 0;
  const remaining = entry.blockedUntil - now;
  return remaining > 0 ? remaining : 0;
}

export function registerFailedLogin(clientId: string, username: string) {
  const now = Date.now();
  const store = getStore();
  prune(store, now);
  const key = keyFor(clientId, username);
  const current = store.get(key);

  if (!current || now - current.firstAttemptAt > WINDOW_MS) {
    store.set(key, {
      attempts: 1,
      firstAttemptAt: now,
      blockedUntil: null
    });
    return;
  }

  const attempts = current.attempts + 1;
  const blockedUntil = attempts >= MAX_ATTEMPTS ? now + BLOCK_MS : current.blockedUntil;
  store.set(key, {
    attempts,
    firstAttemptAt: current.firstAttemptAt,
    blockedUntil
  });
}

export function clearLoginAttempts(clientId: string, username: string) {
  const store = getStore();
  store.delete(keyFor(clientId, username));
}
