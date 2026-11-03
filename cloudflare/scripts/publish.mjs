// Run explicitly by the owner. OAuth credentials stay in Wrangler's own login store.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { collectImport, migrate } from "./migrate.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const run = (args, { input, capture = false } = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: [input === undefined ? "inherit" : "pipe", capture ? "pipe" : "inherit", "inherit"] });
  let text = "";
  if (capture) child.stdout.on("data", part => { text += part; process.stdout.write(part); });
  if (input !== undefined) child.stdin.end(input);
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve(text) : reject(new Error("Command failed (" + code + "): " + args[0])));
});

console.log("This publishes a Cloudflare Worker and imports the local school data privately.");
console.log("Uses the domain routes declared in wrangler.jsonc. No paid service is activated by this script.");
console.log("Stop entering new data on the local website until the import completes.");
// Validate all files before starting a deployment or opening an account login.
const files = await collectImport(fileURLToPath(new URL("../../data", import.meta.url)));
console.log(`Validated ${files.length} files (${(files.reduce((n,f) => n + f.size, 0)/1024/1024).toFixed(1)} MB).`);
await run([path.join(root, "scripts/build.mjs")]);
await run([wrangler, "login"]);
const output = await run([wrangler, "deploy"], { capture: true });
const config = JSON.parse(await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8"));
const custom = config.routes?.find(route => route.custom_domain && /^[a-z0-9.-]+$/i.test(route.pattern));
const url = custom ? "https://" + custom.pattern : output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev\b/i)?.[0];
if (!url) throw new Error("Could not determine the deployed workers.dev URL. Do not import to an unverified destination.");
const health = await fetch(url + "/api/health").then(r => r.json());
if (health.app !== "shahins-ict-care" || health.storage !== "cloudflare-sqlite") throw new Error("Unexpected destination; import cancelled");
if (!health.migrated) {
  const token = crypto.randomBytes(32).toString("hex");
  await run([wrangler, "secret", "put", "MIGRATION_TOKEN"], { input: token + "\n" });
  try {
    await migrate(url, token, files);
  } finally {
    // A completed import rejects overwrites even before this credential is removed.
    await run([wrangler, "secret", "delete", "MIGRATION_TOKEN"], { input: "y\n" });
  }
} else console.log("Existing cloud data preserved; this was a code-only update.");
const check = await fetch(url + "/api/public");
if (!check.ok) throw new Error("Deployment exists but final public API check failed");
console.log("\nPublished and verified: " + url);
console.log("The configured domain routes are deployed with the Worker; verify them before using the admin panel.");
