import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useSignIn } from "../hooks/useAuth";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useSignIn();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    signIn.mutate({ username: email, password });
  }

  return (
    <form
      className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5"
      onSubmit={handleSubmit}
    >
      <h2 className="mb-1.5 text-lg leading-tight">Sign in</h2>
      <p className="m-0 text-muted">Sign in with your photostore account.</p>

      <label className="flex flex-col gap-1.5 text-sm text-label">
        Email
        <input
          className="w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-label">
        Password
        <input
          className="w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      <p className="m-0 text-center text-sm">
        <Link
          to="/forgot-password"
          className="font-medium text-accent underline underline-offset-2"
        >
          Forgot password?
        </Link>
      </p>

      {signIn.isError && (
        <p className="m-0 text-sm text-error" role="alert">
          {signIn.error instanceof Error ? signIn.error.message : "Sign in failed"}
        </p>
      )}

      <button
        type="submit"
        className="cursor-pointer rounded-lg bg-accent px-4 py-2.5 font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-60"
        disabled={signIn.isPending}
      >
        {signIn.isPending ? "Signing in…" : "Sign in"}
      </button>

      <p className="m-0 text-center text-sm text-muted">
        Need an account?{" "}
        <Link
          to="/signup"
          className="font-medium text-accent underline underline-offset-2"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
