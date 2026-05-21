import { createFileRoute, redirect } from "@tanstack/react-router";
import { PhotoGallery } from "../components/PhotoGallery";
import { PhotoUpload } from "../components/PhotoUpload";
import { authSessionQueryOptions } from "../lib/authSession";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      authSessionQueryOptions,
    );
    if (!session.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: HomePage,
});

function HomePage() {
  return (
    <main className="grid gap-5 md:grid-cols-2 md:items-start">
      <PhotoUpload />
      <PhotoGallery />
    </main>
  );
}
