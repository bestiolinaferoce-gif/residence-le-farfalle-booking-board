import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env.local");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(envPath);

const baseUrl = (process.env.CHANNEL_SYNC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3005").replace(/\/$/, "");
const internalToken =
  process.env.API_WRITE_SECRET ||
  process.env.NEXT_PUBLIC_API_WRITE_SECRET ||
  process.env.CRON_SECRET ||
  "";

const headers = {};
if (internalToken) headers["X-Internal-Token"] = internalToken;

const response = await fetch(`${baseUrl}/api/channel-sync`, {
  method: "POST",
  headers,
});

const text = await response.text();
let data = null;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

if (!response.ok) {
  console.error("[channel-sync] failed", response.status, data);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
