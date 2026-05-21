import { useState, type FormEvent } from "react";
import {
  useConfirmResetPassword,
  useResetPassword,
} from "../hooks/useAuth";

type ForgotPasswordFormProps = {
  onSwitchToSignIn: () => void;
};

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

export function ForgotPasswordForm({ onSwitchToSignIn }: ForgotPasswordFormProps) {
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
      <div className="card">
        <h2>Password updated</h2>
        <p className="success" role="status">
          Your password has been reset. Sign in with your new password.
        </p>
        <button type="button" onClick={onSwitchToSignIn}>
          Back to sign in
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <form className="card" onSubmit={handleConfirmSubmit}>
        <h2>Reset password</h2>
        <p className="muted">
          Enter the code sent to {deliveryHint} and choose a new password.
        </p>

        <label>
          Confirmation code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>

        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {(localError || confirmReset.isError) && (
          <p className="error" role="alert">
            {localError ??
              (confirmReset.error instanceof Error
                ? confirmReset.error.message
                : "Reset failed")}
          </p>
        )}

        <button type="submit" disabled={confirmReset.isPending}>
          {confirmReset.isPending ? "Updating…" : "Update password"}
        </button>

        <p className="auth-footer muted">
          <button
            type="button"
            className="link"
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
          <button type="button" className="link" onClick={onSwitchToSignIn}>
            Back to sign in
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={handleRequestSubmit}>
      <h2>Forgot password</h2>
      <p className="muted">
        Enter your account email and we will send a reset code.
      </p>

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

      {resetPassword.isError && (
        <p className="error" role="alert">
          {resetPassword.error instanceof Error
            ? resetPassword.error.message
            : "Could not send reset code"}
        </p>
      )}

      <button type="submit" disabled={resetPassword.isPending}>
        {resetPassword.isPending ? "Sending…" : "Send reset code"}
      </button>

      <p className="auth-footer muted">
        Remember your password?{" "}
        <button type="button" className="link" onClick={onSwitchToSignIn}>
          Sign in
        </button>
      </p>
    </form>
  );
}
