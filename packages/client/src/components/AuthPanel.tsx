import { useState } from "react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

type AuthMode = "signIn" | "signUp" | "forgotPassword";

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("signIn");

  if (mode === "signUp") {
    return <SignUpForm onSwitchToSignIn={() => setMode("signIn")} />;
  }

  if (mode === "forgotPassword") {
    return <ForgotPasswordForm onSwitchToSignIn={() => setMode("signIn")} />;
  }

  return (
    <SignInForm
      onSwitchToSignUp={() => setMode("signUp")}
      onForgotPassword={() => setMode("forgotPassword")}
    />
  );
}
