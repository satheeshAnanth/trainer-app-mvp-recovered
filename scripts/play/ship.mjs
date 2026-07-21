#!/usr/bin/env node
/**
 * End-to-end Play ship helper.
 *
 * Default: upload AAB to internal + sync listing.
 *
 * Usage:
 *   npm run play:ship
 *   npm run play:ship -- --build
 *   npm run play:ship -- --track production --skip-listing
 *   npm run play:ship -- --dry-run
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, defaultAabPath, log, parseArgs } from "./client.mjs";

function runNode(script, args) {
  const result = spawnSync(process.execPath, [resolve(ROOT, script), ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runShell(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  const { flags } = parseArgs();
  const track = String(flags.track || process.env.PLAY_TRACK || "internal");
  const status = String(flags.status || process.env.PLAY_RELEASE_STATUS || "completed");
  const dryRun = Boolean(flags["dry-run"]);
  const doBuild = Boolean(flags.build);
  const skipListing = Boolean(flags["skip-listing"]);
  const skipUpload = Boolean(flags["skip-upload"]);
  const aabPath = String(flags.aab || defaultAabPath());

  log("ship", `track=${track} status=${status} build=${doBuild} dryRun=${dryRun}`);

  // Always validate credentials / dry-run paths first
  runNode("scripts/play/check.mjs", dryRun ? ["--dry-run"] : []);

  if (doBuild) {
    log("ship", "building signed release AAB…");
    if (dryRun) {
      log("ship", "dry-run — skip gradle");
    } else {
      runShell("./gradlew bundleRelease", resolve(ROOT, "android"));
    }
  }

  if (!skipUpload) {
    if (!dryRun && !existsSync(aabPath)) {
      console.error(`[play:ship] AAB missing at ${aabPath}. Pass --build or --aab <path>.`);
      process.exit(1);
    }
    const uploadArgs = ["--track", track, "--status", status, "--aab", aabPath];
    if (dryRun) uploadArgs.push("--dry-run");
    if (flags.notes) uploadArgs.push("--notes", String(flags.notes));
    runNode("scripts/play/upload-aab.mjs", uploadArgs);
  }

  if (!skipListing) {
    const listingArgs = [];
    if (dryRun) listingArgs.push("--dry-run");
    if (flags["skip-images"]) listingArgs.push("--skip-images");
    runNode("scripts/play/sync-listing.mjs", listingArgs);
  }

  if (!dryRun && !flags["skip-status"]) {
    runNode("scripts/play/status.mjs", []);
  }

  log("ship", "done");
}

main().catch((error) => {
  console.error(`[play:ship] ${error.message}`);
  process.exit(1);
});
