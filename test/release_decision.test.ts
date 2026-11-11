import assert from "node:assert/strict";
import test from "node:test";
import type { CapturedFailure } from "../src/infrai_errors";
import { processBuildEvent } from "../src/release_failure";

test("a failed checkout release is captured with a stable release fingerprint", async () => {
  const captures: CapturedFailure[] = [];
  const result = await processBuildEvent({
    storeId: "shop-42",
    jobName: "publish-checkout-assets",
    releaseId: "release-91",
    status: "failed",
    commitSha: "abc1234",
    startedAt: "2026-09-12T02:00:00.000Z",
    finishedAt: "2026-09-12T02:03:00.000Z",
    errorMessage: "asset manifest did not match"
  }, async (payload) => {
    captures.push(payload);
    return { accepted: true };
  });

  assert.deepEqual(result, {
    action: "failure_captured",
    fingerprint: ["shop-42", "publish-checkout-assets", "release-91"]
  });
  assert.equal(captures[0]?.idempotency_key, "release:shop-42:publish-checkout-assets:release-91");
  assert.equal(captures[0]?.context.commit_sha, "abc1234");
});

test("a successful release does not send an error", async () => {
  let calls = 0;
  const result = await processBuildEvent({
    storeId: "shop-42",
    jobName: "publish-checkout-assets",
    releaseId: "release-92",
    status: "succeeded",
    commitSha: "def5678",
    startedAt: "2026-09-12T03:00:00.000Z",
    finishedAt: "2026-09-12T03:02:00.000Z"
  }, async () => {
    calls += 1;
  });

  assert.deepEqual(result, { action: "recorded_success" });
  assert.equal(calls, 0);
});
