import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useSignIn } from "../hooks/useAuth";

export function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useSignIn();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    signIn.mutate(
      { username: email, password },
      {
        onSuccess: (output) => {
          if (output.isSignedIn) {
            void navigate({ to: "/" });
          }
        },
      },
    );
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

      <p className="auth-footer">
        <Link to="/forgot-password" className="link">
          Forgot password?
        </Link>
      </p>

      {signIn.isError && (
        <p className="error" role="alert">
          {signIn.error instanceof Error ? signIn.error.message : "Sign in failed"}
        </p>
      )}

      <button type="submit" disabled={signIn.isPending}>
        {signIn.isPending ? "Signing in…" : "Sign in"}
      </button>

      <p className="auth-footer muted">
        Need an account?{" "}
        <Link to="/signup" className="link">
          Sign up
        </Link>
      </p>
    </form>
  );
}
