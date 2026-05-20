import { useState, type FormEvent } from "react";
import { useConfirmSignUp, useResendSignUpCode, useSignUp } from "../hooks/useAuth";

type SignUpFormProps = {
  onSwitchToSignIn: () => void;
};

type Step = "register" | "confirm";

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

export function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
  const [step, setStep] = useState<Step>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [deliveryHint, setDeliveryHint] = useState("your email");

  const signUp = useSignUp();
  const confirmSignUp = useConfirmSignUp();
  const resendCode = useResendSignUpCode();

  function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    signUp.mutate(
      {
        username: email,
        password,
        options: {
          userAttributes: { email },
          autoSignIn: true,
        },
      },
      {
        onSuccess: (output) => {
          if (output.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
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

          if (output.nextStep.signUpStep === "DONE") {
            onSwitchToSignIn();
          }
        },
      },
    );
  }

  function handleConfirmSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    confirmSignUp.mutate(
      { username: email, confirmationCode: code },
      {
        onSuccess: (output) => {
          if (output.nextStep.signUpStep === "DONE") {
            onSwitchToSignIn();
          }
        },
      },
    );
  }

  function handleResendCode() {
    setLocalError(null);
    resendCode.mutate(
      { username: email },
      {
        onSuccess: (output) => {
          setDeliveryHint(
            formatDeliveryDestination(
              output.destination,
              output.deliveryMedium,
            ),
          );
        },
      },
    );
  }

  if (step === "confirm") {
    return (
      <form className="card" onSubmit={handleConfirmSubmit}>
        <h2>Confirm your account</h2>
        <p className="muted">
          Enter the verification code sent to {deliveryHint}.
        </p>

        <label>
          Verification code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>

        {(localError || confirmSignUp.isError) && (
          <p className="error" role="alert">
            {localError ??
              (confirmSignUp.error instanceof Error
                ? confirmSignUp.error.message
                : "Confirmation failed")}
          </p>
        )}

        {resendCode.isSuccess && (
          <p className="success" role="status">
            A new verification code was sent.
          </p>
        )}

        <button type="submit" disabled={confirmSignUp.isPending}>
          {confirmSignUp.isPending ? "Confirming…" : "Confirm account"}
        </button>

        <p className="auth-footer">
          <button
            type="button"
            className="link"
            onClick={handleResendCode}
            disabled={resendCode.isPending}
          >
            {resendCode.isPending ? "Sending…" : "Resend code"}
          </button>
          {" · "}
          <button type="button" className="link" onClick={() => setStep("register")}>
            Back
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={handleRegisterSubmit}>
      <h2>Create account</h2>
      <p className="muted">Sign up with your email to start uploading photos.</p>

      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label>
        Password
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>

      <label>
        Confirm password
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>

      {(localError || signUp.isError) && (
        <p className="error" role="alert">
          {localError ??
            (signUp.error instanceof Error ? signUp.error.message : "Sign up failed")}
        </p>
      )}

      <button type="submit" disabled={signUp.isPending}>
        {signUp.isPending ? "Creating account…" : "Sign up"}
      </button>

      <p className="auth-footer muted">
        Already have an account?{" "}
        <button type="button" className="link" onClick={onSwitchToSignIn}>
          Sign in
        </button>
      </p>
    </form>
  );
}
