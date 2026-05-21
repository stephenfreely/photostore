import { fetchAuthSession } from "aws-amplify/auth";
import { mergeGuestPhotos } from "../api/photos";
import {
  clearAllPendingGuestIdentityIds,
  getPendingGuestIdentityIds,
  removePendingGuestIdentityId,
} from "./guestIdentity";

async function ensureAuthSession(): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const session = await fetchAuthSession({
      forceRefresh: attempt === 0,
    });
    if (session.tokens?.idToken) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
  throw new Error("Not signed in");
}

/**
 * After sign-in, move guest S3/DynamoDB rows to the User Pool `sub`.
 *
 * Uses identity ids captured at guest upload time so merge still works when
 * Cognito links/replaces the identity id for returning users.
 */
export async function mergeGuestOnLogin(): Promise<number> {
  const pendingIds = getPendingGuestIdentityIds();
  if (pendingIds.length === 0) {
    return 0;
  }

  await ensureAuthSession();

  let totalMerged = 0;

  for (const guestIdentityId of pendingIds) {
    try {
      const result = await mergeGuestPhotos(guestIdentityId);
      totalMerged += result.mergedCount;
      removePendingGuestIdentityId(guestIdentityId);
    } catch (err) {
      console.error("Guest merge failed for", guestIdentityId, err);
      // Keep this id in pending so we can retry (e.g. auth not ready yet)
    }
  }

  if (getPendingGuestIdentityIds().length === 0) {
    clearAllPendingGuestIdentityIds();
  }

  return totalMerged;
}
