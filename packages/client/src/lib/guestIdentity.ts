import { fetchAuthSession } from "aws-amplify/auth";

/** Matches backend `X-Guest-Identity-Id` header. */
export const GUEST_IDENTITY_HEADER = "X-Guest-Identity-Id";

/** Legacy single-id key (read for migration only). */
const LEGACY_STORAGE_KEY = "photostore_guest_identity_id";

/** Identity ids that have guest uploads pending merge (survives Cognito identity linking). */
const PENDING_MERGE_KEY = "photostore_pending_guest_identity_ids";

/**
 * Cognito Identity Pool id for the current browser session (guest or linked).
 */
export async function resolveGuestIdentityId(): Promise<string> {
  const session = await fetchAuthSession();
  const identityId = session.identityId;
  if (!identityId) {
    throw new Error(
      "No Cognito identity id — check VITE_IDENTITY_POOL_ID and that unauthenticated identities are enabled",
    );
  }
  return identityId;
}

function readPendingMergeIds(): string[] {
  try {
    const raw = localStorage.getItem(PENDING_MERGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function writePendingMergeIds(ids: string[]): void {
  if (ids.length === 0) {
    localStorage.removeItem(PENDING_MERGE_KEY);
    return;
  }
  localStorage.setItem(PENDING_MERGE_KEY, JSON.stringify([...new Set(ids)]));
}

/** Call after a successful guest upload — id used for merge after sign-in. */
export function trackGuestIdentityForMerge(identityId: string): void {
  const ids = readPendingMergeIds();
  if (!ids.includes(identityId)) {
    writePendingMergeIds([...ids, identityId]);
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

/** All guest identity ids with uploads waiting to merge. */
export function getPendingGuestIdentityIds(): string[] {
  const pending = readPendingMergeIds();
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy && !pending.includes(legacy)) {
    return [...pending, legacy];
  }
  return pending;
}

export function removePendingGuestIdentityId(identityId: string): void {
  writePendingMergeIds(readPendingMergeIds().filter((id) => id !== identityId));
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === identityId) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

export function clearAllPendingGuestIdentityIds(): void {
  localStorage.removeItem(PENDING_MERGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

/** @deprecated Use getPendingGuestIdentityIds */
export function getStoredGuestIdentityId(): string | null {
  const pending = getPendingGuestIdentityIds();
  return pending[0] ?? null;
}

/** @deprecated Use removePendingGuestIdentityId */
export function clearStoredGuestIdentityId(): void {
  clearAllPendingGuestIdentityIds();
}
