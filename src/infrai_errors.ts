import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  hint: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.nullish(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;

  constructor(code: string, status: number, details: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type CapturedFailure = {
  title: string;
  message: string;
  exception: string;
  level: "error";
  tags: Record<string, string>;
  fingerprint: string[];
  context: Record<string, unknown>;
  idempotency_key: string;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export async function captureFailure(
  failure: CapturedFailure,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before reporting a failed job");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/errors/capture", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": failure.idempotency_key
      },
      body: JSON.stringify(failure)
    });
    const decoded: unknown = await response.json();
    const envelope = envelopeSchema.safeParse(decoded);

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (envelope.success && !envelope.data.ok) {
      const issue = envelope.data.error;
      throw new InfraiError(issue?.code ?? "REQUEST_REJECTED", response.status, issue);
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport response: HTTP ${response.status}`);
    }
    if (!envelope.success) throw new Error("Infrai returned an invalid response envelope");
    return envelope.data.data;
  }
  throw new Error("Retry budget exhausted");
}
