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
