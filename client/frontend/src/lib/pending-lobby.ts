const KEY = "oyna_pending_lobby";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export type PendingLobby = { token: string; path: string; savedAt: number };

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function rememberLobby(
  token: string,
  storage = browserStorage(),
): PendingLobby {
  const pending = {
    token,
    path: `/j/${encodeURIComponent(token)}`,
    savedAt: Date.now(),
  };
  try {
    storage?.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* Storage can be unavailable in private mode. */
  }
  return pending;
}

export function pendingLobby(storage = browserStorage()): PendingLobby | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      typeof value.token !== "string" ||
      !value.token ||
      value.token.length > 512 ||
      value.path !== `/j/${encodeURIComponent(value.token)}` ||
      typeof value.savedAt !== "number"
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

// Another tab may have scanned a newer room; only clear the lobby actually joined.
export function completeLobby(token: string, storage = browserStorage()) {
  try {
    if (pendingLobby(storage)?.token === token) storage?.removeItem(KEY);
  } catch {
    /* Ignore blocked storage. */
  }
}

export function afterAuthentication() {
  return pendingLobby()?.path ?? "/home";
}

export function normalizePhone(value: string): string | null {
  if (!/^[+\d\s()-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.startsWith("8") && digits.length === 11)
    digits = `7${digits.slice(1)}`;
  return /^7\d{10}$/.test(digits) ? `+${digits}` : null;
}
