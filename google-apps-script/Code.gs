/**
 * HOTEL DAMVIEW - GOOGLE APPS SCRIPT ENTERPRISE BACKEND
 * Automated Document & Sheet Synchronization with Public Google Drive PDF Archiving & Cascade Deletion
 *
 * Deployment Instructions:
 * 1. Open Google Sheets (create a new blank spreadsheet named "Hotel Damview ERP").
 * 2. Click Extensions > Apps Script.
 * 3. Replace the contents of Code.gs with this entire script.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Set Description: "Hotel Damview Webhook Sync".
 * 7. Set "Execute as": "Me" (your Google account).
 * 8. Set "Who has access": "Anyone" (allows zero-auth headless background sync).
 * 9. Click "Deploy", authorize permissions, and copy the Web App URL into Hotel Damview Settings.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 30 seconds for concurrent requests
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, error: "No post data received" });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return responseJSON({ success: false, error: "Invalid JSON payload" });
    }

    var action = data.action || "PING";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetTabs(ss);

    // 1. PING & HEALTH CHECK
    if (action === "PING") {
      return responseJSON({
        success: true,
        message: "Hotel Damview Google Apps Script Webhook is active and connected.",
        sheetName: ss.getName(),
        sheetUrl: ss.getUrl(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. CLIENT SYNCHRONIZATION
    if (action === "UPSERT_CLIENT") {
      var clientResult = upsertClient(ss, data.client);
      return responseJSON({ success: true, result: clientResult });
    }

    // 3. DOCUMENT SYNCHRONIZATION & DRIVE ARCHIVAL
    if (action === "UPSERT_DOCUMENT") {
      var docResult = upsertDocument(ss, data.document);
      var archiveResult = null;

      // Handle PDF archival to Google Drive with public view permission
      if (data.pdfBase64 && data.document) {
        archiveResult = archivePdfToDrive(data.document, data.pdfBase64, data.folderName);
        if (archiveResult && archiveResult.url) {
          updateDocDriveUrlInSheet(ss, data.document, archiveResult.url);
        }
      }

      return responseJSON({
        success: true,
        document: docResult,
        pdfArchived: archiveResult
      });
    }

    // 4. PAYMENT SETTLEMENT RECORDING
    if (action === "RECORD_PAYMENT") {
      var paymentResult = recordPayment(ss, data.payment);
      return responseJSON({ success: true, payment: paymentResult });
    }

    // 5. CASCADE DELETE DOCUMENT (Sheet Row + Drive PDF)
    if (action === "CASCADE_DELETE_DOCUMENT") {
      var deleteResult = cascadeDeleteDocument(ss, data.documentId, data.documentNumber, data.folderName);
      return responseJSON({ success: true, result: deleteResult });
    }

    // 6. CASCADE DELETE CLIENT (Sheet Row)
    if (action === "CASCADE_DELETE_CLIENT") {
      var clientDeleteResult = cascadeDeleteClient(ss, data.clientId);
      return responseJSON({ success: true, result: clientDeleteResult });
    }

    // 7. GET REAL-TIME SHEET DATA FOR EMBEDDED PREVIEW
    if (action === "GET_SHEET_DATA") {
      var sheetData = getAllSheetData(ss);
      return responseJSON({ success: true, data: sheetData });
    }

    return responseJSON({ success: false, error: "Unknown action: " + action });

  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetTabs(ss);

  if (action === "GET_DATA" || action === "GET_SHEET_DATA") {
    var data = getAllSheetData(ss);
    return responseJSON({ success: true, data: data });
  }

  return HtmlService.createHtmlOutput(
    "<html><body style='font-family:sans-serif;padding:24px;text-align:center;'>" +
    "<h2 style='color:#78350f;'>Hotel Damview ERP Webhook</h2>" +
    "<p style='color:#166534;font-weight:bold;'>Status: Online & Ready for Sync</p>" +
    "<p style='color:#52525b;'>Connected Spreadsheet: <b>" + ss.getName() + "</b></p>" +
    "<a href='" + ss.getUrl() + "' target='_blank' style='display:inline-block;padding:8px 16px;background:#18181b;color:#fde68a;text-decoration:none;border-radius:4px;'>Open Centralized Sheet</a>" +
    "</body></html>"
  );
}

/**
 * Ensures all required tabs exist with standardized headers
 */
