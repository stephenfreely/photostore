/**
 * Health / learning handler — echoes what API Gateway sends to Lambda.
 *
 * Wired in `serverless.yml` as `GET /hello` (public, no auth).
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

/**
 * Sample HTTP API handler (payload format 2.0).
 *
 * Returns `200` and a JSON body with a few fields from the incoming `event`
 * so you can see path, method, query string, and client IP without extra tooling.
 *
 * @param event - HTTP API proxy event from API Gateway
 * @returns JSON response with `message: "ok"` and selected `event` fields
 */
export const hello = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => ({
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message: "ok",
    routeKey: event.routeKey,
    rawPath: event.rawPath,
    rawQueryString: event.rawQueryString ?? "",
    queryStringParameters: event.queryStringParameters ?? null,
    method: event.requestContext?.http?.method,
    sourceIp: event.requestContext?.http?.sourceIp,
  }),
});
