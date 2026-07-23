#!/usr/bin/env node
// Regenerates reasoning/viewer.html from reasoning-map.json + viewer.template.html.
// Run after any edit to reasoning-map.json:  node reasoning/build-viewer.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const map = readFileSync(join(dir, "reasoning-map.json"), "utf8");
JSON.parse(map); // validate

const template = readFileSync(join(dir, "viewer.template.html"), "utf8");
const marker = "/*__REASONING_MAP_DATA__*/null";
if (!template.includes(marker)) {
  console.error("viewer.template.html is missing the data marker");
  process.exit(1);
}
writeFileSync(join(dir, "viewer.html"), template.replace(marker, map));
console.log("reasoning/viewer.html regenerated");
