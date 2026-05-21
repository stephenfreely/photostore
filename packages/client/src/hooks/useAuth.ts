import { useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  autoSignIn,
  confirmResetPassword,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  type ConfirmResetPasswordInput,
  type ConfirmSignUpInput,
  type ResendSignUpCodeInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "aws-amplify/auth";
import { photoKeys } from "../api/photos";
import {
  authKeys,
  authSessionQueryOptions,
  refreshAuthSession,
} from "../lib/authSession";
import { mergeGuestOnLogin } from "../lib/mergeGuestOnLogin";

export { authKeys };

export function useAuthSession() {
  return useQuery(authSessionQueryOptions);
}

export function useSignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SignInInput) => {
      const output = await signIn(input);
      if (output.isSignedIn) {
        await mergeGuestOnLogin();
      }
      return output;
    },
    onSuccess: async (output) => {
      if (!output.isSignedIn) {
        return;
      }
      await refreshAuthSession(queryClient);
      void queryClient.invalidateQueries({ queryKey: photoKeys.all });
      await router.navigate({ to: "/", replace: true });
    },
  });
}

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: async () => {
      queryClient.setQueryData(authKeys.session, {
        isAuthenticated: false,
        user: null,
      });
      void queryClient.removeQueries({ queryKey: photoKeys.all });
      await router.navigate({ to: "/login", replace: true });
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (input: SignUpInput) => signUp(input),
  });
}

export function useConfirmSignUp() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConfirmSignUpInput) => {
      const output = await confirmSignUp(input);
      if (output.nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
        const signInOutput = await autoSignIn();
        if (signInOutput.isSignedIn) {
          await mergeGuestOnLogin();
        }
      }
      return output;
    },
    onSuccess: async (output) => {
      if (output.nextStep.signUpStep !== "DONE") {
        return;
      }
      const session = await refreshAuthSession(queryClient);
      void queryClient.invalidateQueries({ queryKey: photoKeys.all });
      if (session.isAuthenticated) {
        await router.navigate({ to: "/", replace: true });
      } else {
        await router.navigate({ to: "/login", replace: true });
      }
    },
  });
}

export function useResendSignUpCode() {
  return useMutation({
    mutationFn: (input: ResendSignUpCodeInput) => resendSignUpCode(input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPassword(input),
  });
}

export function useConfirmResetPassword() {
  return useMutation({
    mutationFn: (input: ConfirmResetPasswordInput) => confirmResetPassword(input),
  });
}
