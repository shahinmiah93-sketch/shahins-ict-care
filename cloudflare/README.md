# Cloudflare deployment — Shahin's ICT Care

This is a separate Cloudflare build. The existing `server.mjs`, `public/` and local `data/` continue to work as before.

## Architecture

- Workers static assets serve **only** `public/`.
- One SQLite-backed Durable Object runs the existing API and serializes requests to prevent concurrent writes overwriting student, fee, attendance or stock data.
- Its SQLite tables persist database/config JSON and binary files in 128 KiB chunks. No R2 subscription is needed. Files remain behind the original permission checks.
- The school calendar stays in `Asia/Dhaka`; Durable Object alarms replace local background timers.
- Login sessions, PIN tickets, OTP state and rate limits survive restarts. Existing scrypt password hashes and student PINs are preserved. Local browser sessions are intentionally not copied.
- The generated backend comes from the current `../server.mjs`; fee, exam, quiz and stock rules are not separately reimplemented.

## Free-plan boundaries

This does **not** promise unlimited hosting or guaranteed permanent service. Cloudflare's account-wide Workers and Durable Object free quotas still apply. Keep the account on the Free plan. This configuration does not request paid resources.

This version enforces **20 MB per upload** and approximately **700 MB total logical file storage** to stay below the Free plan's per-object storage and memory limits, leaving room for indexes and backups. Use YouTube for large class videos. Disk use can exceed logical file size, so monitor Cloudflare's storage and request dashboards. The original local installation retains its previous upload limits.

SQLite-backed Durable Objects are available on Workers Free. References:

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/workers/platform/limits/

## Publish using the owner's account

1. Stop adding or editing local school data during the initial import. Do not run both installations as independent systems after switching; their databases do not sync.
2. Run **`../Publish Cloudflare.bat`**. This validates all data and upload sizes, builds the Worker, opens official Wrangler OAuth login, deploys to `workers.dev`, imports private data and removes the temporary migration secret.
3. Sign in to your own Cloudflare account and review Wrangler's requested access. No password or token needs to be pasted into a chat. Multiple accounts may require selecting the account in Wrangler.
4. Open the printed HTTPS address. Check admin/student login, current balances, ebooks, photos, a test admission and a test sale. Verify SMS separately with your SMS provider: Cloudflare does not give a fixed outbound IP, so a provider IP allowlist may need adjustment. SMS and payment-provider charges are separate from hosting.
5. The verified configuration now routes `shahinictcare.com/*` and `www.shahinictcare.com/*` to the Worker. Existing Tunnel-managed DNS records are preserved; a full-path Worker route intercepts requests before the old origin. `preview.shahinictcare.com` is also attached as a Custom Domain. Keep all three entries in `wrangler.jsonc` on later deployments and preserve mail DNS records.
6. Test from mobile data. Keep the old local `data/` as a rollback copy. Do not delete it.

The script imports all current data files except backups, temporary files and old browser sessions. Every imported file is checked by size and SHA-256. All files are staged; one SQLite transaction publishes the complete import. It refuses to overwrite an already imported school database. A later deployment updates code only.

The migration endpoint returns 404 without its temporary secret. The live application returns 503 until a verified import has completed. Existing admin credentials are mandatory; a public visitor cannot claim a fresh admin account.

## Local verification

```powershell
cd cloudflare
npm ci
npm run build
npm test
npx wrangler deploy --dry-run
```

For integration tests, start a disposable local emulator in one terminal:

```powershell
npx wrangler dev --ip 127.0.0.1 --port 8790 --var MIGRATION_TOKEN:local-test-only --show-interactive-dev-session=false
```

Then in a second terminal:

```powershell
$env:CF_TEST_URL = 'http://127.0.0.1:8790'
npm test
```

The integration test imports synthetic data and synthetic admin credentials, never real school data. It is restricted to loopback addresses. It checks real Cloudflare runtime execution, static routes, private-file protection, existing auth, writes/backups, multi-chunk uploads, student panels and quiz expiration/limits. Restart the emulator with the same persistence directory and rerun to check durable records.

## Operations and limits

- Back up the cloud database from the authenticated admin panel regularly. The original JSON backup does **not** contain uploaded binary files; keep the original upload folder and retain separate Cloudflare storage exports for new files. Cloudflare's SQLite Time Travel is an additional recovery option, not a substitute for off-platform copies.
- A single school object serializes API requests; a large report/export or slow SMS request can delay another API call. Static pages do not wait on it. This favors correctness for a small coaching center rather than high-volume traffic.
- Worker deployments and object restarts keep data. Quota exhaustion returns errors rather than magically providing unlimited service.
- Background schedules run approximately once a minute after import. External SMS/payment calls are not transactional with the database; like the original server, a network failure can require reconciliation.
- Preserve the Durable Object binding name, class name, migration history and `school-v1` object name when updating. Changing these can select a new empty database.
- No repository upload of `data/`, auth JSON, migration secrets or Wrangler state is needed. `dist/`, `node_modules/` and local Wrangler state are ignored.

## Deployment status

Published and verified on **2026-11-04 (Asia/Dhaka)** after the owner completed official Wrangler OAuth:

- https://shahinictcare.com
- https://www.shahinictcare.com
- https://preview.shahinictcare.com

37 source data/upload files were verified by SHA-256 and imported, including the database containing 5 students and existing admin credentials. The temporary migration secret has been deleted. Existing browser sessions were not migrated; sign in using the existing credentials.

Both primary domains return a healthy migrated Cloudflare SQLite backend, public pages/API return 200, private database URLs and disabled migration endpoints return 404. An imported teacher image was also compared byte-for-byte by SHA-256. The account's new `workers.dev` hostname initially had HTTPS propagation issues; the owned domain was used for the actual import and verification.

Use the **online** admin panel for new records from now on. The old local database is preserved for rollback and does not synchronize with the cloud copy. Server-side behavior was integration-tested in the local Cloudflare runtime with synthetic admin/student credentials. The owner's real admin password/PIN were not requested or used for testing.