function ensureSheetTabs(ss) {
  var requiredSheets = {
    "Clients": ["Client ID", "Client Name", "Contact Person", "Email", "Phone", "KRA PIN", "Address", "Registered Date"],
    "Quotations": ["Doc Number", "Doc ID", "Client Name", "KRA PIN", "Issue Date", "Due Date", "Subtotal (Ksh)", "VAT (16%)", "Grand Total (Ksh)", "Status", "Items Count", "Drive PDF Link", "Last Synced"],
    "Proformas": ["Doc Number", "Doc ID", "Client Name", "KRA PIN", "Issue Date", "Due Date", "Subtotal (Ksh)", "VAT (16%)", "Grand Total (Ksh)", "Status", "Items Count", "Drive PDF Link", "Last Synced"],
    "Invoices": ["Doc Number", "Doc ID", "Client Name", "KRA PIN", "Issue Date", "Due Date", "Subtotal (Ksh)", "VAT (16%)", "Grand Total (Ksh)", "Amount Paid (Ksh)", "Balance Due (Ksh)", "Status", "Drive PDF Link", "Last Synced"],
    "Payments": ["Receipt No", "Date", "Invoice No", "Client Name", "Amount (Ksh)", "Payment Mode", "Reference Notes", "Recorded At"]
  };

  for (var sheetName in requiredSheets) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = requiredSheets[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f4f4f5");
      sheet.setFrozenRows(1);
    }
  }

  // Remove default 'Sheet1' if empty and unused
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) {
    try { ss.deleteSheet(sheet1); } catch (e) {}
  }
}

/**
 * Upsert client record with deduplication
 */
function upsertClient(ss, client) {
  if (!client || !client.name) return { status: "skipped", reason: "empty client" };
  var sheet = ss.getSheetByName("Clients");
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == client.id || (client.kraPin && data[i][5] == client.kraPin)) {
      rowIdx = i + 1;
      break;
    }
  }

  var rowValues = [
    client.id || "",
    client.name || "",
    client.contactPerson || "",
    client.email || "",
    client.phone || "",
    client.kraPin || "",
    client.address || "",
    client.createdAt || new Date().toISOString().split("T")[0]
  ];

  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
    return { status: "updated", row: rowIdx };
  } else {
    sheet.appendRow(rowValues);
    return { status: "inserted", row: sheet.getLastRow() };
  }
}

/**
 * Upsert billing document (Quotation, Proforma, or Invoice)
 */
function upsertDocument(ss, doc) {
  if (!doc || !doc.documentNumber) return { status: "skipped" };

  var tabName = "Invoices";
  if (doc.documentType === "QUOTATION") tabName = "Quotations";
  else if (doc.documentType === "PROFORMA") tabName = "Proformas";

  var sheet = ss.getSheetByName(tabName);
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == doc.documentNumber || data[i][1] == doc.id) {
      rowIdx = i + 1;
      break;
    }
  }

  // Preserve existing drive URL if present
  var existingDriveUrl = (rowIdx > 0 && data[rowIdx - 1]) ? (tabName === "Invoices" ? data[rowIdx - 1][12] : data[rowIdx - 1][11]) : "";
  var driveLink = doc.driveFileUrl || existingDriveUrl || "";

  var rowValues = [];
  if (tabName === "Invoices") {
    rowValues = [
      doc.documentNumber,
      doc.id,
      doc.clientName,
      doc.clientKraPin || "",
      doc.issueDate,
      doc.dueDate,
      doc.subtotal || 0,
      doc.vatAmount || 0,
      doc.grandTotal || 0,
      doc.amountPaid || 0,
      doc.balanceDue || 0,
      doc.status || "Draft",
      driveLink,
      new Date().toISOString()
    ];
  } else {
    rowValues = [
      doc.documentNumber,
      doc.id,
      doc.clientName,
      doc.clientKraPin || "",
      doc.issueDate,
      doc.dueDate,
      doc.subtotal || 0,
      doc.vatAmount || 0,
      doc.grandTotal || 0,
      doc.status || "Draft",
      (doc.lineItems ? doc.lineItems.length : 0),
      driveLink,
      new Date().toISOString()
    ];
  }

  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
    return { status: "updated", tab: tabName, row: rowIdx };
  } else {
    sheet.appendRow(rowValues);
    return { status: "inserted", tab: tabName, row: sheet.getLastRow() };
  }
}

/**
 * Update Document Drive URL in Sheet
 */
function updateDocDriveUrlInSheet(ss, doc, driveUrl) {
  var tabName = "Invoices";
  if (doc.documentType === "QUOTATION") tabName = "Quotations";
  else if (doc.documentType === "PROFORMA") tabName = "Proformas";

  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == doc.documentNumber || data[i][1] == doc.id) {
      var colIdx = (tabName === "Invoices") ? 13 : 12;
      sheet.getRange(i + 1, colIdx).setValue(driveUrl);
      break;
    }
  }
}

/**
 * Record a client settlement payment
 */
