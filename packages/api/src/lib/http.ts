/**
 * Small HTTP helpers shared by Lambda handlers.
 *
 * - {@link json} — build API Gateway proxy responses with JSON bodies
 * - {@link parseJsonBody} — parse `event.body` with consistent 400 errors
 */

import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

/** Headers applied to every JSON API response from our Lambdas. */
const JSON_HEADERS = { "content-type": "application/json" } as const;

/**
 * Build a Lambda proxy response with a JSON body.
 *
 * HTTP API integrations expect this shape (`statusCode`, `headers`, `body`).
 * The `body` must be a string, so objects are serialized with `JSON.stringify`.
 *
 * @param statusCode - HTTP status (e.g. 200, 400, 201)
 * @param body - Value to serialize as JSON in the response body
 * @returns API Gateway–compatible response object
 */
export const json = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

/**
 * Parse `event.body` as JSON for POST handlers.
 *
 * @param body - Raw body from API Gateway (may be undefined)
 * @returns Parsed value, or a ready-to-return `400` response object
 */
export const parseJsonBody = (
  body: string | undefined,
):
  | { ok: true; value: unknown }
  | { ok: false; response: APIGatewayProxyStructuredResultV2 } => {
  // 1. POST handlers require a body string from API Gateway.
  if (!body) {
    return {
      ok: false,
      response: json(400, { error: "Request body is required" }),
    };
  }
  try {
    // 2. Parse JSON; return 400 on syntax errors.
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return {
      ok: false,
      response: json(400, { error: "Invalid JSON body" }),
    };
  }
};
