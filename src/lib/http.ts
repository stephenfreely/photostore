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
  if (!body) {
    return {
      ok: false,
      response: json(400, { error: "Request body is required" }),
    };
  }
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return {
      ok: false,
      response: json(400, { error: "Invalid JSON body" }),
    };
  }
};
