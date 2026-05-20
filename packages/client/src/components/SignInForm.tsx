import { useState, type FormEvent } from "react";
import { useSignIn } from "../hooks/useAuth";

type SignInFormProps = {
  onSwitchToSignUp?: () => void;
  onForgotPassword?: () => void;
};

export function SignInForm({ onSwitchToSignUp, onForgotPassword }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useSignIn();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    signIn.mutate({ username: email, password });
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <p className="muted">Sign in with your photostore account.</p>

      <label>
        Email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {onForgotPassword && (
        <p className="auth-footer">
          <button type="button" className="link" onClick={onForgotPassword}>
            Forgot password?
          </button>
        </p>
      )}

      {signIn.isError && (
        <p className="error" role="alert">
          {signIn.error instanceof Error ? signIn.error.message : "Sign in failed"}
        </p>
      )}

      <button type="submit" disabled={signIn.isPending}>
        {signIn.isPending ? "Signing in…" : "Sign in"}
      </button>

      {onSwitchToSignUp && (
        <p className="auth-footer muted">
          Need an account?{" "}
          <button type="button" className="link" onClick={onSwitchToSignUp}>
            Sign up
          </button>
        </p>
      )}
    </form>
  );
}
