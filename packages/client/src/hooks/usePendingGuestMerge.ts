import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { photoKeys } from "../api/photos";
import { getPendingGuestIdentityIds } from "../lib/guestIdentity";
import { mergeGuestOnLogin } from "../lib/mergeGuestOnLogin";
import { useAuthSession } from "./useAuth";

/**
 * Retries guest merge whenever the user becomes authenticated.
 * Covers returning users (Cognito identity linking) and failed first attempts.
 */
export function usePendingGuestMerge() {
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const ranForAuthRef = useRef(false);

  const isAuthenticated = session.data?.isAuthenticated ?? false;

  useEffect(() => {
    if (!isAuthenticated) {
      ranForAuthRef.current = false;
      return;
    }

    if (ranForAuthRef.current) {
      return;
    }

    const pending = getPendingGuestIdentityIds();
    if (pending.length === 0) {
      return;
    }

    ranForAuthRef.current = true;

    void (async () => {
      const merged = await mergeGuestOnLogin();
      if (merged > 0) {
        void queryClient.invalidateQueries({ queryKey: photoKeys.all });
      }
    })();
  }, [isAuthenticated, queryClient]);
}
