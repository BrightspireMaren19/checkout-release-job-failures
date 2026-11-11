import { z } from "zod";
import { captureFailure, type CapturedFailure } from "./infrai_errors";

export const buildEventSchema = z.object({
  storeId: z.string().min(1),
  jobName: z.string().min(1),
  releaseId: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  commitSha: z.string().min(7),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  errorMessage: z.string().min(1).optional()
}).superRefine((event, context) => {
  if (event.status === "failed" && !event.errorMessage) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["errorMessage"],
      message: "errorMessage is required for a failed build"
    });
  }
});

export type BuildEvent = z.infer<typeof buildEventSchema>;
export type ReleaseDecision =
  | { action: "recorded_success" }
  | { action: "failure_captured"; fingerprint: string[] };

export function failurePayload(event: BuildEvent): CapturedFailure | null {
  if (event.status === "succeeded") return null;
  const fingerprint = [event.storeId, event.jobName, event.releaseId];
  return {
    title: `Storefront release job failed: ${event.jobName}`,
    message: event.errorMessage as string,
    exception: `ReleaseJobError: ${event.errorMessage as string}`,
    level: "error",
    tags: { store_id: event.storeId, job_name: event.jobName },
    fingerprint,
    context: {
      release_id: event.releaseId,
      commit_sha: event.commitSha,
      started_at: event.startedAt,
      finished_at: event.finishedAt
    },
    idempotency_key: `release:${event.storeId}:${event.jobName}:${event.releaseId}`
  };
}

export async function processBuildEvent(
  input: unknown,
  capture: (payload: CapturedFailure) => Promise<unknown> = captureFailure
): Promise<ReleaseDecision> {
  const event = buildEventSchema.parse(input);
  const payload = failurePayload(event);
  if (!payload) return { action: "recorded_success" };
  await capture(payload);
  return { action: "failure_captured", fingerprint: payload.fingerprint };
}
