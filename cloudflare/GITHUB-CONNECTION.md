# GitHub → existing Cloudflare Worker

Repository: https://github.com/shahinmiah93-sketch/shahins-ict-care

Existing live Worker: `shahins-ict-care`. Connect this existing Worker; do not create a second website or database.

The repository initially contains `public/`, `server.mjs`, `seed.mjs` and a local launcher. It also needs the `cloudflare/` source folder. Upload the extracted contents of `deploy/GitHub-Cloudflare-Update.zip` to the repository root; do not upload the zip as a single file. The archive excludes all live `data/`, credentials, installed dependencies, local Wrangler state and generated assets.

In the Cloudflare dashboard, open **Workers & Pages → shahins-ict-care → Settings → Builds → Connect**. Choose GitHub and authorize the Cloudflare GitHub App for **only** `shahinmiah93-sketch/shahins-ict-care` when the owner approves the app installation.

Use these build settings:

| Setting | Value |
| --- | --- |
| Repository | `shahinmiah93-sketch/shahins-ict-care` |
| Production branch | `main` |
| Root directory | `cloudflare` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production previews | Disabled |

Cloudflare installs the dependencies declared in `cloudflare/package.json` using its lockfile. If the dashboard requires an explicit install command, use `npm ci` from the same root directory. This build reads the existing `../server.mjs`, `../seed.mjs` and `../public/`.

Do **not** use `npm run deploy` in the build dashboard: it includes another build. Do **not** run the migration or publish/login scripts in CI. The live database has already been imported; Git deployments only update application code and static assets. Keep `SCHOOL`, the `School` class, migration `v1`, the `school-v1` object name and existing domain routes unchanged.

A successful connection must show this repository in Builds, finish its first deployment successfully, and leave https://shahinictcare.com/api/health returning `storage: cloudflare-sqlite` and `migrated: true`.

The agent has verified the public repository and prepared the missing source files. Browser access to both Cloudflare and GitHub was denied, and the existing Wrangler OAuth token lacks Workers Builds Configuration permission. The Git integration is therefore **not connected yet**. The owner must authorize browser access or complete the dashboard connection above.
