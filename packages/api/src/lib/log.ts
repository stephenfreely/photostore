/**
 * Structured logging for Lambda handlers (CloudWatch Logs Insights).
 *
 * Handlers are wrapped with {@link withHandlerLogging} so every request/response
 * is logged as one JSON line per event.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

type Handler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2>;

/** Emit one JSON log line to stdout (picked up by CloudWatch). */
const write = (payload: Record<string, unknown>) => {
  console.log(JSON.stringify(payload));
};

/**
 * Log an incoming HTTP API request.
 *
 * @param handler - Logical name (e.g. `uploadUrl`, `guestList`) for filtering in Insights
 * @param event - HTTP API v2 event from API Gateway
 */
export const logRequest = (
  handler: string,
  event: APIGatewayProxyEventV2,
): void => {
  write({
    level: "info",
    type: "request",
    handler,
    requestId: event.requestContext?.requestId,
    routeKey: event.routeKey,
    method: event.requestContext?.http?.method,
    path: event.rawPath,
    sourceIp: event.requestContext?.http?.sourceIp,
  });
};

/**
 * Log the HTTP status returned to API Gateway.
 *
 * @param handler - Same name passed to {@link logRequest}
 * @param response - Lambda proxy result (`statusCode` is logged)
 */
export const logResponse = (
  handler: string,
  response: APIGatewayProxyStructuredResultV2,
): void => {
  write({
    level: "info",
    type: "response",
    handler,
    statusCode: response.statusCode,
  });
};

/**
 * Log a handled failure (DynamoDB, S3, presigning, etc.).
 *
 * Writes to stderr with `level: "error"` and error name/message/stack when available.
 *
 * @param handler - Logical handler name
 * @param message - Short context (e.g. `"PutItem failed"`)
 * @param err - Caught value from `catch`
 */
export const logError = (
  handler: string,
  message: string,
  err: unknown,
): void => {
  console.error(
    JSON.stringify({
      level: "error",
      handler,
      message,
      error:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : String(err),
    }),
  );
};

/**
 * Wrap a Lambda handler with request/response logging.
 *
 * Unhandled exceptions are logged and rethrown so Lambda still reports them.
 *
 * @param handler - Name used in all log lines for this function
 * @param fn - Inner handler (same signature as a bare export)
 * @returns Wrapped handler suitable for `serverless.yml` `handler` export
 */
export const withHandlerLogging =
  (handler: string, fn: Handler): Handler =>
  async (event) => {
    // 1. Log incoming request metadata (one JSON line to CloudWatch).
    logRequest(handler, event);
    try {
      // 2. Run the handler and log the HTTP status on success.
      const response = await fn(event);
      logResponse(handler, response);
      return response;
    } catch (err) {
      // 3. Log and rethrow so Lambda still marks the invocation failed.
      logError(handler, "unhandled exception", err);
      throw err;
    }
  };
