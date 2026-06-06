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

  const webhookUrl = String(process.env.GOOGLE_APPS_SCRIPT_URL || "").trim();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  console.log("Spreadsheet ID:", spreadsheetId || "(not set)");
  console.log("Apps Script URL:", webhookUrl || "(not set — bookings will NOT reach Google Sheets)");

  if (!webhookUrl) {
    console.log("\nSetup required:");
    console.log("1. Open https://docs.google.com/spreadsheets/d/" + (spreadsheetId || "YOUR_SHEET_ID") + "/edit");
    console.log("2. Extensions → Apps Script → paste skincare/google-sheet-webhook.gs");
    console.log("3. Deploy → Web app → Execute as Me, access Anyone");
    console.log("4. Add GOOGLE_APPS_SCRIPT_URL=... to .env.local and restart node server.js");
    process.exit(1);
  }

  const getResponse = await fetch(webhookUrl);
  const getBody = await getResponse.text();
  console.log("\nGET test:", getResponse.status, getBody.slice(0, 120));

  const postResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "6 Jun 2026",
      name: "Google Sheet Test",
      phone: "9999999999",
      timestamp: new Date().toISOString(),
      status: ""
    }),
    redirect: "follow"
  });
  const postBody = await postResponse.text();
  console.log("POST test:", postResponse.status, postBody);

  if (!postResponse.ok) {
    process.exit(1);
  }

  console.log("\nSuccess — check your Google Sheet for a new row.");
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
