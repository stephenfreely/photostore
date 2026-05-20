import { queryOptions } from "@tanstack/react-query";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

export const authKeys = {
  session: ["auth", "session"] as const,
};

export type AuthSession = {
  isAuthenticated: boolean;
  user: Awaited<ReturnType<typeof getCurrentUser>> | null;
};

export async function fetchAuthSessionState(): Promise<AuthSession> {
  try {
    const [user, session] = await Promise.all([
      getCurrentUser(),
      fetchAuthSession(),
    ]);
    const hasToken = Boolean(session.tokens?.idToken);
    return { isAuthenticated: hasToken, user: hasToken ? user : null };
  } catch {
    return { isAuthenticated: false, user: null };
  }
}

export const authSessionQueryOptions = queryOptions({
  queryKey: authKeys.session,
  queryFn: fetchAuthSessionState,
  retry: false,
});
