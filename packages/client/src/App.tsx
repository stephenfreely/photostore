import { PhotoGallery } from "./components/PhotoGallery";
import { PhotoUpload } from "./components/PhotoUpload";
import { GuestPhotoSection } from "./components/GuestPhotoSection";
import { AuthPanel } from "./components/AuthPanel";
import { useAuthSession, useSignOut } from "./hooks/useAuth";
import { useHello } from "./hooks/useHealth";
import { usePendingGuestMerge } from "./hooks/usePendingGuestMerge";

export default function App() {
  const session = useAuthSession();
  usePendingGuestMerge();
  const signOut = useSignOut();
  const hello = useHello();

  const isAuthenticated = session.data?.isAuthenticated ?? false;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Photostore</h1>
          <p className="muted">React client for the photostore AWS API</p>
        </div>
        {isAuthenticated && (
          <button
            type="button"
            className="secondary"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            Sign out
          </button>
        )}
      </header>

      {hello.isSuccess && (
        <p className="status-pill" title={hello.data.routeKey}>
          API: {hello.data.message}
        </p>
      )}

      {session.isLoading ? (
        <p className="muted">Checking session…</p>
      ) : isAuthenticated ? (
        <main className="grid">
          <PhotoUpload />
          <PhotoGallery />
        </main>
      ) : (
        <main className="grid">
          <GuestPhotoSection />
          <AuthPanel />
        </main>
      )}
    </div>
  );
}
