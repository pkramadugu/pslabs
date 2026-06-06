const { createSign } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const localAppointmentsPath = () => path.join(__dirname, "..", "data", "skincare-appointments.jsonl");

let cachedGoogleToken = "";
let cachedGoogleTokenExpiry = 0;

const jsonResponse = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readRequestBody = async (req) => {
  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
  }

  return raw ? JSON.parse(raw) : {};
};

const formatAppointmentDate = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium"
  }).format(date);
};

const clean = (value, maxLength = 500) => {
  return String(value || "").trim().slice(0, maxLength);
};

const jsonOrText = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return { raw: text };
  }
};

const base64Url = (input) => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const serviceAccountFromEnv = () => {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key ? parsed.private_key.replace(/\\n/g, "\n") : ""
    };
  }

  return {
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8")
      : process.env.GOOGLE_PRIVATE_KEY
  };
};

const googleConfig = () => {
  const serviceAccount = serviceAccountFromEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const missing = [];

  if (!spreadsheetId) missing.push("GOOGLE_SHEETS_SPREADSHEET_ID");
  if (!serviceAccount.clientEmail) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY_JSON");
  }
  if (!serviceAccount.privateKey) {
    missing.push("GOOGLE_PRIVATE_KEY, GOOGLE_PRIVATE_KEY_BASE64, or GOOGLE_SERVICE_ACCOUNT_KEY_JSON");
  }

  return {
    ...serviceAccount,
    spreadsheetId,
    range: process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A:E",
    missing
  };
};

const googleAccessToken = async (config) => {
  if (cachedGoogleToken && cachedGoogleTokenExpiry > Date.now() + 60000) {
    return cachedGoogleToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claims = {
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const privateKey = config.privateKey.replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  const data = await jsonOrText(response);

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Unable to authenticate Google Sheets service account");
  }

  cachedGoogleToken = data.access_token;
  cachedGoogleTokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedGoogleToken;
};

const appendViaAppsScript = async (appointment) => {
  const webhookUrl = String(process.env.GOOGLE_APPS_SCRIPT_URL || "").trim();
  if (!webhookUrl) {
    return {
      ok: false,
      configured: false,
      missing: ["GOOGLE_APPS_SCRIPT_URL"]
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      date: appointment.date,
      name: appointment.name,
      phone: appointment.phone,
      timestamp: appointment.timestamp,
      status: ""
    }),
    redirect: "follow"
  });
  const data = await jsonOrText(response);

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Google Sheets webhook failed (${response.status})`);
  }

  return {
    ok: true,
    configured: true,
    method: "apps-script"
  };
};

const appendViaServiceAccount = async (appointment, config) => {
  const accessToken = await googleAccessToken(config);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(config.range)}:append`
  );
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [[
        appointment.date,
        appointment.name,
        appointment.phone,
        appointment.timestamp,
        ""
      ]]
    })
  });
  const data = await jsonOrText(response);

  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to append appointment to Google Sheets");
  }

  return {
    ok: true,
    configured: true,
    method: "service-account",
    updatedRange: data.updates?.updatedRange || null
  };
};

const saveLocalAppointment = async (appointment) => {
  const filePath = localAppointmentsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(appointment)}\n`, "utf8");

  return {
    ok: true,
    configured: true,
    method: "local-file"
  };
};

const googleSheetsConfigured = () => {
  if (String(process.env.GOOGLE_APPS_SCRIPT_URL || "").trim()) {
    return true;
  }

  return googleConfig().missing.length === 0;
};

const appendToGoogleSheet = async (appointment) => {
  const webhookUrl = String(process.env.GOOGLE_APPS_SCRIPT_URL || "").trim();
  if (webhookUrl) {
    return appendViaAppsScript(appointment);
  }

  const config = googleConfig();
  if (config.missing.length === 0) {
    return appendViaServiceAccount(appointment, config);
  }

  if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return {
      ok: false,
      configured: false,
      missing: ["GOOGLE_APPS_SCRIPT_URL"],
      setupSteps: [
        "Open your Google Sheet → Extensions → Apps Script",
        "Paste skincare/google-sheet-webhook.gs → Save",
        "Deploy → New deployment → Web app (Execute as Me, access Anyone)",
        "Copy the web app URL into .env.local as GOOGLE_APPS_SCRIPT_URL",
        "Restart the server: node server.js"
      ]
    };
  }

  return saveLocalAppointment(appointment);
};

const whatsappConfig = () => {
  const missing = [];
  const config = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    alertTo: process.env.WHATSAPP_ALERT_TO,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v23.0"
  };

  if (!config.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!config.alertTo) missing.push("WHATSAPP_ALERT_TO");

  return {
    ...config,
    missing
  };
};

const sendWhatsAppAlert = async (appointment) => {
  const config = whatsappConfig();
  if (config.missing.length) {
    return {
      ok: false,
      configured: false,
      missing: config.missing
    };
  }

  const body = [
    "New skincare callback request",
    `Date: ${appointment.date}`,
    `Name: ${appointment.name}`,
    `Phone: ${appointment.phone}`,
    `Timestamp: ${appointment.timestamp}`
  ].join("\n");

  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: config.alertTo,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });
  const data = await jsonOrText(response);

  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to send WhatsApp appointment alert");
  }

  return {
    ok: true,
    configured: true,
    messageId: data.messages?.[0]?.id || null,
    messageStatus: data.messages?.[0]?.message_status || null
  };
};

const integrationResult = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error.message
    };
  }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Use POST" });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const createdAt = new Date();
    const appointment = {
      timestamp: createdAt.toISOString(),
      date: formatAppointmentDate(createdAt),
      name: clean(body.name, 120),
      phone: clean(body.phone, 32),
      status: ""
    };

    const missingFields = [];
    if (!appointment.name) missingFields.push("name");
    if (!appointment.phone) missingFields.push("phone");

    if (missingFields.length) {
      jsonResponse(res, 400, {
        error: "Name and phone number are required",
        missingFields
      });
      return;
    }

    const [googleSheets, whatsapp] = await Promise.all([
      integrationResult(() => appendToGoogleSheet(appointment)),
      integrationResult(() => sendWhatsAppAlert(appointment))
    ]);
    const integrations = {
      googleSheets,
      whatsapp
    };
    const whatsappIsConfigured = whatsapp.configured;
    const sheetsIsConfigured = googleSheetsConfigured();

    if (!googleSheets.ok) {
      const statusCode = googleSheets.configured ? 502 : 501;
      jsonResponse(res, statusCode, {
        error: googleSheets.error
          || (googleSheets.configured
            ? "Could not save the appointment to Google Sheets"
            : "Google Sheets is not connected yet"),
        setupSteps: googleSheets.setupSteps,
        missing: googleSheets.missing,
        integrations
      });
      return;
    }

    if (whatsappIsConfigured && !whatsapp.ok) {
      jsonResponse(res, 502, {
        error: whatsapp.error || "Could not send the WhatsApp alert",
        integrations
      });
      return;
    }

    jsonResponse(res, 200, {
      message: "Appointment request received",
      appointment: {
        date: appointment.date,
        name: appointment.name,
        phone: appointment.phone
      },
      integrations
    });
  } catch (error) {
    jsonResponse(res, 400, {
      error: error.message || "Invalid appointment request"
    });
  }
};
