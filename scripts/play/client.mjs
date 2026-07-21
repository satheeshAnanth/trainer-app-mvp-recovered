/**
 * Shared Google Play Android Publisher client.
 *
 * Credential resolution (first match wins):
 * 1. PLAY_STORE_SERVICE_ACCOUNT_JSON  (raw JSON string)
 * 2. PLAY_STORE_SERVICE_ACCOUNT_FILE  (path to JSON)
 * 3. .secrets/play-store-service-account.json
 */
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";

export const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || "in.trainer.fitness";
export const ROOT = resolve(process.cwd());

export function resolveServiceAccountPath() {
  if (process.env.PLAY_STORE_SERVICE_ACCOUNT_JSON?.trim()) return null;
  const fromEnv = process.env.PLAY_STORE_SERVICE_ACCOUNT_FILE?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(ROOT, ".secrets/play-store-service-account.json");
}

export function loadServiceAccount() {
  const raw = process.env.PLAY_STORE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`PLAY_STORE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
    }
  }

  const path = resolveServiceAccountPath();
  if (!path || !existsSync(path)) {
    throw new Error(
      [
        "Play Store service account not found.",
        "Place the JSON key at .secrets/play-store-service-account.json",
        "or set PLAY_STORE_SERVICE_ACCOUNT_JSON / PLAY_STORE_SERVICE_ACCOUNT_FILE.",
        "See docs/play-store/AUTOMATION.md",
      ].join(" ")
    );
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export async function getPublisher() {
  const credentials = loadServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const authClient = await auth.getClient();
  return google.androidpublisher({ version: "v3", auth: authClient });
}

export async function withEdit(androidpublisher, packageName, fn) {
  const insert = await androidpublisher.edits.insert({ packageName });
  const editId = insert.data.id;
  if (!editId) throw new Error("Failed to create Play Console edit");

  try {
    const result = await fn(editId);
    await androidpublisher.edits.commit({ packageName, editId });
    return result;
  } catch (error) {
    try {
      await androidpublisher.edits.delete({ packageName, editId });
    } catch {
      /* ignore cleanup failures */
    }
    throw error;
  }
}

export function defaultAabPath() {
  return resolve(ROOT, "android/app/build/outputs/bundle/release/app-release.aab");
}

export function openFileStream(filePath) {
  const abs = resolve(filePath);
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return { abs, stream: createReadStream(abs) };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { flags, positionals };
}

export function log(step, message) {
  console.log(`[play:${step}] ${message}`);
}
