#!/usr/bin/env node
/**
 * Promote an existing versionCode to another Play track.
 *
 * Usage:
 *   node scripts/play/promote.mjs --from internal --to alpha --version-code 4
 *   node scripts/play/promote.mjs --from internal --to production --version-code 4 --status draft
 */
import {
  PACKAGE_NAME,
  getPublisher,
  log,
  parseArgs,
  withEdit,
} from "./client.mjs";

async function main() {
  const { flags } = parseArgs();
  const fromTrack = String(flags.from || "internal");
  const toTrack = String(flags.to || "alpha");
  const status = String(flags.status || "completed");
  const versionCode = String(flags["version-code"] || flags.version || "").trim();
  const dryRun = Boolean(flags["dry-run"]);

  if (!versionCode) {
    throw new Error("Pass --version-code <n> (e.g. 4)");
  }

  log("promote", `package=${PACKAGE_NAME} ${fromTrack} → ${toTrack} versionCode=${versionCode} status=${status}`);

  if (dryRun) {
    log("promote", "dry-run ok");
    return;
  }

  const androidpublisher = await getPublisher();

  const result = await withEdit(androidpublisher, PACKAGE_NAME, async (editId) => {
    // Read release notes from source track when possible
    let releaseNotes = [{ language: "en-US", text: "Bug fixes and improvements." }];
    try {
      const src = await androidpublisher.edits.tracks.get({
        packageName: PACKAGE_NAME,
        editId,
        track: fromTrack,
      });
      const release = (src.data.releases || []).find((r) =>
        (r.versionCodes || []).map(String).includes(versionCode)
      );
      if (release?.releaseNotes?.length) releaseNotes = release.releaseNotes;
    } catch {
      /* use defaults */
    }

    await androidpublisher.edits.tracks.update({
      packageName: PACKAGE_NAME,
      editId,
      track: toTrack,
      requestBody: {
        track: toTrack,
        releases: [
          {
            status,
            versionCodes: [versionCode],
            releaseNotes,
          },
        ],
      },
    });

    return { fromTrack, toTrack, versionCode, status };
  });

  console.log(JSON.stringify({ ok: true, packageName: PACKAGE_NAME, ...result }, null, 2));
}

main().catch((error) => {
  console.error(`[play:promote] ${error.message}`);
  if (error.response?.data) console.error(JSON.stringify(error.response.data, null, 2));
  process.exit(1);
});
