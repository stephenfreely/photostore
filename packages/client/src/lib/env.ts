function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  apiUrl: requireEnv("VITE_API_URL").replace(/\/$/, ""),
  userPoolId: requireEnv("VITE_USER_POOL_ID"),
  userPoolClientId: requireEnv("VITE_USER_POOL_CLIENT_ID"),
  identityPoolId: requireEnv("VITE_IDENTITY_POOL_ID"),
  region: requireEnv("VITE_AWS_REGION"),
} as const;

/** Max guest uploads before sign-in (must match backend `GUEST_PHOTO_LIMIT`). */
export const guestPhotoLimit = 2;
