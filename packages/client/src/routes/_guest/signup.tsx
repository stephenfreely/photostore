import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "../../components/SignUpForm";

export const Route = createFileRoute("/_guest/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  return <SignUpForm />;
}
