import { processBuildEvent } from "../src/release_failure";

const result = await processBuildEvent({
  storeId: "alpine-outfitters",
  jobName: "publish-checkout-assets",
  releaseId: "release-2026-09-12-01",
  status: "failed",
  commitSha: "8a04f31",
  startedAt: "2026-09-12T02:00:00.000Z",
  finishedAt: "2026-09-12T02:01:12.000Z",
  errorMessage: "checkout bundle verification failed"
});

console.log(JSON.stringify(result, null, 2));
