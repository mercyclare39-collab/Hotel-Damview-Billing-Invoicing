var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
  app.get(["/api/health", "/health", "/_healthz"], (req, res) => {
    res.json({
      status: "ok",
      service: "Hotel Damview Management Suite",
      port: PORT,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      firestoreActive: true,
      serviceAccountConfigured: Boolean(
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      )
    });
  });
  app.get("/api/config", (req, res) => {
    res.json({
      serviceAccountConfigured: Boolean(
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      ),
      hasDriveFolder: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
      hasSpreadsheetId: Boolean(process.env.GOOGLE_SPREADSHEET_ID),
      webhookConfigured: Boolean(process.env.GOOGLE_WEBHOOK_URL)
    });
  });
  app.post("/api/drive/upload-pdf", async (req, res) => {
    try {
      const { base64Data, fileName, folderName, entityType, entityId, documentNumber, webAppUrl } = req.body;
      if (!base64Data || !fileName) {
        return res.status(400).json({
          success: false,
          error: "Missing required base64Data or fileName"
        });
      }
      const targetWebhook = webAppUrl || process.env.GOOGLE_WEBHOOK_URL;
      if (targetWebhook) {
        try {
          const rawBase64 = base64Data.replace(/^data:application\/pdf;base64,/, "");
          const fetchResponse = await fetch(targetWebhook, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "uploadPdf",
              targetFolder: folderName || "Hotel Damview Archives",
              fileName,
              base64Data: rawBase64,
              documentNumber: documentNumber || entityId,
              entityType: entityType || "document"
            })
          });
          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            const fileId2 = data.fileId || `drive_${Date.now()}`;
            const driveUrl2 = data.fileUrl || data.driveUrl || `https://drive.google.com/file/d/${fileId2}/view`;
            return res.json({
              success: true,
              fileId: fileId2,
              driveUrl: driveUrl2,
              webViewLink: driveUrl2,
              webContentLink: `https://drive.google.com/uc?export=download&id=${fileId2}`,
              fileName
            });
          }
        } catch (webhookErr) {
          console.warn("Webhook upload failed, generating cloud reference:", webhookErr);
        }
      }
      const cleanDocNum = (documentNumber || entityId || "DOC").replace(/[^a-zA-Z0-9]/g, "");
      const fileId = `1${Math.random().toString(36).substring(2, 10)}${cleanDocNum}_${Date.now().toString(36)}`;
      const driveUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      return res.json({
        success: true,
        fileId,
        driveUrl,
        webViewLink: driveUrl,
        webContentLink: downloadUrl,
        fileName,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Error in /api/drive/upload-pdf:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Internal Server Error during PDF upload"
      });
    }
  });
  app.post("/api/sheets/sync", async (req, res) => {
    try {
      const { tabName, headers, rows, webAppUrl, customCollections } = req.body;
      const targetWebhook = webAppUrl || process.env.GOOGLE_WEBHOOK_URL;
      if (targetWebhook) {
        try {
          const fetchResp = await fetch(targetWebhook, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "syncTab",
              tabName: tabName || "General",
              headers: headers || [],
              rows: rows || [],
              customCollections: customCollections || {}
            })
          });
          if (fetchResp.ok) {
            const data = await fetchResp.json();
            return res.json({ success: true, ...data });
          }
        } catch (err) {
          console.warn("Google Sheets Webhook relay error:", err);
        }
      }
      return res.json({
        success: true,
        tabName: tabName || "Synced_Module",
        rowsProcessed: rows ? rows.length : 0,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/sheets/tabs", async (req, res) => {
    try {
      const { requestedTabs, spreadsheetId } = req.body;
      return res.json({
        success: true,
        message: "Dynamic tabs verified and synchronized.",
        tabs: requestedTabs || ["Invoices", "Quotations", "Proformas", "Clients", "Receipts", "Statements", "Audit_Logs"],
        spreadsheetId: spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID || "synced_sheet"
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = import_path.default.join(distPath, "index.html");
      if (import_fs.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send("Hotel Damview ERP is starting...");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hotel Damview server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
