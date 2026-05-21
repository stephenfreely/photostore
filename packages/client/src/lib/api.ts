import { fetchAuthSession } from "aws-amplify/auth";
import { env } from "./env";
import { GUEST_IDENTITY_HEADER } from "./guestIdentity";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function parseApiErrorBody(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

export async function authHeaders(json = true): Promise<Record<string, string>> {
  const session = await fetchAuthSession({ forceRefresh: true });
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error("Not signed in");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...fetchInit } = init;
  const headers = auth
    ? { ...(await authHeaders()), ...(fetchInit.headers as Record<string, string>) }
    : fetchInit.headers;

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...fetchInit,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      parseApiErrorBody(text, response.statusText),
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function guestHeaders(
  identityId: string,
  json = true,
): Record<string, string> {
  const headers: Record<string, string> = {
    [GUEST_IDENTITY_HEADER]: identityId,
  };
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

/** Guest routes — no User Pool JWT; scoped by Cognito Identity Pool id header. */
export async function guestApiFetch<T>(
  path: string,
  identityId: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      ...guestHeaders(identityId),
      ...(init.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      parseApiErrorBody(text, response.statusText),
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
