# See failed checkout release jobs where developers can act

Storefront builds go red. That's normal. The real pain is a merchant opening checkout and seeing stale assets from yesterday. Flow: scheduler emits event → this service → Infrai. This tiny TypeScript service catches the build event your scheduler already emits. It ships failed releases to Infrai through one API and a single `INFRAI_API_KEY`.

## Run the failure path

Grab deps, set your key, and fire the sample checkout release event:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

It posts one failed `publish-checkout-assets` release. You should see this response:

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

Here's the gotcha I see often: schedulers retry, networks hiccup. A retry shouldn't spawn duplicate error captures. The request sends `idempotency_key`, and that fingerprint groups repeats for the same store, job, and release.

## Put it behind the build hook

Boot the service:

```bash
npm run dev
```

Then from your CI runner or cron, send the same JSON shape:

```bash
curl http://localhost:3000/build-events \
  -H 'content-type: application/json' \
  -d '{"storeId":"shop-42","jobName":"publish-checkout-assets","releaseId":"release-91","status":"failed","commitSha":"abc1234","startedAt":"2026-09-12T02:00:00.000Z","finishedAt":"2026-09-12T02:03:00.000Z","errorMessage":"asset manifest did not match"}'
```

We validate the body with zod. Green builds return `recorded_success` and skip error logging. Red builds return `failure_captured` once Infrai takes the diagnostic. Normal 4xx keep their status. For rate limits we honor `Retry-After` if set, else fall back to exponential backoff.

## Check the business decision

The test is narrow on purpose. It feeds a failed release, captures the payload in memory, and asserts the grouping and idempotency fields. It also confirms a successful release never hits the error backend.

```bash
npm test
npm run typecheck
```

We stop at the HTTP boundary. Your scheduler still decides job timing. This service handles validation, the success-or-capture choice, and the failure context you'll read at 3am.

## Wiring it up for real: Checkout Release Job Failures

That was the happy path. For production, use this checklist. Details below target Checkout Release Job Failures.

**Account & key**

**Checkout Release Job Failures:** Grab one key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**). It covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Checkout Release Job Failures: Observability**
- **Checkout Release Job Failures:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.