import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useConfirmSignUp, useResendSignUpCode, useSignUp } from "../hooks/useAuth";

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

const inputClassName =
  "w-full rounded-lg border border-border-input bg-surface px-3 py-2.5 font-[inherit] text-inherit";
const labelClassName = "flex flex-col gap-1.5 text-sm text-label";
const formClassName =
  "flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5";
const buttonClassName =
  "cursor-pointer rounded-lg bg-accent px-4 py-2.5 font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-60";
const linkButtonClassName =
  "cursor-pointer border-none bg-transparent p-0 font-[inherit] font-medium text-accent underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export function SignUpForm() {
  const navigate = useNavigate();
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

  function goToSignIn() {
    void navigate({ to: "/login" });
  }

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
            goToSignIn();
          }
        },
      },
    );
  }

  function handleConfirmSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    confirmSignUp.mutate({ username: email, confirmationCode: code });
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
      <form className={formClassName} onSubmit={handleConfirmSubmit}>
        <h2 className="mb-1.5 text-lg leading-tight">Confirm your account</h2>
        <p className="m-0 text-muted">
          Enter the verification code sent to {deliveryHint}.
        </p>

        <label className={labelClassName}>
          Verification code
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

        {(localError || confirmSignUp.isError) && (
          <p className="m-0 text-sm text-error" role="alert">
            {localError ??
              (confirmSignUp.error instanceof Error
                ? confirmSignUp.error.message
                : "Confirmation failed")}
          </p>
        )}

        {resendCode.isSuccess && (
          <p className="m-0 text-sm text-success" role="status">
            A new verification code was sent.
          </p>
        )}

        <button type="submit" className={buttonClassName} disabled={confirmSignUp.isPending}>
          {confirmSignUp.isPending ? "Confirming…" : "Confirm account"}
        </button>

        <p className="m-0 text-center text-sm">
          <button
            type="button"
            className={linkButtonClassName}
            onClick={handleResendCode}
            disabled={resendCode.isPending}
          >
            {resendCode.isPending ? "Sending…" : "Resend code"}
          </button>
          {" · "}
          <button
            type="button"
            className={linkButtonClassName}
            onClick={() => setStep("register")}
          >
            Back
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className={formClassName} onSubmit={handleRegisterSubmit}>
      <h2 className="mb-1.5 text-lg leading-tight">Create account</h2>
      <p className="m-0 text-muted">Sign up with your email to start uploading photos.</p>

      <label className={labelClassName}>
        Email
        <input
          className={inputClassName}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className={labelClassName}>
        Password
        <input
          className={inputClassName}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>

      <label className={labelClassName}>
        Confirm password
        <input
          className={inputClassName}
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>

      {(localError || signUp.isError) && (
        <p className="m-0 text-sm text-error" role="alert">
          {localError ??
            (signUp.error instanceof Error ? signUp.error.message : "Sign up failed")}
        </p>
      )}

      <button type="submit" className={buttonClassName} disabled={signUp.isPending}>
        {signUp.isPending ? "Creating account…" : "Sign up"}
      </button>

      <p className="m-0 text-center text-sm text-muted">
        Already have an account?{" "}
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
