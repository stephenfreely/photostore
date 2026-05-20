import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { GuestPhotoSection } from "../components/GuestPhotoSection";
import { authSessionQueryOptions } from "../lib/authSession";

export const Route = createFileRoute("/_guest")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      authSessionQueryOptions,
    );
    if (session.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: GuestLayout,
});

function GuestLayout() {
  return (
    <main className="grid">
      <GuestPhotoSection />
      <Outlet />
    </main>
  );
}
