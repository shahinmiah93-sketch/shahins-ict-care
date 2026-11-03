# Automatic online code updates

This computer's source folder → GitHub `shahinmiah93-sketch/shahins-ict-care`, branch `main` → the existing Cloudflare build/deployment → https://shahinictcare.com.

## One-time setup

Run **Setup Auto Online Update.bat** from this folder. Git Credential Manager will show an official GitHub device-login address and one-time code. Complete that sign-in yourself. Do not paste passwords, tokens or the device code into chat. Browser login in Chrome/the app does not automatically sign Git on this computer in.

After authentication, setup validates and publishes the initial source, starts the hidden background watcher, and creates a managed Windows Startup launcher. No cloud/private database is uploaded or migrated. Setup is not complete until the initial push succeeds.

## Daily use

Save your changes in this project folder. After approximately **15 seconds without further edits**, the watcher takes a source snapshot, validates JavaScript syntax, builds the Cloudflare package, runs its tests, and pushes a normal commit to GitHub. Installation/build/deployment adds more time; a save is not an instant completed deployment. Cloudflare then runs the existing Git integration.

- **Auto Online Update Status.bat** shows the watcher state, last commit, errors and Cloudflare's check for that commit.
- **Stop Auto Online Update.bat** stops further publishes and disables its Windows Startup launcher.
- **Start Auto Online Update.bat** starts it again and restores Windows auto-start.
- Background logs: `.online-sync/watch.log`.

The watcher starts when this Windows user signs in, while the computer is on. The hosted website itself continues running when the computer is off.

## What is synchronized

Application source (`server.mjs`, `seed.mjs`, `public/`), Cloudflare source/configuration/lockfile, source tests, project launchers and documentation. New/changed/deleted allowed source files are included. The root project is not converted into a Git checkout: the tool uses its own temporary clone inside `.online-sync/` and never resets, checks out over, or deletes your working source folder.

It excludes `data/`, `private-backups/`, installed dependencies, local Wrangler state, generated builds, `.env`, credential/config secret files, private keys and archives. It also scans content for common private credential formats. This scan is a guard, not a guarantee: only put content intended to be public in `public/`.

**Local student, payment, result and attendance data do not synchronize to the cloud.** Continue managing those through the **online admin panel**. File-based cloud uploads remain in the Cloudflare database and are independent of a code deployment. Local source assets belong in `public/`; admin uploads belong in the online admin panel.

## Failures and conflicts

Syntax errors, failing build/tests, an upload larger than 20 MB, a possible private credential, missing login or concurrent edits to the same source path stop publication. GitHub/main is never force-pushed. Existing remote changes are not silently overwritten, and a non-fast-forward push is rejected. Resolve the indicated file difference before retrying. An unchanged failed snapshot is retried at most once every two minutes for transient connection issues.

If a source file is changed independently on GitHub after setup, update the local version to match that remote version before editing it further. A conflict will otherwise require a deliberate review. Local edits saved while a validated snapshot is publishing are picked up by the next cycle.

Generated checkouts are removed only after their absolute paths are verified to be inside this tool's `.online-sync/jobs/` directory. Original data and source files are not removed by this cleanup.

## Verification

`node --test tests/online-sync.test.mjs` checks source filtering, local Git push/delete propagation, syntax rejection, protection against concurrent remote edits, private-key rejection and dry-run behavior using disposable local Git repositories. It never pushes to the real GitHub repository.

`node scripts/online-sync.mjs check` validates the actual project snapshot without committing/pushing. `prepare` only prepares the public repository clone. Full activation requires the owner's Git Credential Manager sign-in through the setup launcher.
