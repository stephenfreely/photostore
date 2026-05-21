import { Amplify } from "aws-amplify";
import { env } from "./lib/env";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: env.userPoolId,
      userPoolClientId: env.userPoolClientId,
      identityPoolId: env.identityPoolId,
      allowGuestAccess: true,
    },
  },
});
