import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

type Handler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2>;

const write = (payload: Record<string, unknown>) => {
  console.log(JSON.stringify(payload));
};

/** Log an incoming HTTP API request (structured for CloudWatch Logs Insights). */
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

/** Log the HTTP status returned to API Gateway. */
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

/** Log a handled failure (DynamoDB, S3, etc.). */
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
 */
export const withHandlerLogging =
  (handler: string, fn: Handler): Handler =>
  async (event) => {
    logRequest(handler, event);
    try {
      const response = await fn(event);
      logResponse(handler, response);
      return response;
    } catch (err) {
      logError(handler, "unhandled exception", err);
      throw err;
    }
  };
