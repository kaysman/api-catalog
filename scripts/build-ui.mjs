/**
 * Reads the raw CSS and JS from ui/ and generates TypeScript constant wrappers
 * at packages/api-catalog/src/ui/. Run this after editing ui/styles.css or
 * ui/client.js to keep the npm package in sync.
 *
 *   node scripts/build-ui.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out  = join(root, "packages/api-catalog/src/ui");

const styles = readFileSync(join(root, "ui/styles.css"), "utf8");
const client = readFileSync(join(root, "ui/client.js"), "utf8");

const banner = "// GENERATED — do not edit. Edit ui/styles.css or ui/client.js and re-run scripts/build-ui.mjs\n";

writeFileSync(
  join(out, "styles.ts"),
  `${banner}export const STYLES = ${JSON.stringify(styles)};\n`,
);

writeFileSync(
  join(out, "client.ts"),
  `${banner}export const CLIENT_SCRIPT = ${JSON.stringify(client)};\n`,
);

console.log("ui assets built → packages/api-catalog/src/ui/");
