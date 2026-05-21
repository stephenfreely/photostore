import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { PageGridSkeleton } from "../components/ui/Skeleton";
import { useAuthSession, useSignOut } from "../hooks/useAuth";
import { useHello } from "../hooks/useHealth";
import { usePendingGuestMerge } from "../hooks/usePendingGuestMerge";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  usePendingGuestMerge();
  const session = useAuthSession();
  const signOut = useSignOut();
  const hello = useHello();

  const isAuthenticated = session.data?.isAuthenticated ?? false;

  return (
    <div className="mx-auto max-w-[960px] px-5 py-8 pb-12">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1.5 text-[1.75rem] leading-tight">Photostore</h1>
          <p className="m-0 text-muted">React client for the photostore AWS API</p>
        </div>
        {isAuthenticated && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-border-input bg-transparent px-4 py-2.5 font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            Sign out
          </button>
        )}
      </header>

      {hello.isSuccess && (
        <p
          className="mb-5 inline-block rounded-full bg-success-muted px-2.5 py-1 text-sm text-success"
          title={hello.data.routeKey}
        >
          API: {hello.data.message}
        </p>
      )}

      {session.isLoading ? <PageGridSkeleton /> : <Outlet />}
    </div>
  );
}
