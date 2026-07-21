#!/usr/bin/env node
/**
 * Sync Play Store listing copy + graphics from store-assets/.
 *
 * Usage:
 *   node scripts/play/sync-listing.mjs
 *   node scripts/play/sync-listing.mjs --dry-run
 *   node scripts/play/sync-listing.mjs --skip-images
 */
import { createReadStream, existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import {
  PACKAGE_NAME,
  ROOT,
  getPublisher,
  log,
  parseArgs,
  withEdit,
} from "./client.mjs";

const LISTING_JSON = resolve(ROOT, "store-assets/listing/en-US.json");
const FEATURE_GRAPHIC = resolve(ROOT, "store-assets/feature-graphic.png");
const ICON_CANDIDATES = [
  resolve(ROOT, "store-assets/icon-512.png"),
  resolve(ROOT, "public/icons/icon-512.png"),
  resolve(ROOT, "public/icons/icon-512.webp"),
];
const SCREENSHOT_DIR = resolve(ROOT, "store-assets/screenshots");

function loadListing() {
  if (!existsSync(LISTING_JSON)) {
    throw new Error(`Missing listing file: ${LISTING_JSON}`);
  }
  return JSON.parse(readFileSync(LISTING_JSON, "utf8"));
}

function listScreenshots() {
  if (!existsSync(SCREENSHOT_DIR)) return [];
  return readdirSync(SCREENSHOT_DIR)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort()
    .map((name) => resolve(SCREENSHOT_DIR, name));
}

function firstExisting(paths) {
  return paths.find((p) => existsSync(p)) || null;
}

async function uploadImage(androidpublisher, { editId, language, imageType, filePath }) {
  log("listing", `upload ${imageType}: ${basename(filePath)}`);
  await androidpublisher.edits.images.upload({
    packageName: PACKAGE_NAME,
    editId,
    language,
    imageType,
    media: {
      mimeType: mimeFor(filePath),
      body: createReadStream(filePath),
    },
  });
}

function mimeFor(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function clearImages(androidpublisher, { editId, language, imageType }) {
  try {
    await androidpublisher.edits.images.deleteall({
      packageName: PACKAGE_NAME,
      editId,
      language,
      imageType,
    });
  } catch (error) {
    // 404 = nothing to clear
    if (error.code !== 404 && error.response?.status !== 404) throw error;
  }
}

async function main() {
  const { flags } = parseArgs();
  const dryRun = Boolean(flags["dry-run"]);
  const skipImages = Boolean(flags["skip-images"]);
  const language = String(flags.language || "en-US");
  const listing = loadListing();
  const screenshots = listScreenshots();
  const icon = firstExisting(ICON_CANDIDATES);
  const featureGraphic = existsSync(FEATURE_GRAPHIC) ? FEATURE_GRAPHIC : null;

  log("listing", `title=${listing.title}`);
  log("listing", `short=${listing.shortDescription?.slice(0, 60)}…`);
  log("listing", `featureGraphic=${featureGraphic ? "yes" : "missing"}`);
  log("listing", `icon=${icon || "missing"}`);
  log("listing", `screenshots=${screenshots.length}`);

  if (dryRun) {
    log("listing", "dry-run ok — would sync listing (+ images unless --skip-images)");
    return;
  }

  const androidpublisher = await getPublisher();

  await withEdit(androidpublisher, PACKAGE_NAME, async (editId) => {
    await androidpublisher.edits.listings.update({
      packageName: PACKAGE_NAME,
      editId,
      language,
      requestBody: {
        language,
        title: listing.title,
        shortDescription: listing.shortDescription,
        fullDescription: listing.fullDescription,
        video: listing.video || undefined,
      },
    });
    log("listing", "listing text updated");

    if (listing.contactEmail || listing.contactWebsite || listing.contactPhone) {
      try {
        await androidpublisher.edits.details.update({
          packageName: PACKAGE_NAME,
          editId,
          requestBody: {
            contactEmail: listing.contactEmail,
            contactWebsite: listing.contactWebsite,
            contactPhone: listing.contactPhone,
            defaultLanguage: language,
          },
        });
        log("listing", "contact details updated");
      } catch (error) {
        log("listing", `contact details skipped: ${error.message}`);
      }
    }

    if (skipImages) {
      log("listing", "skipping images");
      return { language, screenshots: 0 };
    }

    if (featureGraphic) {
      await clearImages(androidpublisher, { editId, language, imageType: "featureGraphic" });
      await uploadImage(androidpublisher, {
        editId,
        language,
        imageType: "featureGraphic",
        filePath: featureGraphic,
      });
    }

    if (icon) {
      await clearImages(androidpublisher, { editId, language, imageType: "icon" });
      await uploadImage(androidpublisher, {
        editId,
        language,
        imageType: "icon",
        filePath: icon,
      });
    }

    if (screenshots.length) {
      await clearImages(androidpublisher, { editId, language, imageType: "phoneScreenshots" });
      for (const filePath of screenshots) {
        await uploadImage(androidpublisher, {
          editId,
          language,
          imageType: "phoneScreenshots",
          filePath,
        });
      }
    } else {
      log("listing", "no screenshots in store-assets/screenshots — skipped");
    }

    return { language, screenshots: screenshots.length };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        packageName: PACKAGE_NAME,
        language,
        images: {
          featureGraphic: Boolean(featureGraphic),
          icon: Boolean(icon),
          screenshots: screenshots.length,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[play:listing] ${error.message}`);
  if (error.response?.data) console.error(JSON.stringify(error.response.data, null, 2));
  process.exit(1);
});
