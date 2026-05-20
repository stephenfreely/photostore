import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordForm } from "../../components/ForgotPasswordForm";

export const Route = createFileRoute("/_guest/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
