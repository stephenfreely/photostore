import { useQuery } from "@tanstack/react-query";
import { resolveGuestIdentityId } from "../lib/guestIdentity";

export const guestIdentityKeys = {
  all: ["guest", "identity"] as const,
  current: () => [...guestIdentityKeys.all, "current"] as const,
};

/** Resolves Cognito Identity Pool id for unauthenticated (guest) access. */
export function useGuestIdentity(enabled: boolean) {
  return useQuery({
    queryKey: guestIdentityKeys.current(),
    queryFn: resolveGuestIdentityId,
    enabled,
    retry: 1,
    staleTime: Infinity,
  });
}
