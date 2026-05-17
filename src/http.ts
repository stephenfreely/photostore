import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const JSON_HEADERS = { "content-type": "application/json" } as const;

export const json = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});
