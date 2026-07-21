#!/usr/bin/env node
/**
 * Read-only Play Console status (does not commit an edit).
 *
 * Usage:
 *   node scripts/play/status.mjs
 */
import { PACKAGE_NAME, getPublisher, log } from "./client.mjs";

async function main() {
  const androidpublisher = await getPublisher();
  const insert = await androidpublisher.edits.insert({ packageName: PACKAGE_NAME });
  const editId = insert.data.id;
  if (!editId) throw new Error("Failed to create Play Console edit");

  try {
    const [tracks, bundles, listings] = await Promise.all([
      androidpublisher.edits.tracks.list({ packageName: PACKAGE_NAME, editId }),
      androidpublisher.edits.bundles.list({ packageName: PACKAGE_NAME, editId }),
      androidpublisher.edits.listings.list({ packageName: PACKAGE_NAME, editId }),
    ]);

    const payload = {
      ok: true,
      packageName: PACKAGE_NAME,
      tracks: (tracks.data.tracks || []).map((t) => ({
        track: t.track,
        releases: (t.releases || []).map((r) => ({
          status: r.status,
          name: r.name,
          versionCodes: r.versionCodes,
        })),
      })),
      bundles: (bundles.data.bundles || []).map((b) => ({
        versionCode: b.versionCode,
        sha256: b.sha256,
      })),
      listings: (listings.data.listings || []).map((l) => ({
        language: l.language,
        title: l.title,
        shortDescription: l.shortDescription,
      })),
    };

    log("status", `package=${PACKAGE_NAME}`);
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await androidpublisher.edits.delete({ packageName: PACKAGE_NAME, editId });
  }
}

main().catch((error) => {
  console.error(`[play:status] ${error.message}`);
  if (error.response?.data) console.error(JSON.stringify(error.response.data, null, 2));
  process.exit(1);
});
