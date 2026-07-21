#!/usr/bin/env node
/**
 * Upload a signed AAB to a Play Console track.
 *
 * Usage:
 *   node scripts/play/upload-aab.mjs
 *   node scripts/play/upload-aab.mjs --track internal --status completed
 *   node scripts/play/upload-aab.mjs --aab path/to/app-release.aab --dry-run
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  PACKAGE_NAME,
  ROOT,
  defaultAabPath,
  getPublisher,
  log,
  openFileStream,
  parseArgs,
  withEdit,
} from "./client.mjs";

function loadReleaseNotes(flags) {
  if (flags.notes) return String(flags.notes);
  if (flags["notes-file"]) {
    return readFileSync(resolve(ROOT, flags["notes-file"]), "utf8").trim();
  }
  const fromWhatsNew = resolve(ROOT, "docs/play-store/WHATS_NEW.md");
  if (existsSync(fromWhatsNew)) {
    const md = readFileSync(fromWhatsNew, "utf8");
    const match = md.match(/##\s+1\.2[\s\S]*?```([\s\S]*?)```/);
    if (match) return match[1].trim();
  }
  return "Bug fixes and improvements.";
}

async function main() {
  const { flags } = parseArgs();
  const track = String(flags.track || process.env.PLAY_TRACK || "internal");
  const status = String(flags.status || process.env.PLAY_RELEASE_STATUS || "completed");
  const userFraction = flags["user-fraction"] ? Number(flags["user-fraction"]) : undefined;
  const aabPath = String(flags.aab || process.env.PLAY_AAB_PATH || defaultAabPath());
  const dryRun = Boolean(flags["dry-run"]);
  const notes = loadReleaseNotes(flags);

  log("upload", `package=${PACKAGE_NAME} track=${track} status=${status}`);
  log("upload", `aab=${aabPath}`);
  log("upload", `notes=${notes.split("\n")[0]}…`);

  if (dryRun) {
    openFileStream(aabPath);
    log("upload", "dry-run ok — would upload and assign to track");
    return;
  }

  const androidpublisher = await getPublisher();
  const { abs, stream } = openFileStream(aabPath);

  const result = await withEdit(androidpublisher, PACKAGE_NAME, async (editId) => {
    log("upload", `edit=${editId} uploading bundle…`);
    const bundle = await androidpublisher.edits.bundles.upload({
      packageName: PACKAGE_NAME,
      editId,
      media: {
        mimeType: "application/octet-stream",
        body: stream,
      },
    });

    const versionCode = bundle.data.versionCode;
    if (!versionCode) throw new Error(`Upload succeeded but no versionCode returned for ${abs}`);
    log("upload", `uploaded versionCode=${versionCode}`);

    const trackBody = {
      track,
      releases: [
        {
          name: flags.name ? String(flags.name) : undefined,
          status,
          versionCodes: [String(versionCode)],
          releaseNotes: [{ language: "en-US", text: notes }],
          ...(status === "inProgress" && userFraction ? { userFraction } : {}),
        },
      ],
    };

    await androidpublisher.edits.tracks.update({
      packageName: PACKAGE_NAME,
      editId,
      track,
      requestBody: trackBody,
    });

    return { versionCode, track, status };
  });

  log("upload", `committed → track=${result.track} versionCode=${result.versionCode} status=${result.status}`);
  console.log(JSON.stringify({ ok: true, packageName: PACKAGE_NAME, ...result }, null, 2));
}

main().catch((error) => {
  console.error(`[play:upload] ${error.message}`);
  if (error.response?.data) console.error(JSON.stringify(error.response.data, null, 2));
  process.exit(1);
});