function recordPayment(ss, payment) {
  if (!payment || !payment.receiptNumber) return { status: "skipped" };
  var sheet = ss.getSheetByName("Payments");
  var data = sheet.getDataRange().getValues();
  var exists = false;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == payment.receiptNumber) {
      exists = true;
      break;
    }
  }

  var rowValues = [
    payment.receiptNumber,
    payment.date,
    payment.documentNumber || "",
    payment.clientName || "",
    payment.amount || 0,
    payment.paymentMode || "Bank Transfer",
    payment.referenceNote || "",
    new Date().toISOString()
  ];

  if (!exists) {
    sheet.appendRow(rowValues);
  }

  // Update Invoice amount paid in Invoices tab if present
  if (payment.documentNumber) {
    var invSheet = ss.getSheetByName("Invoices");
    if (invSheet) {
      var invData = invSheet.getDataRange().getValues();
      for (var j = 1; j < invData.length; j++) {
        if (invData[j][0] == payment.documentNumber) {
          var grandTotal = Number(invData[j][8]) || 0;
          var currPaid = Number(invData[j][9]) || 0;
          var newPaid = currPaid + payment.amount;
          var newBal = Math.max(0, grandTotal - newPaid);
          invSheet.getRange(j + 1, 10).setValue(newPaid);
          invSheet.getRange(j + 1, 11).setValue(newBal);
          if (newBal <= 0) invSheet.getRange(j + 1, 12).setValue("Paid");
          break;
        }
      }
    }
  }

  return { status: exists ? "already_recorded" : "recorded" };
}

/**
 * Archive PDF Blob into Google Drive Folder with Public View Permissions
 */
function archivePdfToDrive(doc, base64Pdf, folderName) {
  try {
    var targetFolderName = folderName || "Hotel Damview Archives";
    var folders = DriveApp.getFoldersByName(targetFolderName);
    var targetFolder;
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(targetFolderName);
      // Set folder to anyone with link can view
      try {
        targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {}
    }

    // Clean base64 string
    var cleanBase64 = base64Pdf.replace(/^data:application\/pdf;base64,/, "");
    var decodedBlob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), "application/pdf");

    // Standard naming format: [DocNo]_[ClientName]_[YYYY-MM-DD].pdf
    var sanitizedClient = (doc.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
    var fileName = (doc.documentNumber || "DOC") + "_" + sanitizedClient + "_" + (doc.issueDate || "DATE") + ".pdf";
    decodedBlob.setName(fileName);

    var existingFiles = targetFolder.getFilesByName(fileName);
    var file;
    var status = "created";

    if (existingFiles.hasNext()) {
      file = existingFiles.next();
      file.setContent(cleanBase64);
      status = "updated";
    } else {
      file = targetFolder.createFile(decodedBlob);
    }

    // Ensure file is publicly viewable with link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareFileErr) {}

    return {
      status: status,
      fileId: file.getId(),
      url: file.getUrl(),
      downloadUrl: file.getDownloadUrl(),
      fileName: fileName
    };
  } catch (err) {
    return { status: "error", error: err.toString() };
  }
}

/**
 * Cascade Delete Document: Removes row from Google Sheet and trashes PDF from Drive
 */
function cascadeDeleteDocument(ss, docId, docNumber, folderName) {
  var deletedFromSheets = [];
  var fileTrashed = false;

  // 1. Check all document tabs (Quotations, Proformas, Invoices)
  var tabs = ["Invoices", "Quotations", "Proformas"];
  for (var t = 0; t < tabs.length; t++) {
    var sheet = ss.getSheetByName(tabs[t]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if ((docNumber && data[i][0] == docNumber) || (docId && data[i][1] == docId)) {
        sheet.deleteRow(i + 1);
        deletedFromSheets.push({ tab: tabs[t], row: i + 1 });
      }
    }
  }

  // 2. Trash PDF in Google Drive
  try {
    var targetFolderName = folderName || "Hotel Damview Archives";
    var folders = DriveApp.getFoldersByName(targetFolderName);
    if (folders.hasNext()) {
      var folder = folders.next();
      var files = folder.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        var fname = f.getName();
        if (docNumber && fname.indexOf(docNumber) === 0) {
          f.setTrashed(true);
          fileTrashed = true;
        }
      }
    }
  } catch (driveErr) {
    console.warn("Drive trash warning: " + driveErr.toString());
  }

  return {
    deletedFromSheets: deletedFromSheets,
    fileTrashed: fileTrashed,
    docNumber: docNumber,
    docId: docId
  };
}

/**
 * Cascade Delete Client: Removes row from Clients tab
 */
function cascadeDeleteClient(ss, clientId) {
  var sheet = ss.getSheetByName("Clients");
  if (!sheet) return { deleted: false };
  var data = sheet.getDataRange().getValues();
  var deleted = false;
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] == clientId) {
      sheet.deleteRow(i + 1);
      deleted = true;
      break;
    }
  }
  return { deleted: deleted, clientId: clientId };
}

/**
 * Retrieve all sheet data formatted for live embedded table view
 */
function getAllSheetData(ss) {
  var tabs = ["Quotations", "Proformas", "Invoices", "Clients", "Payments"];
  var result = {};
  for (var i = 0; i < tabs.length; i++) {
    var tabName = tabs[i];
    var sheet = ss.getSheetByName(tabName);
    if (sheet) {
      var values = sheet.getDataRange().getValues();
      if (values.length > 0) {
        result[tabName] = {
          headers: values[0],
          rows: values.slice(1)
        };
      } else {
        result[tabName] = { headers: [], rows: [] };
      }
    } else {
      result[tabName] = { headers: [], rows: [] };
    }
  }
  return result;
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
