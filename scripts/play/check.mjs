#!/usr/bin/env node
/**
 * Preflight checks for Play Store automation.
 *
 * Usage:
 *   node scripts/play/check.mjs
 *   node scripts/play/check.mjs --dry-run
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  PACKAGE_NAME,
  ROOT,
  defaultAabPath,
  loadServiceAccount,
  log,
  parseArgs,
  resolveServiceAccountPath,
} from "./client.mjs";

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg) {
  console.log(`  ! ${msg}`);
}
function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

async function main() {
  const { flags } = parseArgs();
  const dryRun = Boolean(flags["dry-run"]);
  let errors = 0;

  log("check", `package=${PACKAGE_NAME}`);

  try {
    const sa = loadServiceAccount();
    ok(`service account: ${sa.client_email || "(from env JSON)"}`);
    const path = resolveServiceAccountPath();
    if (path) ok(`credential file: ${path}`);
  } catch (error) {
    if (dryRun) {
      warn(error.message);
    } else {
      fail(error.message);
      errors += 1;
    }
  }

  const aab = defaultAabPath();
  if (existsSync(aab)) {
    const mb = (statSync(aab).size / (1024 * 1024)).toFixed(1);
    ok(`AAB present (${mb} MB): ${aab}`);
  } else {
    warn(`AAB not built yet: ${aab} (run npm run play:build)`);
  }

  const listing = resolve(ROOT, "store-assets/listing/en-US.json");
  if (existsSync(listing)) ok(`listing JSON: ${listing}`);
  else {
    fail(`missing ${listing}`);
    errors += 1;
  }

  const feature = resolve(ROOT, "store-assets/feature-graphic.png");
  if (existsSync(feature)) ok("feature graphic present");
  else warn("feature graphic missing (store-assets/feature-graphic.png)");

  const shotsDir = resolve(ROOT, "store-assets/screenshots");
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((n) => /\.(png|jpe?g|webp)$/i.test(n))
    : [];
  if (shots.length >= 2) ok(`${shots.length} phone screenshots ready`);
  else warn(`${shots.length} screenshots found — Play requires ≥2 before production`);

  const privacy = "https://trainer-app-mvp-recovered.vercel.app/privacy";
  ok(`privacy policy URL (manual Console field): ${privacy}`);

  if (!dryRun && errors === 0) {
    try {
      const { getPublisher } = await import("./client.mjs");
      const androidpublisher = await getPublisher();
      const insert = await androidpublisher.edits.insert({ packageName: PACKAGE_NAME });
      const editId = insert.data.id;
      await androidpublisher.edits.delete({ packageName: PACKAGE_NAME, editId });
      ok("Play Developer API auth works");
    } catch (error) {
      fail(`API auth failed: ${error.message}`);
      if (error.response?.data) console.error(JSON.stringify(error.response.data, null, 2));
      errors += 1;
      warn("Invite the service account in Play Console → Users and permissions, then wait a few minutes.");
    }
  } else if (dryRun) {
    warn("dry-run — skipped live API auth probe");
  }

  console.log("");
  if (errors) {
    console.error(`[play:check] ${errors} blocking issue(s). See docs/play-store/AUTOMATION.md`);
    process.exit(1);
  }
  console.log("[play:check] ready");
}

main().catch((error) => {
  console.error(`[play:check] ${error.message}`);
  process.exit(1);
});
