import { apiFetch } from "../lib/api";
import type { HelloResponse } from "../types/photo";

export const healthKeys = {
  hello: ["health", "hello"] as const,
};

export async function fetchHello(): Promise<HelloResponse> {
  return apiFetch<HelloResponse>("/hello", { auth: false });
}
