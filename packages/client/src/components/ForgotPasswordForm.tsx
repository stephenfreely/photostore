import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  useConfirmResetPassword,
  useResetPassword,
} from "../hooks/useAuth";

type Step = "request" | "confirm";

function formatDeliveryDestination(
  destination?: string,
  deliveryMedium?: string,
): string {
  if (!destination) {
    return "your email";
  }
  if (deliveryMedium === "EMAIL") {
    return destination;
  }
  return destination;
}

const inputClassName =
  "w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit";
const labelClassName = "flex flex-col gap-1.5 text-sm text-label";
const formClassName =
  "flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5";
const buttonClassName =
  "cursor-pointer rounded-lg bg-accent px-4 py-2.5 font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-60";
const linkButtonClassName =
  "cursor-pointer border-none bg-transparent p-0 font-[inherit] font-medium text-accent underline underline-offset-2";

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [deliveryHint, setDeliveryHint] = useState("your email");
  const [resetDone, setResetDone] = useState(false);

  const resetPassword = useResetPassword();
  const confirmReset = useConfirmResetPassword();

  function goToSignIn() {
    void navigate({ to: "/login" });
  }

  function handleRequestSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    resetPassword.mutate(
      { username: email },
      {
        onSuccess: (output) => {
          if (
            output.nextStep.resetPasswordStep ===
            "CONFIRM_RESET_PASSWORD_WITH_CODE"
          ) {
            const { codeDeliveryDetails } = output.nextStep;
            setDeliveryHint(
              formatDeliveryDestination(
                codeDeliveryDetails?.destination,
                codeDeliveryDetails?.deliveryMedium,
              ),
            );
            setStep("confirm");
            return;
          }

          if (output.nextStep.resetPasswordStep === "DONE") {
            setResetDone(true);
          }
        },
      },
    );
  }

  function handleConfirmSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    confirmReset.mutate(
      {
        username: email,
        confirmationCode: code,
        newPassword,
      },
      {
        onSuccess: () => {
          setResetDone(true);
        },
      },
    );
  }

  if (resetDone) {
    return (
      <div className={formClassName}>
        <h2 className="mb-1.5 text-lg leading-tight">Password updated</h2>
        <p className="m-0 text-sm text-success" role="status">
          Your password has been reset. Sign in with your new password.
        </p>
        <button type="button" className={buttonClassName} onClick={goToSignIn}>
          Back to sign in
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <form className={formClassName} onSubmit={handleConfirmSubmit}>
        <h2 className="mb-1.5 text-lg leading-tight">Reset password</h2>
        <p className="m-0 text-muted">
          Enter the code sent to {deliveryHint} and choose a new password.
        </p>

        <label className={labelClassName}>
          Confirmation code
          <input
            className={inputClassName}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>

        <label className={labelClassName}>
          New password
          <input
            className={inputClassName}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        <label className={labelClassName}>
          Confirm new password
          <input
            className={inputClassName}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {(localError || confirmReset.isError) && (
          <p className="m-0 text-sm text-error" role="alert">
            {localError ??
              (confirmReset.error instanceof Error
                ? confirmReset.error.message
                : "Reset failed")}
          </p>
        )}

        <button type="submit" className={buttonClassName} disabled={confirmReset.isPending}>
          {confirmReset.isPending ? "Updating…" : "Update password"}
        </button>

        <p className="m-0 text-center text-sm text-muted">
          <button
            type="button"
            className={linkButtonClassName}
            onClick={() => {
              setStep("request");
              setCode("");
              setNewPassword("");
              setConfirmPassword("");
            }}
          >
            Use a different email
          </button>
          {" · "}
          <button type="button" className={linkButtonClassName} onClick={goToSignIn}>
            Back to sign in
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className={formClassName} onSubmit={handleRequestSubmit}>
      <h2 className="mb-1.5 text-lg leading-tight">Forgot password</h2>
      <p className="m-0 text-muted">
        Enter your account email and we will send a reset code.
      </p>

      <label className={labelClassName}>
        Email
        <input
          className={inputClassName}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      {resetPassword.isError && (
        <p className="m-0 text-sm text-error" role="alert">
          {resetPassword.error instanceof Error
            ? resetPassword.error.message
            : "Could not send reset code"}
        </p>
      )}

      <button type="submit" className={buttonClassName} disabled={resetPassword.isPending}>
        {resetPassword.isPending ? "Sending…" : "Send reset code"}
      </button>

      <p className="m-0 text-center text-sm text-muted">
        Remember your password?{" "}
        <Link
          to="/login"
          className="font-medium text-accent underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
