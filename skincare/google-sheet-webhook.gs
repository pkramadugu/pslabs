/**
 * Priyanka's Skin Care — Google Sheet webhook
 *
 * Setup:
 * 1. Open https://docs.google.com/spreadsheets/d/1OkL7JXwzkd-zBxWs2Mm-yFefez_nZj3xF4xSXxQppFo/edit
 * 2. Extensions → Apps Script → replace Code.gs with this file → Save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web app URL into .env.local as GOOGLE_APPS_SCRIPT_URL
 */

const HEADERS = [
  "Date",
  "Name",
  "Phone",
  "Timestamp",
  "Status"
];

function sheetForAppointments_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName("Sheet1") || spreadsheet.getSheets()[0];
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: "Priyanka's Skin Care appointment webhook is ready. Use POST to submit bookings."
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const sheet = sheetForAppointments_();

    ensureHeaders_(sheet);
    sheet.appendRow([
      payload.date || "",
      payload.name || "",
      payload.phone || "",
      payload.timestamp || payload.createdAt || new Date().toISOString(),
      ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error.message || error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
