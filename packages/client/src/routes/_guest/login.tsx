import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "../../components/SignInForm";

export const Route = createFileRoute("/_guest/login")({
  component: LoginPage,
});

function LoginPage() {
  return <SignInForm />;
}
