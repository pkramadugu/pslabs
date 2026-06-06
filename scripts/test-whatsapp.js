const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.join(__dirname, "..");

const loadEnv = async () => {
  const envPath = path.join(root, ".env.local");
  const raw = await fs.readFile(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator === -1) return;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
};

const main = async () => {
  await loadEnv();

  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const alertTo = String(process.env.WHATSAPP_ALERT_TO || "").replace(/\D/g, "");
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

  const missing = [];
  if (!accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!alertTo) missing.push("WHATSAPP_ALERT_TO");

  if (missing.length) {
    console.log("Missing:", missing.join(", "));
    console.log("\nSetup:");
    console.log("1. https://developers.facebook.com → Create app → Add WhatsApp product");
    console.log("2. WhatsApp → API Setup → copy Phone number ID and temporary access token");
    console.log("3. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to .env.local");
    console.log("4. Add your clinic WhatsApp number as a test recipient (dev mode)");
    console.log("5. Restart node server.js and run: node scripts/test-whatsapp.js");
    process.exit(1);
  }

  const body = [
    "PSLabs test alert",
    "New skincare callback request",
    `Date: ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`,
    "Name: WhatsApp Test",
    "Phone: 9999999999"
  ].join("\n");

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: alertTo,
      type: "text",
      text: { preview_url: false, body }
    })
  });

  const data = await response.json().catch(() => ({}));
  console.log("Status:", response.status);
  console.log(JSON.stringify(data, null, 2));

  if (!response.ok) {
    process.exit(1);
  }

  console.log(`\nSuccess — check WhatsApp on ${alertTo}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
