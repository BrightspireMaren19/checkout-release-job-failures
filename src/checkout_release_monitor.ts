import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_errors";
import { processBuildEvent } from "./release_failure";

const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/build-events") {
    send(response, 404, { error: "route_not_found" });
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await processBuildEvent(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    send(response, 202, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "invalid_build_event" });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      send(response, error.status, { error: error.code });
      return;
    }
    send(response, 502, { error: "diagnostic_delivery_failed" });
  }
}).listen(port, () => {
  console.log(`Checkout release monitor listening on http://localhost:${port}`);
});
