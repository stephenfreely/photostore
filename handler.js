/** HTTP API (payload v2) — return a few event fields so you can see what API Gateway sends. */
exports.hello = async (event) => ({
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
