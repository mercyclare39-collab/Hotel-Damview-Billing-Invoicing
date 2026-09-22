/**
 * HOTEL DAMVIEW - GOOGLE APPS SCRIPT ENTERPRISE BACKEND
 * Deploy as Web App (Execute as: Me, Who has access: Anyone)
 *
 * Provisioned Tabs:
 * 1. Invoices
 * 2. Quotations
 * 3. Proformas
 * 4. Clients
 * 5. Receipts (New: Payment Vouchers & Settlement Tracking)
 * 6. Audit_Log (New: Comprehensive Mutational Tracking)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "PING";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetTabs(ss);

    if (action === "PING") {
      logAudit(ss, "PING", "Healthcheck ping received", "SUCCESS");
      return responseJSON({ success: true, sheetName: ss.getName(), sheetUrl: ss.getUrl() });
    }

    if (action === "UPSERT_CLIENT") {
      var clientRes = upsertClient(ss, data.client);
      logAudit(ss, "UPSERT_CLIENT", "Client: " + (data.client ? data.client.name : "N/A"), "SUCCESS");
      return responseJSON({ success: true, result: clientRes });
    }

    if (action === "UPSERT_DOCUMENT") {
      var docResult = upsertDocument(ss, data.document);
      var archiveResult = null;
      if (data.pdfBase64 && data.document) {
        archiveResult = archivePdfToDrive(data.document, data.pdfBase64, data.folderName);
        if (archiveResult && archiveResult.url) {
          updateDocumentDriveUrl(ss, data.document, archiveResult.url);
        }
      }
      logAudit(ss, "UPSERT_DOCUMENT", (data.document ? data.document.documentNumber : "Doc") + " recorded", "SUCCESS");
      return responseJSON({ success: true, document: docResult, pdfArchived: archiveResult });
    }

    if (action === "RECORD_PAYMENT") {
      var pmtResult = recordPayment(ss, data.payment);
      var receiptArchive = null;
      if (data.pdfBase64 && data.payment) {
        receiptArchive = archiveReceiptPdfToDrive(data.payment, data.pdfBase64, data.folderName);
        if (receiptArchive && receiptArchive.url) {
          updateReceiptDriveUrl(ss, data.payment, receiptArchive.url);
        }
      }
      logAudit(ss, "RECORD_PAYMENT", (data.payment ? data.payment.receiptNumber : "Payment") + " recorded", "SUCCESS");
      return responseJSON({ success: true, payment: pmtResult, pdfArchived: receiptArchive });
    }

    if (action === "CASCADE_DELETE_DOCUMENT") {
      var delDocResult = cascadeDeleteDocument(ss, data.documentId, data.documentNumber, data.folderName);
      logAudit(ss, "CASCADE_DELETE_DOCUMENT", "Deleted doc: " + data.documentNumber, "SUCCESS");
      return responseJSON({ success: true, result: delDocResult });
    }

    if (action === "CASCADE_DELETE_CLIENT") {
      var delClientResult = cascadeDeleteClient(ss, data.clientId);
      logAudit(ss, "CASCADE_DELETE_CLIENT", "Deleted client ID: " + data.clientId, "SUCCESS");
      return responseJSON({ success: true, result: delClientResult });
    }

    if (action === "GET_SHEET_DATA") {
      var sheetData = getSheetOverview(ss);
      return responseJSON({ success: true, data: sheetData });
    }

    return responseJSON({ success: false, error: "Unknown action: " + action });
  } catch (error) {
    try {
      var ssErr = SpreadsheetApp.getActiveSpreadsheet();
      logAudit(ssErr, "ERROR", error.toString(), "FAILURE");
    } catch (e) {}
    return responseJSON({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function ensureSheetTabs(ss) {
  var requiredTabs = [
    {
      name: "Invoices",
      headers: [
        "Invoice #", "Issue Date", "Due Date", "Client Name", "KRA PIN",
        "Subtotal (Ksh)", "VAT (Ksh)", "Grand Total (Ksh)", "Paid (Ksh)", "Balance (Ksh)",
        "Status", "Drive PDF Link", "Last Updated"
      ]
    },
    {
      name: "Quotations",
      headers: [
        "Quotation #", "Issue Date", "Valid Until", "Client Name", "KRA PIN",
        "Subtotal (Ksh)", "VAT (Ksh)", "Grand Total (Ksh)", "Status", "Drive PDF Link", "Last Updated"
      ]
    },
    {
      name: "Proformas",
      headers: [
        "Proforma #", "Issue Date", "Due Date", "Client Name", "KRA PIN",
        "Subtotal (Ksh)", "VAT (Ksh)", "Grand Total (Ksh)", "Status", "Drive PDF Link", "Last Updated"
      ]
    },
    {
      name: "Clients",
      headers: [
        "Client ID", "Company / Guest Name", "Contact Person", "KRA PIN",
        "Email", "Phone", "Physical Address", "Registered Date"
      ]
    },
    {
      name: "Receipts",
      headers: [
        "Receipt #", "Date", "Client Name", "Settled Doc #", "Payment Mode",
        "Amount (Ksh)", "Reference Note", "Drive PDF Link", "Recorded At"
      ]
    },
    {
      name: "Audit_Log",
      headers: [
        "Timestamp", "Action", "Description", "Status", "User / Agent"
      ]
    }
  ];

  requiredTabs.forEach(function(tabDef) {
    var sheet = ss.getSheetByName(tabDef.name);
    if (!sheet) {
      sheet = ss.insertSheet(tabDef.name);
      sheet.appendRow(tabDef.headers);
      var headerRange = sheet.getRange(1, 1, 1, tabDef.headers.length);
      headerRange.setBackground("#18181b");
      headerRange.setFontColor("#fef08a");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  });
}

function logAudit(ss, action, description, status) {
  try {
    var sheet = ss.getSheetByName("Audit_Log");
    if (sheet) {
      sheet.appendRow([
        new Date().toISOString(),
        action,
        description,
        status,
        "Hotel Damview ERP"
      ]);
    }
  } catch (err) {}
}

function upsertDocument(ss, doc) {
  if (!doc) return null;
  var tabName = doc.documentType === "QUOTATION" ? "Quotations" : doc.documentType === "PROFORMA" ? "Proformas" : "Invoices";
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === doc.documentNumber) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowValues;
  if (doc.documentType === "INVOICE") {
    rowValues = [
      doc.documentNumber,
      doc.issueDate,
      doc.dueDate || "",
      doc.clientName,
      doc.clientKraPin || "",
      doc.subtotal,
      doc.vatAmount,
      doc.grandTotal,
      doc.amountPaid || 0,
      doc.balanceDue !== undefined ? doc.balanceDue : doc.grandTotal,
      doc.status || "Draft",
      doc.driveFileUrl || "",
      new Date().toISOString()
    ];
  } else {
    rowValues = [
      doc.documentNumber,
      doc.issueDate,
      doc.dueDate || "",
      doc.clientName,
      doc.clientKraPin || "",
      doc.subtotal,
      doc.vatAmount,
      doc.grandTotal,
      doc.status || "Draft",
      doc.driveFileUrl || "",
      new Date().toISOString()
    ];
  }

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return { documentNumber: doc.documentNumber, tab: tabName };
}

function updateDocumentDriveUrl(ss, doc, driveUrl) {
  var tabName = doc.documentType === "QUOTATION" ? "Quotations" : doc.documentType === "PROFORMA" ? "Proformas" : "Invoices";
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var driveCol = doc.documentType === "INVOICE" ? 12 : 10;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === doc.documentNumber) {
      sheet.getRange(i + 1, driveCol).setValue(driveUrl);
      break;
    }
  }
}

function recordPayment(ss, payment) {
  if (!payment) return null;
  var sheet = ss.getSheetByName("Receipts");
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === payment.receiptNumber) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowValues = [
    payment.receiptNumber,
    payment.date,
    payment.clientName,
    payment.documentNumber || "Direct Settlement",
    payment.paymentMode,
    payment.amount,
    payment.referenceNote || "",
    payment.driveFileUrl || "",
    new Date().toISOString()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  // Update Invoices sheet if invoice number matches
  if (payment.documentNumber) {
    var invSheet = ss.getSheetByName("Invoices");
    if (invSheet) {
      var invData = invSheet.getDataRange().getValues();
      for (var j = 1; j < invData.length; j++) {
        if (invData[j][0] === payment.documentNumber) {
          var currentPaid = Number(invData[j][8]) || 0;
          var total = Number(invData[j][7]) || 0;
          var newPaid = currentPaid + Number(payment.amount);
          var newBalance = Math.max(0, total - newPaid);
          var newStatus = newBalance <= 0 ? "Paid" : "Sent";
          invSheet.getRange(j + 1, 9).setValue(newPaid);
          invSheet.getRange(j + 1, 10).setValue(newBalance);
          invSheet.getRange(j + 1, 11).setValue(newStatus);
          break;
        }
      }
    }
  }

  return { receiptNumber: payment.receiptNumber };
}

function updateReceiptDriveUrl(ss, payment, driveUrl) {
  var sheet = ss.getSheetByName("Receipts");
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === payment.receiptNumber) {
      sheet.getRange(i + 1, 8).setValue(driveUrl);
      break;
    }
  }
}

function upsertClient(ss, client) {
  if (!client) return null;
  var sheet = ss.getSheetByName("Clients");
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === client.id) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowValues = [
    client.id,
    client.name,
    client.contactPerson || "",
    client.kraPin || "",
    client.email || "",
    client.phone || "",
    client.address || "",
    client.createdAt || new Date().toISOString().split("T")[0]
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return { clientId: client.id };
}

function archivePdfToDrive(doc, pdfBase64, folderName) {
  var targetFolderName = folderName || "Hotel Damview Archives";
  var folders = DriveApp.getFoldersByName(targetFolderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderName);

  var decodedBytes = Utilities.base64Decode(pdfBase64);
  var blob = Utilities.newBlob(decodedBytes, "application/pdf", doc.documentNumber + "_" + doc.clientName.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    url: file.getUrl()
  };
}

function archiveReceiptPdfToDrive(payment, pdfBase64, folderName) {
  var targetFolderName = folderName || "Hotel Damview Archives";
  var folders = DriveApp.getFoldersByName(targetFolderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderName);

  var decodedBytes = Utilities.base64Decode(pdfBase64);
  var blob = Utilities.newBlob(decodedBytes, "application/pdf", payment.receiptNumber + "_" + payment.clientName.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    url: file.getUrl()
  };
}

function cascadeDeleteDocument(ss, documentId, documentNumber, folderName) {
  var tabNames = ["Invoices", "Quotations", "Proformas"];
  for (var t = 0; t < tabNames.length; t++) {
    var sheet = ss.getSheetByName(tabNames[t]);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        if (data[r][0] === documentNumber) {
          sheet.deleteRow(r + 1);
          break;
        }
      }
    }
  }
  return { deleted: true, documentNumber: documentNumber };
}

function cascadeDeleteClient(ss, clientId) {
  var sheet = ss.getSheetByName("Clients");
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === clientId) {
        sheet.deleteRow(r + 1);
        break;
      }
    }
  }
  return { deleted: true, clientId: clientId };
}

function getSheetOverview(ss) {
  var tabs = ["Invoices", "Quotations", "Proformas", "Clients", "Receipts", "Audit_Log"];
  var summary = {};
  tabs.forEach(function(t) {
    var s = ss.getSheetByName(t);
    summary[t] = s ? Math.max(0, s.getLastRow() - 1) : 0;
  });
  return summary;
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
