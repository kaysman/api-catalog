/**
 * Syncs the catalog frontend from ui/ into both packages:
 *
 *   packages/node/src/ui/*.ts   — TypeScript constant wrappers
 *   packages/rust/assets/*      — raw copies embedded via include_str!
 *
 * Each package needs its own copy so it can be published on its own (cargo
 * publish can't reach files outside the crate directory). Run this after
 * editing ui/styles.css or ui/client.js:
 *
 *   node scripts/build-ui.mjs
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root    = join(dirname(fileURLToPath(import.meta.url)), "..");
const nodeOut = join(root, "packages/node/src/ui");
const rustOut = join(root, "packages/rust/assets");

const styles = readFileSync(join(root, "ui/styles.css"), "utf8");
const client = readFileSync(join(root, "ui/client.js"), "utf8");

const banner = "// GENERATED — do not edit. Edit ui/styles.css or ui/client.js and re-run scripts/build-ui.mjs\n";

writeFileSync(
  join(nodeOut, "styles.ts"),
  `${banner}export const STYLES = ${JSON.stringify(styles)};\n`,
);

writeFileSync(
  join(nodeOut, "client.ts"),
  `${banner}export const CLIENT_SCRIPT = ${JSON.stringify(client)};\n`,
);

mkdirSync(rustOut, { recursive: true });
copyFileSync(join(root, "ui/styles.css"), join(rustOut, "styles.css"));
copyFileSync(join(root, "ui/client.js"), join(rustOut, "client.js"));

console.log("ui assets built → packages/node/src/ui/, packages/rust/assets/");
