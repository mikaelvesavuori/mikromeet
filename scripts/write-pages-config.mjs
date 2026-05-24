#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = process.env.MIKROMEET_PAGES_OUTPUT_DIR || "dist/app";
const apiUrl = process.env.MIKROMEET_API_URL || "wss://meet-api.mikrosuite.com/ws";
const defaultIceServers = [{ urls: "stun:stun.cloudflare.com:3478" }];

if (!/^wss?:\/\/.+\/ws$/.test(apiUrl)) {
  throw new Error("MIKROMEET_API_URL must be a ws(s) URL ending in /ws.");
}

const iceServers = parseIceServers(process.env.MIKROMEET_ICE_SERVERS_JSON) || defaultIceServers;
const config = {
  apiUrl,
  iceServers,
};

await mkdir(outputDir, { recursive: true });

const contents = `${JSON.stringify(config, null, 2)}\n`;

await writeFile(path.join(outputDir, "config.json"), contents, "utf8");
await writeFile(path.join(outputDir, "mikromeet.config.json"), contents, "utf8");

process.stdout.write(`Wrote MikroMeet Pages config for ${apiUrl}\n`);

function parseIceServers(value) {
  if (!value) return undefined;

  const parsed = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error("MIKROMEET_ICE_SERVERS_JSON must be a JSON array.");
  }

  return parsed;
}
