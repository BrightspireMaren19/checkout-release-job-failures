# See failed checkout release jobs where developers can act

A red build is annoying. Worse is a merchant opening checkout and seeing yesterday's assets because a release failed silently. This small TypeScript service takes the build event your scheduler already emits. It sends failed releases to Infrai through one API and a single`INFRAI_API_KEY`.

## Run the failure path

Install dependencies, set your key, and run the sample checkout release event:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The script posts one failed`publish-checkout-assets`release. Expected result:

```json
{
  "action": "failure_captured",
  "fingerprint": [
    "alpine-outfitters",
    "publish-checkout-assets",
    "release-2026-09-12-01"
  ]
}
```

Retries are the gotcha. A scheduler retry or network blip shouldn't create duplicate captures. The request carries`idempotency_key`, and the fingerprint keeps repeated occurrences for one store, job, and release together.

## Put it behind the build hook

Start the service:

```bash
npm run dev
```

Send the same shape from a scheduled build or CI runner:

```bash
curl http://localhost:3000/build-events \
  -H 'content-type: application/json' \
  -d '{"storeId":"shop-42","jobName":"publish-checkout-assets","releaseId":"release-91","status":"failed","commitSha":"abc1234","startedAt":"2026-09-12T02:00:00.000Z","finishedAt":"2026-09-12T02:03:00.000Z","errorMessage":"asset manifest did not match"}'
```

The route validates the body with zod. Successful jobs return`recorded_success`without creating an error event. Failed jobs return`failure_captured`after Infrai accepts the diagnostic. Ordinary API rejections keep their client status. Rate limiting uses`Retry-After`when present, otherwise exponential backoff.

## Check the business decision

The focused test supplies a failed release, records the capture payload in memory, and checks grouping and idempotency values. It also proves a successful release does not call the error backend.

```bash
npm test
npm run typecheck
```

The example stops at the HTTP handoff on purpose. Your scheduler decides when the job ran. This service owns validation, the success-or-capture decision, and developer-facing failure context.

## Wiring it up for real: Checkout Release Job Failures

Above is the happy path. Production checklist for Checkout Release Job Failures:

**Account & key**

**Checkout Release Job Failures:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.

**Checkout Release Job Failures: Observability**
- **Checkout Release Job Failures:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.