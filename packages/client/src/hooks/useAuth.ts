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
import { authKeys, authSessionQueryOptions } from "../lib/authSession";
import { mergeGuestOnLogin } from "../lib/mergeGuestOnLogin";

export { authKeys };

export function useAuthSession() {
  return useQuery(authSessionQueryOptions);
}

export function useSignIn() {
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
      void queryClient.invalidateQueries({ queryKey: authKeys.session });
      if (output.isSignedIn) {
        void queryClient.invalidateQueries({ queryKey: photoKeys.all });
      }
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.session, {
        isAuthenticated: false,
        user: null,
      });
      void queryClient.removeQueries({ queryKey: photoKeys.all });
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (input: SignUpInput) => signUp(input),
  });
}

export function useConfirmSignUp() {
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
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: authKeys.session });
      void queryClient.invalidateQueries({ queryKey: photoKeys.all });
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
