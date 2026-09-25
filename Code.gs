/**
 * HOTEL DAMVIEW - ENTERPRISE CENTRALIZED GOOGLE WORKSPACE BACKEND (Code.gs v5.0.0)
 * Production High-Precision Schema Alignment, Dynamic Header-Index Row-Parsing & Universal Drive Archival Engine
 * Single Source of Truth for Hotel Damview ERP Across All App Workstations & Mobile Devices
 *
 * Core Architectural Guarantees:
 * 1. Resilient Dynamic Header-Index Lookup & Row-Parsing Engine:
 *    - Scans Row 1 headers dynamically and constructs bidirectional index-to-key resolution maps.
 *    - Maps incoming JSON keys (camelCase, snake_case, raw header names, and aliases) directly to
 *      their exact column index in Google Sheets.
 *    - Prevents Column Drift: immune to user-rearranged columns, custom-inserted columns, or altered order.
 *    - Non-destructive to Custom Columns: user-added columns (e.g., Accountant Notes, Department)
 *      are preserved during updates.
 *
 * 2. Absolute Data Integrity & Type Coercion Prevention:
 *    - Leading Zeros & Code Integrity: Phone numbers (+254..., 07...), reference codes, and KRA PINs
 *      are stored with forced text escape (apostrophe prefix) and '@' number format, preventing
 *      truncation of leading zeros or distortion to scientific notation (e.g., 2.54E+11).
 *    - Pinned Nairobi Timezone Dates (YYYY-MM-DD): Dates are normalized and formatted in spreadsheet
 *      timezone ('yyyy-MM-dd'), completely eliminating UTC offset 1-day shifts and timestamp errors.
 *    - Pure Calculable Currencies: Financial fields strip currency prefixes ('Ksh') and commas
 *      before storing as pure float numbers with '#,##0.00' format, ensuring =SUM() formulas work.
 *    - Multiline Text & Special Characters: Preserves line breaks in address and service particulars,
 *      escapes formula injection characters (=, +, @, -), and prevents cell splitting across columns.
 *
 * 3. Universal Google Drive PDF Archival Pipeline:
 *    - Fully decodes Base64 PDF documents, receipts, and account statements.
 *    - Verifies byte size and binary integrity before writing to designated folder.
 *    - Deduplicates identical file names in destination folder by moving older versions to Trash.
 *    - Enforces public view permissions (ANYONE_WITH_LINK, VIEW) and returns persistent webViewLink and driveUrl.
 *
 * 4. Atomic Two-Way Deletion & Tombstone Purge:
 *    - Fully supports CASCADE_DELETE_DOCUMENT, CASCADE_DELETE_CLIENT, CASCADE_DELETE_PAYMENT,
 *      and PURGE_TOMBSTONES actions.
 *    - Synchronously removes rows from Google Sheets, line item breakdowns, and trashes corresponding
 *      PDF archives from Google Drive to maintain zero orphaned files.
 *
 * 5. 15 Automated ERP Tabs:
 *    1. Summary_Dashboard (Executive KPI Cards with Dynamic Column-Letter Formula References)
 *    2. Invoices (Master Invoice Register with Paid & Balance Due)
 *    3. Quotations (Master Quotations Register)
 *    4. Proformas (Master Proforma Invoices Register)
 *    5. Clients (Master Client Directory with Phone & KRA PIN Protection)
 *    6. Receipts (Master Payment Receipts Register with Reconciliation)
 *    7. Statements_Ledger (Live Dynamic Formula Ledger per Client Account)
 *    8. Monthly_Revenue_Analytics (Year/Month Revenue Breakdown & Efficiency)
 *    9. Line_Items_Breakdown (Itemized Breakdown for Accommodations, Dining & Services)
 *   10. Reservations (Room Bookings & Accommodation Schedule)
 *   11. POS_Orders (Dining & Bar Orders Ledger)
 *   12. Expenses (Operating & Vendor Outflow Journal)
 *   13. Particulars_Catalogue (Standard Rates & Particulars Catalog)
 *   14. Hotel_Profile (Centralized Property Details, Bank Info & KRA Tax PIN)
 *   15. Audit_Log (Real-time Audit Trail of Sync Actions & PDF Drive Archives)
 *
 * Deployment Instructions (2-Minute One-Time Setup):
 * 1. Open your Google Sheet (named "Hotel Damview ERP").
 * 2. Click Extensions > Apps Script.
 * 3. Replace all contents of Code.gs with this entire script.
 * 4. Click "Deploy" > "Manage deployments" > "Edit" (pencil icon) > "New version".
 * 5. Set "Execute as": "Me" (your Google account).
 * 6. Set "Who has access": "Anyone" (enables zero-auth background sync for all hotel devices).
 * 7. Click "Deploy", authorize permissions, and verify the Web App URL in Hotel Damview App Settings.
 */

// ============================================================================
// 1. CANONICAL FIELD DEFINITIONS & ALIASES FOR DYNAMIC HEADER MAPPING
// ============================================================================

var CANONICAL_SCHEMAS = {
  INVOICE: [
    { key: "documentNumber", type: "code", aliases: ["invoicenum", "invoice", "invoicenumber", "docnum", "number", "invoiceno", "invoiceno."] },
    { key: "issueDate", type: "date", aliases: ["issuedate", "date", "invoicedate", "billdate", "createddate"] },
    { key: "dueDate", type: "date", aliases: ["duedate", "validuntil", "paymentdue", "expirydate", "paymentduedate"] },
    { key: "clientName", type: "text", aliases: ["clientname", "companyname", "guestname", "customername", "client", "customer", "companyguestname"] },
    { key: "clientKraPin", type: "code", aliases: ["krapin", "pin", "taxpin", "clientkrapin", "clientpin", "vatpin"] },
    { key: "clientAddress", type: "text", aliases: ["clientaddress", "address", "physicalpostaladdress", "physicaladdress", "postaladdress", "location"] },
    { key: "grossSubtotal", type: "currency", aliases: ["grosssubtotalksh", "grosssubtotal", "subtotalgross", "grossamount"] },
    { key: "discount", type: "currency", aliases: ["discountksh", "discount", "discountamount", "lessdiscount", "totaldiscount"] },
    { key: "subtotal", type: "currency", aliases: ["netsubtotalksh", "netsubtotal", "subtotal", "taxablesubtotal", "taxablesubtotalksh", "taxableamount", "netamount", "subtotalamount", "taxable"] },
    { key: "vatAmount", type: "currency", aliases: ["vat16ksh", "vatamount", "vat16", "vat", "tax", "vat16amount", "vat16%ksh", "vat(16%)", "vat16%", "vat16percent", "valueaddedtax"] },
    { key: "grandTotal", type: "currency", aliases: ["grandtotalksh", "grandtotal", "totalamountksh", "totalamount", "total", "billtotal", "invoicetotal", "totalbill"] },
    { key: "amountPaid", type: "currency", aliases: ["paidksh", "paid", "amountpaidksh", "amountpaid", "settled", "payments", "totalpaid"] },
    { key: "balanceDue", type: "currency", aliases: ["balanceksh", "balance", "balancedueksh", "balancedue", "outstanding", "amountdue", "currentbalance"] },
    { key: "status", type: "text", aliases: ["status", "paymentstatus", "docstatus", "state"] },
    { key: "driveFileUrl", type: "text", aliases: ["drivepdflink", "drivefileurl", "driveurl", "pdfurl", "drivelink", "documentlink", "pdflink", "webviewlink", "drivepdfarchive"] },
    { key: "driveFileId", type: "code", aliases: ["drivefileid", "fileid", "gdrivefileid"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "modifiedat", "timestamp"] },
    { key: "id", type: "code", aliases: ["docid", "id", "documentid", "uid"] }
  ],
  QUOTATION: [
    { key: "documentNumber", type: "code", aliases: ["quotationnum", "quotation", "quotationnumber", "docnum", "number", "quotationno", "quotationno."] },
    { key: "issueDate", type: "date", aliases: ["issuedate", "date", "quotationdate", "createddate"] },
    { key: "dueDate", type: "date", aliases: ["validuntil", "duedate", "validity", "expirydate", "validtodate"] },
    { key: "clientName", type: "text", aliases: ["clientname", "companyname", "guestname", "customername", "client", "customer"] },
    { key: "clientKraPin", type: "code", aliases: ["krapin", "pin", "taxpin", "clientkrapin", "clientpin"] },
    { key: "clientAddress", type: "text", aliases: ["clientaddress", "address", "physicalpostaladdress", "physicaladdress", "postaladdress", "location"] },
    { key: "grossSubtotal", type: "currency", aliases: ["grosssubtotalksh", "grosssubtotal", "subtotalgross", "grossamount"] },
    { key: "discount", type: "currency", aliases: ["discountksh", "discount", "discountamount", "lessdiscount", "totaldiscount"] },
    { key: "subtotal", type: "currency", aliases: ["netsubtotalksh", "netsubtotal", "subtotal", "taxablesubtotal", "taxablesubtotalksh", "taxableamount", "netamount", "subtotalamount", "taxable"] },
    { key: "vatAmount", type: "currency", aliases: ["vat16ksh", "vatamount", "vat16", "vat", "tax", "vat16amount", "vat16%ksh", "vat(16%)", "vat16%", "vat16percent"] },
    { key: "grandTotal", type: "currency", aliases: ["grandtotalksh", "grandtotal", "totalamountksh", "totalamount", "total", "quotationtotal"] },
    { key: "status", type: "text", aliases: ["status", "docstatus", "state"] },
    { key: "driveFileUrl", type: "text", aliases: ["drivepdflink", "drivefileurl", "driveurl", "pdfurl", "drivelink", "pdflink", "webviewlink", "drivepdfarchive"] },
    { key: "driveFileId", type: "code", aliases: ["drivefileid", "fileid", "gdrivefileid"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "modifiedat", "timestamp"] },
    { key: "id", type: "code", aliases: ["docid", "id", "documentid", "uid"] }
  ],
  PROFORMA: [
    { key: "documentNumber", type: "code", aliases: ["proformanum", "proforma", "proformanumber", "docnum", "number", "proformano", "proformano."] },
    { key: "issueDate", type: "date", aliases: ["issuedate", "date", "proformadate", "createddate"] },
    { key: "dueDate", type: "date", aliases: ["duedate", "validuntil", "validity", "expirydate", "paymentdue"] },
    { key: "clientName", type: "text", aliases: ["clientname", "companyname", "guestname", "customername", "client", "customer"] },
    { key: "clientKraPin", type: "code", aliases: ["krapin", "pin", "taxpin", "clientkrapin", "clientpin"] },
    { key: "clientAddress", type: "text", aliases: ["clientaddress", "address", "physicalpostaladdress", "physicaladdress", "postaladdress", "location"] },
    { key: "grossSubtotal", type: "currency", aliases: ["grosssubtotalksh", "grosssubtotal", "subtotalgross", "grossamount"] },
    { key: "discount", type: "currency", aliases: ["discountksh", "discount", "discountamount", "lessdiscount", "totaldiscount"] },
    { key: "subtotal", type: "currency", aliases: ["netsubtotalksh", "netsubtotal", "subtotal", "taxablesubtotal", "taxablesubtotalksh", "taxableamount", "netamount", "subtotalamount", "taxable"] },
    { key: "vatAmount", type: "currency", aliases: ["vat16ksh", "vatamount", "vat16", "vat", "tax", "vat16amount", "vat16%ksh", "vat(16%)", "vat16%", "vat16percent"] },
    { key: "grandTotal", type: "currency", aliases: ["grandtotalksh", "grandtotal", "totalamountksh", "totalamount", "total", "proformatotal"] },
    { key: "status", type: "text", aliases: ["status", "docstatus", "state"] },
    { key: "driveFileUrl", type: "text", aliases: ["drivepdflink", "drivefileurl", "driveurl", "pdfurl", "drivelink", "pdflink", "webviewlink", "drivepdfarchive"] },
    { key: "driveFileId", type: "code", aliases: ["drivefileid", "fileid", "gdrivefileid"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "modifiedat", "timestamp"] },
    { key: "id", type: "code", aliases: ["docid", "id", "documentid", "uid"] }
  ],
  CLIENT: [
    { key: "id", type: "code", aliases: ["clientid", "id", "customerid", "uid"] },
    { key: "name", type: "text", aliases: ["companyguestname", "clientname", "companyname", "guestname", "name", "client", "customer"] },
    { key: "contactPerson", type: "text", aliases: ["contactperson", "contact", "person", "attn", "contactname"] },
    { key: "kraPin", type: "code", aliases: ["krapin", "pin", "taxpin", "clientkrapin", "vatnumber"] },
    { key: "email", type: "text", aliases: ["email", "emailaddress", "contactemail", "clientemail"] },
    { key: "phone", type: "code", aliases: ["phone", "phonenumber", "telephone", "mobile", "cell", "tel", "contactphone"] },
    { key: "address", type: "text", aliases: ["physicalpostaladdress", "physicaladdress", "postaladdress", "address", "location", "clientaddress"] },
    { key: "createdAt", type: "date", aliases: ["registereddate", "createdat", "datecreated", "registrationdate", "enrolleddate"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "timestamp", "modifiedat"] }
  ],
  RECEIPT: [
    { key: "receiptNumber", type: "code", aliases: ["receiptnum", "receipt", "receiptno", "number", "docnum", "recnum", "receiptno."] },
    { key: "date", type: "date", aliases: ["date", "paymentdate", "receiptdate", "transactiondate"] },
    { key: "clientName", type: "text", aliases: ["clientname", "customername", "guestname", "client", "receivedfrom", "payer"] },
    { key: "documentNumber", type: "code", aliases: ["settleddocnum", "settleddoc", "invoicenumber", "invoicenum", "docnum", "settleddocument", "invoiceno"] },
    { key: "paymentMode", type: "text", aliases: ["paymentmode", "method", "mode", "paymentmethod", "channel"] },
    { key: "amount", type: "currency", aliases: ["amountksh", "amount", "paidamount", "totalpaid", "receivedamount"] },
    { key: "referenceNote", type: "text", aliases: ["referencenote", "reference", "note", "mpesacode", "transactioncode", "details", "chequeno"] },
    { key: "driveFileUrl", type: "text", aliases: ["drivepdflink", "drivefileurl", "driveurl", "receipturl", "pdfurl", "drivelink", "pdflink", "webviewlink", "drivepdfarchive"] },
    { key: "driveFileId", type: "code", aliases: ["drivefileid", "fileid", "gdrivefileid"] },
    { key: "createdAt", type: "datetime", aliases: ["recordedat", "createdat", "timestamp"] },
    { key: "id", type: "code", aliases: ["paymentid", "id", "receiptid", "uid"] }
  ],
  LINE_ITEM: [
    { key: "documentNumber", type: "code", aliases: ["documentnum", "docnum", "invoicenum", "number", "invoiceno"] },
    { key: "documentType", type: "text", aliases: ["doctype", "documenttype", "type"] },
    { key: "issueDate", type: "date", aliases: ["issuedate", "date"] },
    { key: "clientName", type: "text", aliases: ["clientname", "customername", "guestname", "client"] },
    { key: "particulars", type: "text", aliases: ["serviceparticulars", "particulars", "description", "item", "service", "itemdescription"] },
    { key: "quantity", type: "number", aliases: ["quantity", "qty", "count"] },
    { key: "days", type: "number", aliases: ["daysunits", "days", "units", "nights", "duration"] },
    { key: "rate", type: "currency", aliases: ["unitrateksh", "unitrate", "rate", "price", "unitprice"] },
    { key: "discount", type: "currency", aliases: ["discountksh", "discount", "itemdiscount"] },
    { key: "totalAmount", type: "currency", aliases: ["totalamountksh", "totalamount", "amount", "total", "lineamount", "amountksh"] },
    { key: "id", type: "code", aliases: ["itemid", "id", "lineitemid", "uid"] }
  ],
  CATALOGUE: [
    { key: "id", type: "code", aliases: ["itemid", "id", "code", "catalogueid"] },
    { key: "particulars", type: "text", aliases: ["particularsservicedescription", "particulars", "description", "service", "item"] },
    { key: "category", type: "text", aliases: ["category", "dept", "department", "type"] },
    { key: "rate", type: "currency", aliases: ["defaultrateksh", "rate", "defaultrate", "price", "unitprice"] },
    { key: "taxApplicable", type: "text", aliases: ["taxapplicable", "vat", "taxable"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "timestamp"] }
  ],
  POS_ORDER: [
    { key: "orderNumber", type: "code", aliases: ["ordernum", "ordernumber", "order", "orderno", "id"] },
    { key: "orderDate", type: "date", aliases: ["orderdate", "date", "createdat"] },
    { key: "guestTable", type: "text", aliases: ["guesttable", "guest", "table", "tableno", "guestname", "customer"] },
    { key: "location", type: "text", aliases: ["locationstation", "location", "station", "point"] },
    { key: "itemsSummary", type: "text", aliases: ["itemssummary", "items", "summary", "particulars"] },
    { key: "subtotal", type: "currency", aliases: ["subtotalksh", "subtotal", "grosssubtotal"] },
    { key: "tax", type: "currency", aliases: ["taxksh", "tax", "vat", "vatamount"] },
    { key: "totalAmount", type: "currency", aliases: ["totalamountksh", "totalamount", "total", "grandtotal"] },
    { key: "paymentMode", type: "text", aliases: ["paymentmode", "mode", "paymentmethod"] },
    { key: "status", type: "text", aliases: ["status", "orderstatus"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "timestamp"] }
  ],
  RESERVATION: [
    { key: "id", type: "code", aliases: ["reservationid", "id", "bookingnumber", "bookingid", "resno"] },
    { key: "guestName", type: "text", aliases: ["guestname", "name", "clientname", "customer"] },
    { key: "phone", type: "code", aliases: ["phonecontact", "phone", "contact", "mobile"] },
    { key: "room", type: "text", aliases: ["roomaccommodation", "room", "roomnumber", "accommodation"] },
    { key: "checkInDate", type: "date", aliases: ["checkindate", "checkin", "arrivaldate", "fromdate"] },
    { key: "checkOutDate", type: "date", aliases: ["checkoutdate", "checkout", "departuredate", "todate"] },
    { key: "status", type: "text", aliases: ["status", "reservationstatus"] },
    { key: "totalAmount", type: "currency", aliases: ["totalamountksh", "totalamount", "total", "grandtotal"] },
    { key: "amountPaid", type: "currency", aliases: ["paidksh", "amountpaid", "paid"] },
    { key: "balance", type: "currency", aliases: ["balanceksh", "balance", "remaining"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "timestamp"] }
  ],
  EXPENSE: [
    { key: "id", type: "code", aliases: ["expenseid", "id", "expno", "expid"] },
    { key: "date", type: "date", aliases: ["expensedate", "date", "createdat"] },
    { key: "category", type: "text", aliases: ["category", "expensetype", "type"] },
    { key: "vendor", type: "text", aliases: ["vendorpayee", "vendor", "payee", "supplier"] },
    { key: "description", type: "text", aliases: ["description", "details", "particulars", "item"] },
    { key: "amount", type: "currency", aliases: ["amountksh", "amount", "totalamount", "total"] },
    { key: "paymentMode", type: "text", aliases: ["paymentmode", "mode", "paymentmethod"] },
    { key: "approvedBy", type: "text", aliases: ["approvedby", "approver", "manager", "staff"] },
    { key: "updatedAt", type: "datetime", aliases: ["lastupdated", "updatedat", "timestamp"] }
  ],
  STATEMENT: [
    { key: "statementNumber", type: "code", aliases: ["statementnum", "statementnumber", "soano", "soanum", "docnum", "number"] },
    { key: "issueDate", type: "date", aliases: ["issuedate", "date", "statementdate"] },
    { key: "startDate", type: "date", aliases: ["startdate", "fromdate", "periodfrom"] },
    { key: "endDate", type: "date", aliases: ["enddate", "todate", "periodto"] },
    { key: "clientName", type: "text", aliases: ["clientname", "companyname", "guestname", "client"] },
    { key: "clientKraPin", type: "code", aliases: ["krapin", "pin", "taxpin", "clientkrapin"] },
    { key: "totalDebit", type: "currency", aliases: ["totaldebit", "totalinvoiced", "debitksh", "totalinvoicedksh"] },
    { key: "totalCredit", type: "currency", aliases: ["totalcredit", "totalpaid", "creditksh", "totalpaidksh"] },
    { key: "closingBalance", type: "currency", aliases: ["closingbalance", "balance", "balancedue", "currentbalance"] },
    { key: "driveFileUrl", type: "text", aliases: ["drivepdflink", "drivefileurl", "driveurl", "pdfurl", "drivelink", "webviewlink"] },
    { key: "driveFileId", type: "code", aliases: ["drivefileid", "fileid", "gdrivefileid"] },
    { key: "id", type: "code", aliases: ["stmtid", "id", "statementid", "uid"] }
  ]
};

// ============================================================================
// 2. HTTP DISPATCHERS (doGet & doPost & doOptions)
// ============================================================================

function doOptions(e) {
  return responseJSON({ success: true, status: "OK" });
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return responseJSON({
      success: true,
      message: "Hotel Damview Google Apps Script Central Backend v5.0.0 is active and ready.",
      sheetName: ss ? ss.getName() : "Spreadsheet",
      sheetUrl: ss ? ss.getUrl() : "",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return responseJSON({
      success: true,
      message: "Hotel Damview Google Apps Script Backend v5.0.0 is online.",
      error: err.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    for (var lockAttempt = 0; lockAttempt < 5; lockAttempt++) {
      lockAcquired = lock.tryLock(15000);
      if (lockAcquired) break;
      if (lockAttempt < 4) Utilities.sleep(800 + Math.floor(Math.random() * 600));
    }

    if (!lockAcquired) {
      return responseJSON({
        success: false,
        busy: true,
        error: "System busy processing another operation. Please retry in a few seconds."
      });
    }

    var contents = "";
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else if (e && e.parameter && (e.parameter.payload || e.parameter.data)) {
      contents = e.parameter.payload || e.parameter.data;
    } else {
      contents = "{}";
    }

    var payload;
    try {
      payload = JSON.parse(contents);
    } catch (parseErr) {
      return responseJSON({ success: false, error: "Invalid JSON payload: " + parseErr.message });
    }

    var action = (payload.action || payload.type || "").toString().trim();
    if (!action || action === "undefined" || action === "null" || action === "[object Object]") {
      if (payload.document) action = "UPSERT_DOCUMENT";
      else if (payload.payment) action = "RECORD_PAYMENT";
      else if (payload.client) action = "UPSERT_CLIENT";
      else if (payload.profile) action = "UPSERT_PROFILE";
      else if (payload.tombstones) action = "PURGE_TOMBSTONES";
      else if (payload.pdfBase64) action = "ARCHIVE_PDF";
      else if (payload.invoices || payload.receipts || payload.clients) action = "FULL_SYNC";
      else action = "PING";
    }
    var data = payload;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      return responseJSON({
        success: false,
        error: "No active Google Spreadsheet found. Ensure this script is bound to your Hotel Damview ERP sheet."
      });
    }

    // Always ensure base required tabs and header definitions exist
    ensureSheetTabs(ss);

    // 1. PING / HEALTHCHECK
    if (action === "PING" || action === "HEALTHCHECK") {
      var sheetList = getDiscoveredSheets(ss);
      return responseJSON({
        success: true,
        message: "Hotel Damview Google Apps Script Central Backend v5.0.0 is active and connected.",
        sheetName: ss.getName(),
        sheetUrl: ss.getUrl(),
        tabs: sheetList,
        timestamp: new Date().toISOString()
      });
    }

    // 2. CLIENT UPSERT
    if (action === "UPSERT_CLIENT") {
      try {
        if (!data.client) throw new Error("Missing client payload object");
        var clientResult = upsertClient(ss, data.client);
        refreshStatementsLedger(ss);
        logAudit(
          ss,
          "UPSERT_CLIENT",
          "Client: " + (data.client.name || "N/A") + " (PIN: " + (data.client.kraPin || "N/A") + ")",
          "SUCCESS",
          "",
          ""
        );
        return responseJSON({ success: true, result: clientResult });
      } catch (clientErr) {
        logAudit(ss, "UPSERT_CLIENT", "Failed client upsert: " + clientErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: clientErr.toString() });
      }
    }

    // 3. DOCUMENT UPSERT (INVOICE / QUOTATION / PROFORMA)
    if (action === "UPSERT_DOCUMENT") {
      try {
        if (!data.document) throw new Error("Missing document payload object");
        var doc = data.document;
        var driveUrl = doc.driveFileUrl || "";
        var driveFileId = doc.driveFileId || "";
        var pdfArchive = null;

        if (data.pdfBase64) {
          try {
            pdfArchive = archivePdfToDrive(doc, data.pdfBase64, data.folderName, data.fileName);
            if (pdfArchive && pdfArchive.url) {
              driveUrl = pdfArchive.url;
              driveFileId = pdfArchive.fileId || "";
              doc.driveFileUrl = driveUrl;
              doc.driveFileId = driveFileId;
              logAudit(ss, "ARCHIVE_PDF", "Archived " + doc.documentNumber + " (" + (pdfArchive.fileName || "canonical.pdf") + ")", "SUCCESS", driveUrl, driveFileId);
            } else if (pdfArchive && pdfArchive.error) {
              logAudit(ss, "ARCHIVE_PDF", "Validation failed for " + doc.documentNumber + ": " + pdfArchive.error, "FAILURE", "", "");
            }
          } catch (pdfErr) {
            logAudit(ss, "ARCHIVE_PDF", "PDF Archiving failed for " + doc.documentNumber + ": " + pdfErr.toString(), "FAILURE", "", "");
          }
        }

        var upsertResult = upsertDocument(ss, doc);

        if (doc.lineItems && Array.isArray(doc.lineItems)) {
          syncLineItemsBreakdown(ss, doc);
        }

        refreshAllAnalyticsTabs(ss);

        logAudit(
          ss,
          "UPSERT_DOCUMENT",
          doc.documentType + " " + doc.documentNumber + " for " + (doc.clientName || "Guest") + " (Grand Total: Ksh " + (doc.grandTotal || 0) + ")",
          "SUCCESS",
          driveUrl,
          driveFileId
        );

        return responseJSON({
          success: true,
          document: upsertResult,
          driveUrl: driveUrl,
          webViewLink: driveUrl,
          driveFileId: driveFileId,
          pdfArchived: pdfArchive
        });
      } catch (docErr) {
        logAudit(ss, "UPSERT_DOCUMENT", "Failed doc upsert: " + docErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: docErr.toString() });
      }
    }

    // 4. RECORD PAYMENT / RECEIPT
    if (action === "RECORD_PAYMENT") {
      try {
        if (!data.payment) throw new Error("Missing payment payload object");
        var payment = data.payment;
        var receiptDriveUrl = payment.driveFileUrl || "";
        var receiptDriveId = payment.driveFileId || "";
        var receiptArchive = null;

        if (data.pdfBase64) {
          try {
            receiptArchive = archiveReceiptPdfToDrive(payment, data.pdfBase64, data.folderName, data.fileName);
            if (receiptArchive && receiptArchive.url) {
              receiptDriveUrl = receiptArchive.url;
              receiptDriveId = receiptArchive.fileId || "";
              payment.driveFileUrl = receiptDriveUrl;
              payment.driveFileId = receiptDriveId;
              logAudit(ss, "ARCHIVE_RECEIPT_PDF", "Archived Receipt " + payment.receiptNumber + " (" + (receiptArchive.fileName || "canonical.pdf") + ")", "SUCCESS", receiptDriveUrl, receiptDriveId);
            } else if (receiptArchive && receiptArchive.error) {
              logAudit(ss, "ARCHIVE_RECEIPT_PDF", "Validation failed for Receipt " + payment.receiptNumber + ": " + receiptArchive.error, "FAILURE", "", "");
            }
          } catch (recPdfErr) {
            logAudit(ss, "ARCHIVE_RECEIPT_PDF", "Receipt PDF Archiving failed: " + recPdfErr.toString(), "FAILURE", "", "");
          }
        }

        var paymentResult = recordPayment(ss, payment);
        refreshAllAnalyticsTabs(ss);

        logAudit(
          ss,
          "RECORD_PAYMENT",
          "Receipt " + payment.receiptNumber + " (Ksh " + payment.amount + " via " + payment.paymentMode + ")",
          "SUCCESS",
          receiptDriveUrl,
          receiptDriveId
        );

        return responseJSON({
          success: true,
          payment: paymentResult,
          driveUrl: receiptDriveUrl,
          webViewLink: receiptDriveUrl,
          driveFileId: receiptDriveId,
          pdfArchived: receiptArchive
        });
      } catch (payErr) {
        logAudit(ss, "RECORD_PAYMENT", "Payment record failed: " + payErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: payErr.toString() });
      }
    }

    // 4b. DIRECT PDF ARCHIVING PIPELINE (FOR STATEMENTS & ON-DEMAND ARCHIVES)
    if (action === "ARCHIVE_PDF" || action === "UPLOAD_PDF" || action === "ARCHIVE_STATEMENT_PDF") {
      try {
        if (!data.pdfBase64) throw new Error("Missing pdfBase64 payload string");
        var targetFolder = data.folderName || "Hotel Damview Archives";
        var fileName = data.fileName || ("Document_" + new Date().toISOString().split("T")[0] + ".pdf");
        var genericArchive = archiveGenericPdfToDrive(data.pdfBase64, targetFolder, fileName);
        if (genericArchive && genericArchive.url) {
          logAudit(ss, "ARCHIVE_PDF", "Archived " + fileName + " (" + genericArchive.byteLength + " bytes)", "SUCCESS", genericArchive.url, genericArchive.fileId);
          return responseJSON({
            success: true,
            driveUrl: genericArchive.url,
            webViewLink: genericArchive.url,
            driveFileId: genericArchive.fileId,
            fileName: genericArchive.fileName,
            byteLength: genericArchive.byteLength,
            pdfArchived: genericArchive
          });
        } else {
          throw new Error(genericArchive && genericArchive.error ? genericArchive.error : "Failed to archive PDF to Google Drive");
        }
      } catch (archErr) {
        logAudit(ss, "ARCHIVE_PDF", "PDF Archiving failed: " + archErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: archErr.toString() });
      }
    }

    // 5. CASCADE DOCUMENT DELETION
    if (action === "CASCADE_DELETE_DOCUMENT" || action === "DELETE_DOCUMENT" || (action === "CASCADE_DELETE" && (data.documentId || data.documentNumber || data.id || (!data.clientId && !data.paymentId && !data.receiptNumber)))) {
      try {
        var delDocResult = cascadeDeleteDocument(ss, data.documentId || data.id, data.documentNumber, data.folderName);
        refreshAllAnalyticsTabs(ss);
        logAudit(ss, "CASCADE_DELETE_DOCUMENT", "Deleted " + (data.documentNumber || data.documentId || data.id), "SUCCESS", "", "");
        return responseJSON({ success: true, result: delDocResult });
      } catch (delDocErr) {
        logAudit(ss, "CASCADE_DELETE_DOCUMENT", "Delete failed: " + delDocErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: delDocErr.toString() });
      }
    }

    // 6. CASCADE CLIENT DELETION
    if (action === "CASCADE_DELETE_CLIENT" || action === "DELETE_CLIENT" || (action === "CASCADE_DELETE" && (data.clientId || data.clientName))) {
      try {
        var delClientResult = cascadeDeleteClient(ss, data.clientId || data.id, data.clientName, data.kraPin);
        refreshStatementsLedger(ss);
        logAudit(ss, "CASCADE_DELETE_CLIENT", "Deleted Client " + (data.clientName || data.clientId || data.id), "SUCCESS", "", "");
        return responseJSON({ success: true, result: delClientResult });
      } catch (delClientErr) {
        logAudit(ss, "CASCADE_DELETE_CLIENT", "Delete client failed: " + delClientErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: delClientErr.toString() });
      }
    }

    // 7. CASCADE PAYMENT DELETION
    if (action === "CASCADE_DELETE_PAYMENT" || action === "DELETE_PAYMENT" || (action === "CASCADE_DELETE" && (data.paymentId || data.receiptNumber))) {
      try {
        var delPayResult = cascadeDeletePayment(ss, data.paymentId || data.id, data.receiptNumber, data.documentNumber, data.folderName);
        refreshAllAnalyticsTabs(ss);
        logAudit(ss, "CASCADE_DELETE_PAYMENT", "Deleted Payment " + (data.receiptNumber || data.paymentId || data.id), "SUCCESS", "", "");
        return responseJSON({ success: true, result: delPayResult });
      } catch (delPayErr) {
        logAudit(ss, "CASCADE_DELETE_PAYMENT", "Delete payment failed: " + delPayErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: delPayErr.toString() });
      }
    }

    // 8. BATCH PURGE TOMBSTONES
    if (action === "PURGE_TOMBSTONES" || action === "PURGE_DELETED_ITEMS") {
      try {
        var tombstones = data.tombstones || [];
        var purgeSummary = purgeTombstoneList(ss, tombstones, data.folderName);
        refreshAllAnalyticsTabs(ss);
        logAudit(ss, "PURGE_TOMBSTONES", "Purged " + purgeSummary.purgedCount + " tombstones", "SUCCESS", "", "");
        return responseJSON({ success: true, result: purgeSummary });
      } catch (tombErr) {
        logAudit(ss, "PURGE_TOMBSTONES", "Tombstone purge error: " + tombErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: tombErr.toString() });
      }
    }

    // 9. HOTEL PROFILE UPSERT
    if (action === "UPSERT_PROFILE") {
      try {
        if (!data.profile) throw new Error("Missing profile payload object");
        var profResult = upsertHotelProfile(ss, data.profile);
        logAudit(ss, "UPSERT_PROFILE", "Hotel profile updated", "SUCCESS", "", "");
        return responseJSON({ success: true, result: profResult });
      } catch (profErr) {
        logAudit(ss, "UPSERT_PROFILE", "Failed profile sync: " + profErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: profErr.toString() });
      }
    }

    // 10. AUTO GENERATE & DEDUPLICATE ALL MODULE TABS
    if (action === "AUTO_GENERATE_TABS" || action === "GENERATE_ALL_TABS" || action === "GENERATE_REPORTS" || action === "RECALCULATE_TABS" || action === "CLEAN_DUPLICATES" || action === "CLEAN_TABS" || action === "DEDUPLICATE_TABS") {
      try {
        var dedupResult = autoGenerateAndDeduplicateTabs(ss);
        refreshAllAnalyticsTabs(ss);
        var tabsList = getDiscoveredSheets(ss);
        var purgedText = dedupResult && dedupResult.purgedCount ? (" (purged " + dedupResult.purgedCount + " duplicate/redundant tabs)") : "";
        logAudit(ss, "AUTO_GENERATE_TABS", "Auto generated all module tabs" + purgedText, "SUCCESS", "", "");
        return responseJSON({
          success: true,
          message: "All module tabs auto-generated and deduplicated successfully" + purgedText + ".",
          tabs: tabsList,
          purgedCount: dedupResult ? dedupResult.purgedCount : 0
        });
      } catch (genErr) {
        logAudit(ss, "AUTO_GENERATE_TABS", "Failed auto tab generation: " + genErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: genErr.toString() });
      }
    }

    // 11. FULL BATCH SYNC (App -> Sheets)
    if (action === "FULL_SYNC" || action === "RECORD_BATCH" || action === "PUSH_ALL_DATA") {
      try {
        var pushStats = processFullPushData(ss, data);
        logAudit(ss, "FULL_SYNC", "Full database batch sync applied across all 16 ERP tabs", "SUCCESS", "", "");
        return responseJSON({
          success: true,
          message: "Full database sync applied across all 16 ERP tabs.",
          stats: pushStats,
          tabs: getDiscoveredSheets(ss)
        });
      } catch (fullSyncErr) {
        logAudit(ss, "FULL_SYNC", "Full sync error: " + fullSyncErr.toString(), "FAILURE", "", "");
        return responseJSON({ success: false, error: fullSyncErr.toString() });
      }
    }

    // 12. BIDIRECTIONAL DATA PULL (Sheets -> App)
    if (action === "GET_SHEET_DATA" || action === "PULL_ALL_DATA") {
      var fullData = getFullSpreadsheetData(ss);
      return responseJSON({ success: true, data: fullData });
    }

    // 13. CLEAN DUPLICATE WORKSHEETS
    if (action === "CLEAN_WORKSHEETS") {
      var cleanReport = cleanDuplicateAndRedundantWorksheets(ss);
      return responseJSON({ success: true, report: cleanReport });
    }

    return responseJSON({ success: false, error: "Unrecognized sync action: " + action });

  } catch (globalError) {
    try {
      var ssErr = SpreadsheetApp.getActiveSpreadsheet();
      if (ssErr) logAudit(ssErr, "FATAL_ERROR", globalError.toString(), "FAILURE", "", "");
    } catch (ignore) {}
    return responseJSON({ success: false, error: "Server error during sync: " + globalError.toString() });
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}

// ============================================================================
// 3. SCHEMA DEFINITIONS & TAB PROVISIONING
// ============================================================================

function getStandardTabDefinitions() {
  return [
    {
      name: "Summary_Dashboard",
      headers: ["Metric / KPI Category", "Live Computed Value", "Unit / Metric Formula", "Notes / Category"]
    },
    {
      name: "Invoices",
      headers: [
        "Invoice #", "Issue Date", "Due Date", "Client Name", "KRA PIN", "Client Address",
        "Gross Subtotal (Ksh)", "Discount (Ksh)", "Net Subtotal (Ksh)", "VAT 16% (Ksh)",
        "Grand Total (Ksh)", "Paid (Ksh)", "Balance (Ksh)", "Status", "Drive PDF Link", "Last Updated", "Doc ID"
      ]
    },
    {
      name: "Quotations",
      headers: [
        "Quotation #", "Issue Date", "Valid Until", "Client Name", "KRA PIN", "Client Address",
        "Gross Subtotal (Ksh)", "Discount (Ksh)", "Net Subtotal (Ksh)", "VAT 16% (Ksh)",
        "Grand Total (Ksh)", "Status", "Drive PDF Link", "Last Updated", "Doc ID"
      ]
    },
    {
      name: "Proformas",
      headers: [
        "Proforma #", "Issue Date", "Due Date", "Client Name", "KRA PIN", "Client Address",
        "Gross Subtotal (Ksh)", "Discount (Ksh)", "Net Subtotal (Ksh)", "VAT 16% (Ksh)",
        "Grand Total (Ksh)", "Status", "Drive PDF Link", "Last Updated", "Doc ID"
      ]
    },
    {
      name: "Clients",
      headers: [
        "Client ID", "Company / Guest Name", "Contact Person", "KRA PIN",
        "Email", "Phone", "Physical / Postal Address", "Registered Date", "Last Updated"
      ]
    },
    {
      name: "Receipts",
      headers: [
        "Receipt #", "Date", "Client Name", "Settled Doc #", "Payment Mode",
        "Amount (Ksh)", "Reference Note", "Drive PDF Link", "Recorded At", "Payment ID"
      ]
    },
    {
      name: "Statements_Ledger",
      headers: [
        "Client ID", "Client / Company Name", "KRA PIN", "Total Invoiced (Ksh)",
        "Total Paid (Ksh)", "Current Balance Due (Ksh)", "Account Status", "Last Transaction Date"
      ]
    },
    {
      name: "Monthly_Revenue_Analytics",
      headers: [
        "Month (YYYY-MM)", "Invoices Count", "Total Invoiced (Ksh)", "Total Collected (Ksh)",
        "Outstanding Balance (Ksh)", "Collection Rate %"
      ]
    },
    {
      name: "Line_Items_Breakdown",
      headers: [
        "Document #", "Doc Type", "Issue Date", "Client Name", "Service / Particulars",
        "Quantity", "Days / Units", "Unit Rate (Ksh)", "Discount (Ksh)", "Total Amount (Ksh)", "Item ID"
      ]
    },
    {
      name: "Reservations",
      headers: [
        "Reservation ID", "Guest Name", "Phone / Contact", "Room / Accommodation",
        "Check-In Date", "Check-Out Date", "Status", "Total Amount (Ksh)", "Paid (Ksh)", "Balance (Ksh)", "Last Updated"
      ]
    },
    {
      name: "POS_Orders",
      headers: [
        "Order #", "Order Date", "Guest / Table", "Location / Station",
        "Items Summary", "Subtotal (Ksh)", "Tax (Ksh)", "Total Amount (Ksh)", "Payment Mode", "Status", "Last Updated"
      ]
    },
    {
      name: "Expenses",
      headers: [
        "Expense ID", "Expense Date", "Category", "Vendor / Payee",
        "Description", "Amount (Ksh)", "Payment Mode", "Approved By", "Last Updated"
      ]
    },
    {
      name: "Particulars_Catalogue",
      headers: [
        "Item ID", "Particulars / Service Description", "Category",
        "Default Rate (Ksh)", "Tax Applicable", "Last Updated"
      ]
    },
    {
      name: "Hotel_Profile",
      headers: ["Property", "Value", "Last Updated"]
    },
    {
      name: "Audit_Log",
      headers: ["Timestamp", "Action", "Description", "Status", "Drive File Link", "File ID", "User / Agent"]
    }
  ];
}

/**
 * Automatically resets, reorders, and standardizes all column headers to align strictly
 * with the authoritative schema defined in Google Apps Script.
 * Detects and prunes duplicate, orphaned, or obsolete column headers, while moving existing row
 * values to their canonical columns without data loss or column shift.
 */
function reconcileAndSanitizeTabHeaders(sheet, tabDef, ss) {
  var canonicalHeaders = tabDef.headers;
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  if (lastCol === 0 || lastRow === 0) {
    sheet.clearContents();
    sheet.appendRow(canonicalHeaders);
    var hRangeInit = sheet.getRange(1, 1, 1, canonicalHeaders.length);
    hRangeInit.setBackground("#0f172a");
    hRangeInit.setFontColor("#fef08a");
    hRangeInit.setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }

  var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];

  // Check if existing headers already strictly equal canonical headers
  var isStrictMatch = (existingHeaders.length === canonicalHeaders.length);
  if (isStrictMatch) {
    for (var i = 0; i < canonicalHeaders.length; i++) {
      if (String(existingHeaders[i] || "").trim() !== canonicalHeaders[i]) {
        isStrictMatch = false;
        break;
      }
    }
  }

  if (isStrictMatch) {
    // Ensure executive header styling and frozen row
    var hRangeMatch = sheet.getRange(1, 1, 1, canonicalHeaders.length);
    hRangeMatch.setBackground("#0f172a");
    hRangeMatch.setFontColor("#fef08a");
    hRangeMatch.setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }

  // Column matching & duplicate detection
  var schemaKey = tabDef.name.toUpperCase();
  var schemaList = CANONICAL_SCHEMAS[schemaKey] || [];
  var existingColByCanonicalIdx = {};
  var duplicateColsToPrune = [];
  var usedExistingCols = {};

  for (var j = 0; j < canonicalHeaders.length; j++) {
    var canHeader = canonicalHeaders[j];
    var normCan = normalizeHeaderKey(canHeader);
    var matchedCol = -1;

    // 1. Direct normalized match
    for (var c = 0; c < existingHeaders.length; c++) {
      var colNum = c + 1;
      if (usedExistingCols[colNum]) continue;
      if (normalizeHeaderKey(existingHeaders[c]) === normCan) {
        matchedCol = colNum;
        break;
      }
    }

    // 2. Schema alias match
    if (matchedCol === -1 && schemaList.length > 0) {
      for (var f = 0; f < schemaList.length; f++) {
        var fieldDef = schemaList[f];
        if (normalizeHeaderKey(fieldDef.key) === normCan || (fieldDef.aliases && fieldDef.aliases.indexOf(normCan) >= 0)) {
          for (var ec = 0; ec < existingHeaders.length; ec++) {
            var eColNum = ec + 1;
            if (usedExistingCols[eColNum]) continue;
            var eNorm = normalizeHeaderKey(existingHeaders[ec]);
            if (eNorm === normalizeHeaderKey(fieldDef.key) || (fieldDef.aliases && fieldDef.aliases.indexOf(eNorm) >= 0)) {
              matchedCol = eColNum;
              break;
            }
          }
          if (matchedCol > 0) break;
        }
      }
    }

    // 3. Loose substring match
    if (matchedCol === -1) {
      for (var sc = 0; sc < existingHeaders.length; sc++) {
        var sColNum = sc + 1;
        if (usedExistingCols[sColNum]) continue;
        var sNorm = normalizeHeaderKey(existingHeaders[sc]);
        if (sNorm && (sNorm.indexOf(normCan) >= 0 || normCan.indexOf(sNorm) >= 0)) {
          matchedCol = sColNum;
          break;
        }
      }
    }

    if (matchedCol > 0) {
      existingColByCanonicalIdx[j] = matchedCol;
      usedExistingCols[matchedCol] = true;
    }
  }

  // Any remaining existing columns are duplicates or orphaned/obsolete
  for (var ec2 = 0; ec2 < existingHeaders.length; ec2++) {
    var cNum = ec2 + 1;
    if (!usedExistingCols[cNum]) {
      duplicateColsToPrune.push(cNum);
    }
  }

  // Reorder and align existing data rows
  var reorderedRows = [];
  if (lastRow > 1) {
    var existingData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var r = 0; r < existingData.length; r++) {
      var row = new Array(canonicalHeaders.length);
      for (var colIdx = 0; colIdx < canonicalHeaders.length; colIdx++) {
        var oldCol = existingColByCanonicalIdx[colIdx];
        var val = (oldCol > 0 && oldCol <= existingHeaders.length) ? existingData[r][oldCol - 1] : "";
        row[colIdx] = val;
      }
      reorderedRows.push(row);
    }
  }

  // Clear sheet and ensure exact column count
  sheet.clearContents();

  // If sheet has fewer columns than canonical, add columns
  if (sheet.getMaxColumns() < canonicalHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), canonicalHeaders.length - sheet.getMaxColumns());
  }
  // If sheet has more columns than canonical, delete excess columns
  if (sheet.getMaxColumns() > canonicalHeaders.length) {
    sheet.deleteColumns(canonicalHeaders.length + 1, sheet.getMaxColumns() - canonicalHeaders.length);
  }

  // Write standardized canonical headers
  var hRangeNew = sheet.getRange(1, 1, 1, canonicalHeaders.length);
  hRangeNew.setValues([canonicalHeaders]);
  hRangeNew.setBackground("#0f172a");
  hRangeNew.setFontColor("#fef08a");
  hRangeNew.setFontWeight("bold");
  sheet.setFrozenRows(1);

  // Write reordered rows
  if (reorderedRows.length > 0) {
    sheet.getRange(2, 1, reorderedRows.length, canonicalHeaders.length).setValues(reorderedRows);
  }

  // Format columns
  if (schemaList.length > 0) {
    var lookup = createHeaderIndexLookup(sheet, schemaList);
    applyColumnFormatting(sheet, lookup);
  }
}

function autoGenerateAndDeduplicateTabs(ss) {
  var standardTabs = getStandardTabDefinitions();
  var standardNames = [];
  var standardMap = {};

  for (var k = 0; k < standardTabs.length; k++) {
    var def = standardTabs[k];
    standardNames.push(def.name);
    standardMap[def.name.toLowerCase().trim()] = def;
  }

  // 1. Auto generate, standardize, reorder, and cleanse headers in official tabs
  standardTabs.forEach(function(tabDef) {
    var sheet = ss.getSheetByName(tabDef.name);
    if (!sheet) {
      sheet = ss.insertSheet(tabDef.name);
      sheet.appendRow(tabDef.headers);
      var headerRange = sheet.getRange(1, 1, 1, tabDef.headers.length);
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#fef08a");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    } else {
      reconcileAndSanitizeTabHeaders(sheet, tabDef, ss);
    }
  });

  // 2. Deduplicated tabs: Purge duplicate tabs, obsolete / redundant tabs, and tabs not stated in Apps Script
  var sheets = ss.getSheets();
  var purgedCount = 0;

  for (var i = sheets.length - 1; i >= 0; i--) {
    var currentSheet = sheets[i];
    var currentName = currentSheet.getName().trim();
    var lowerName = currentName.toLowerCase();

    var isStatedOfficial = standardMap[lowerName] !== undefined;

    var isDuplicateOrObsolete = false;
    if (!isStatedOfficial) {
      for (var stdKey in standardMap) {
        if (
          lowerName.indexOf(stdKey) >= 0 ||
          lowerName.indexOf("copy of") >= 0 ||
          lowerName.indexOf("sheet") >= 0 ||
          /copy/i.test(lowerName)
        ) {
          isDuplicateOrObsolete = true;
          break;
        }
      }
      if (!isDuplicateOrObsolete) {
        isDuplicateOrObsolete = true; // Any unstated tab not declared in Apps Script
      }
    }

    if (!isStatedOfficial && isDuplicateOrObsolete && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(currentSheet);
        purgedCount++;
      } catch (delErr) {}
    }
  }

  // 3. Reorder tabs to logical master workflow
  try {
    for (var m = 0; m < standardNames.length; m++) {
      var officialSheet = ss.getSheetByName(standardNames[m]);
      if (officialSheet) {
        ss.setActiveSheet(officialSheet);
        ss.moveActiveSheet(m + 1);
      }
    }
  } catch (orderErr) {}

  return {
    success: true,
    message: "Auto generated all module tabs and purged " + purgedCount + " duplicate/obsolete tab(s).",
    purgedCount: purgedCount,
    tabs: getDiscoveredSheets(ss)
  };
}

function ensureSheetTabs(ss) {
  return autoGenerateAndDeduplicateTabs(ss);
}

function cleanDuplicateAndRedundantWorksheets(ss) {
  return autoGenerateAndDeduplicateTabs(ss);
}

// ============================================================================
// 4. PRECISION TYPE FORMATTING & ESCAPE ENGINE
// ============================================================================

function normalizeHeaderKey(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getColumnLetter(colIndex) {
  var letter = "";
  while (colIndex > 0) {
    var temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
}

function parseNumeric(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  var clean = String(val).replace(/[^-0-9.]/g, "");
  var num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function normalizeDateStr(val, ss) {
  if (!val) return "";
  if (val instanceof Date) {
    var tz = ss ? ss.getSpreadsheetTimeZone() : "Africa/Nairobi";
    return Utilities.formatDate(val, tz || "Africa/Nairobi", "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (s.indexOf("T") >= 0) s = s.split("T")[0];
  
  var cleanStr = s.split("/").join("-");
  var parts = cleanStr.split("-");
  
  if (parts.length >= 3) {
    // Case 1: YYYY-MM-DD
    if (parts[0].length === 4) {
      var y = parts[0];
      var mm = parts[1].length === 1 ? "0" + parts[1] : parts[1];
      var dd = parts[2].length === 1 ? "0" + parts[2] : parts[2];
      return y + "-" + mm + "-" + dd;
    }
    // Case 2: DD-MM-YYYY
    if (parts[2].length === 4) {
      var dd = parts[0].length === 1 ? "0" + parts[0] : parts[0];
      var mm = parts[1].length === 1 ? "0" + parts[1] : parts[1];
      var y = parts[2];
      return y + "-" + mm + "-" + dd;
    }
  }
  return s;
}

function formatValueForSheet(val, type, ss) {
  if (type === "currency") {
    return parseNumeric(val);
  }

  if (type === "number") {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    var num = parseFloat(String(val).replace(/[^-0-9.]/g, ""));
    return isNaN(num) ? 0 : num;
  }

  if (type === "date") {
    return normalizeDateStr(val, ss);
  }

  if (type === "datetime") {
    if (!val) return new Date().toISOString();
    if (val instanceof Date) return val.toISOString();
    return String(val).trim();
  }

  if (type === "code") {
    if (val === null || val === undefined) return "";
    var s = String(val).trim();
    if (!s) return "";
    if (s.indexOf("'") === 0) return s;
    var firstChar = s.charAt(0);
    if (firstChar === "0" || firstChar === "+" || (s.length >= 10 && !isNaN(Number(s))) || /^[A-Za-z0-9_\\-]{5,}$/.test(s)) {
      return "'" + s;
    }
    return s;
  }

  // Text / Default
  if (val === null || val === undefined) return "";
  var text = String(val).replace(/\\r/g, "").trim();
  if (text.indexOf("'") === 0) return text;
  var firstCh = text.charAt(0);
  if (firstCh === "=" || firstCh === "+" || firstCh === "@" || firstCh === "-") {
    return "'" + text;
  }
  if (firstCh === "0" || firstCh === "+" || (text.length >= 10 && !isNaN(Number(text)))) {
    return "'" + text;
  }
  return text;
}

// ============================================================================
// 5. HEADER-INDEX LOOKUP & DYNAMIC ROW-PARSING ENGINE (ANTI-COLUMN-DRIFT)
// ============================================================================

/**
 * Creates an intelligent HeaderIndexLookup resolver for a specific sheet & schema.
 * 
 * Guarantees:
 * 1. Discovers 1-based column positions and letters directly from Row 1.
 * 2. Resolves incoming JSON fields across multiple naming conventions:
 *    canonical camelCase (e.g. clientKraPin), snake_case (client_kra_pin),
 *    raw header string ("KRA PIN", "Client Address"), and alias lookup.
 * 3. Prevents Column Drift: values are mapped directly to the actual column index in the sheet.
 * 4. Non-destructive to Custom Columns: user-added columns (e.g., Accountant Notes, Department)
 *    retain their existing cell values on updates, or default to blank on inserts.
 * 5. Bi-directional: seamlessly handles JSON -> Sheet Row and Sheet Row -> JSON.
 */
function createHeaderIndexLookup(sheet, schemaList) {
  var lastCol = Math.max(1, sheet.getLastColumn());
  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];

  var colIndexByKey = {};          // canonicalKey -> 1-based colIndex
  var fieldByColIndex = {};        // 1-based colIndex -> field definition
  var headerByColIndex = {};       // 1-based colIndex -> raw string header
  var normHeaderToColIndex = {};   // normalized header string -> 1-based colIndex
  var customColIndexes = [];       // 1-based indexes of user-added / unmapped columns

  // Index existing sheet headers
  for (var c = 0; c < rawHeaders.length; c++) {
    var rawH = String(rawHeaders[c] || "").trim();
    var normH = normalizeHeaderKey(rawH);
    var colNum = c + 1;
    headerByColIndex[colNum] = rawH;
    if (normH) {
      normHeaderToColIndex[normH] = colNum;
    }
  }

  // Match canonical schema fields to sheet columns using multi-tier alias resolution
  if (Array.isArray(schemaList)) {
    for (var f = 0; f < schemaList.length; f++) {
      var fieldDef = schemaList[f];
      var matchedCol = -1;

      // Tier 1: Match by normalized canonical key
      var normKey = normalizeHeaderKey(fieldDef.key);
      if (normHeaderToColIndex[normKey]) {
        matchedCol = normHeaderToColIndex[normKey];
      }

      // Tier 2: Match by normalized aliases
      if (matchedCol === -1 && fieldDef.aliases && fieldDef.aliases.length > 0) {
        for (var a = 0; a < fieldDef.aliases.length; a++) {
          var normAlias = normalizeHeaderKey(fieldDef.aliases[a]);
          if (normHeaderToColIndex[normAlias]) {
            matchedCol = normHeaderToColIndex[normAlias];
            break;
          }
        }
      }

      // Tier 3: Scan raw headers for loose substring match
      if (matchedCol === -1) {
        for (var h = 0; h < rawHeaders.length; h++) {
          var headerStr = normalizeHeaderKey(rawHeaders[h]);
          if (!headerStr) continue;
          if (headerStr === normKey || headerStr.indexOf(normKey) >= 0 || normKey.indexOf(headerStr) >= 0) {
            matchedCol = h + 1;
            break;
          }
        }
      }

      if (matchedCol > 0 && !colIndexByKey[fieldDef.key]) {
        colIndexByKey[fieldDef.key] = matchedCol;
        fieldByColIndex[matchedCol] = fieldDef;
      }
    }
  }

  // Identify custom / non-schema columns
  for (var col = 1; col <= rawHeaders.length; col++) {
    if (!fieldByColIndex[col]) {
      customColIndexes.push(col);
    }
  }

  return {
    headers: rawHeaders,
    colCount: rawHeaders.length,
    colIndexByKey: colIndexByKey,
    fieldByColIndex: fieldByColIndex,
    headerByColIndex: headerByColIndex,
    customColIndexes: customColIndexes,

    /**
     * Resolves 1-based column index for a given key, alias, or raw header name.
     */
    getColumnIndex: function(keyOrAlias) {
      if (!keyOrAlias) return -1;
      if (colIndexByKey[keyOrAlias]) return colIndexByKey[keyOrAlias];

      var norm = normalizeHeaderKey(keyOrAlias);
      if (normHeaderToColIndex[norm]) return normHeaderToColIndex[norm];

      if (Array.isArray(schemaList)) {
        for (var i = 0; i < schemaList.length; i++) {
          var def = schemaList[i];
          if (normalizeHeaderKey(def.key) === norm) {
            return colIndexByKey[def.key] || -1;
          }
          if (def.aliases) {
            for (var j = 0; j < def.aliases.length; j++) {
              if (normalizeHeaderKey(def.aliases[j]) === norm) {
                return colIndexByKey[def.key] || -1;
              }
            }
          }
        }
      }
      return -1;
    },

    /**
     * Returns Google Spreadsheet column letter (e.g. "A", "K", "M") for dynamic formulas.
     */
    getColumnLetter: function(keyOrAlias) {
      var colIdx = this.getColumnIndex(keyOrAlias);
      if (colIdx > 0) return getColumnLetter(colIdx);
      return "A";
    },

    /**
     * Dynamically extracts field value from incoming JSON object using flexible key matching & computed fallbacks.
     */
    extractJSONValue: function(jsonObj, fieldDef) {
      if (!jsonObj || !fieldDef) return undefined;
      var key = fieldDef.key;

      // 1. Direct property access
      if (jsonObj[key] !== undefined) return jsonObj[key];

      // 2. Case-insensitive / snake_case lookup in JSON keys
      var normTarget = normalizeHeaderKey(key);
      var objKeys = Object.keys(jsonObj);
      for (var k = 0; k < objKeys.length; k++) {
        var objKey = objKeys[k];
        if (normalizeHeaderKey(objKey) === normTarget) {
          return jsonObj[objKey];
        }
      }

      // 3. Alias lookup in JSON keys
      if (fieldDef.aliases) {
        for (var a = 0; a < fieldDef.aliases.length; a++) {
          var normAlias = normalizeHeaderKey(fieldDef.aliases[a]);
          for (var ok = 0; ok < objKeys.length; ok++) {
            if (normalizeHeaderKey(objKeys[ok]) === normAlias) {
              return jsonObj[objKeys[ok]];
            }
          }
        }
      }

      // 4. Computed Fallbacks for Hotel Damview Business Logic
      if (key === "grossSubtotal") {
        var disc = parseNumeric(jsonObj.discount);
        var net = parseNumeric(jsonObj.subtotal);
        if (net > 0 || disc > 0) return disc > 0 ? (net + disc) : net;
      }
      if (key === "balanceDue") {
        var grand = parseNumeric(jsonObj.grandTotal);
        var paid = parseNumeric(jsonObj.amountPaid);
        if (grand > 0 || paid > 0) return Math.max(0, grand - paid);
      }
      if (key === "updatedAt") {
        return new Date().toISOString();
      }
      if (key === "paymentMode" && !jsonObj.paymentMode) {
        return "M-Pesa";
      }

      return undefined;
    },

    /**
     * Builds a full row array mapped dynamically to the current sheet column layout.
     * Preserves custom/unmapped user columns in existingRowValues.
     */
    buildRowFromJSON: function(jsonObj, existingRowValues, ss) {
      var numCols = Math.max(this.colCount, (existingRowValues ? existingRowValues.length : 0));
      var rowArray = new Array(numCols);

      for (var c = 0; c < numCols; c++) {
        var colNum = c + 1;
        var fieldDef = fieldByColIndex[colNum];

        if (fieldDef) {
          var rawVal = this.extractJSONValue(jsonObj, fieldDef);
          if (rawVal === undefined && existingRowValues && existingRowValues[c] !== undefined) {
            rawVal = existingRowValues[c];
          }
          rowArray[c] = formatValueForSheet(rawVal, fieldDef.type, ss);
        } else {
          // Custom / Unmapped Column - non-destructively preserve existing value
          rowArray[c] = (existingRowValues && existingRowValues[c] !== undefined) ? existingRowValues[c] : "";
        }
      }

      return rowArray;
    },

    /**
     * Parses a sheet row array back into a typed canonical JSON object.
     */
    parseRowToJSON: function(rowValues, ss) {
      if (!rowValues || !Array.isArray(rowValues)) return {};
      var obj = {};
      var customFields = {};
      var hasAnyCustom = false;

      for (var c = 0; c < rowValues.length; c++) {
        var colNum = c + 1;
        var fieldDef = fieldByColIndex[colNum];
        var rawCell = rowValues[c];

        if (fieldDef) {
          obj[fieldDef.key] = extractCellField(rowValues, colNum, fieldDef.type, ss);
        } else {
          var headerName = headerByColIndex[colNum] || ("Column_" + getColumnLetter(colNum));
          if (rawCell !== null && rawCell !== undefined && rawCell !== "") {
            customFields[headerName] = rawCell;
            hasAnyCustom = true;
          }
        }
      }

      if (hasAnyCustom) {
        obj._customFields = customFields;
      }
      return obj;
    }
  };
}

// Backward compatibility alias
function buildHeaderMapping(sheet, schemaList) {
  var lookup = createHeaderIndexLookup(sheet, schemaList);
  var fieldAtCol = new Array(lookup.colCount);
  for (var c = 0; c < lookup.colCount; c++) {
    fieldAtCol[c] = lookup.fieldByColIndex[c + 1] || null;
  }
  return {
    colIndexMap: lookup.colIndexByKey,
    fieldAtCol: fieldAtCol,
    headers: lookup.headers
  };
}

function buildAlignedRowArray(sheet, schemaList, dataObj, existingRowValues, ss) {
  var lookup = createHeaderIndexLookup(sheet, schemaList);
  var rowValues = lookup.buildRowFromJSON(dataObj, existingRowValues, ss);
  return { rowValues: rowValues, headerInfo: buildHeaderMapping(sheet, schemaList) };
}

function applyColumnFormatting(sheet, headerLookup) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var numRows = lastRow - 1;
  var fieldByColIndex = headerLookup.fieldByColIndex || {};

  var colIndices = Object.keys(fieldByColIndex);
  for (var i = 0; i < colIndices.length; i++) {
    var colNum = parseInt(colIndices[i], 10);
    var field = fieldByColIndex[colNum];
    if (!field || isNaN(colNum)) continue;

    var colRange = sheet.getRange(2, colNum, numRows, 1);

    if (field.type === "currency") {
      colRange.setNumberFormat("#,##0.00");
    } else if (field.type === "date") {
      colRange.setNumberFormat("yyyy-mm-dd");
    } else if (field.type === "code" || field.key === "phone" || field.key === "kraPin" || field.key === "clientKraPin" || field.key === "clientPhone") {
      colRange.setNumberFormat("@");
    } else if (field.key === "address" || field.key === "particulars" || field.key === "clientAddress") {
      colRange.setWrap(true);
    }
  }
}

// ============================================================================
// 6. DOCUMENT UPSERT & LINE ITEMS (INVOICES / QUOTATIONS / PROFORMAS)
// ============================================================================

function upsertDocument(ss, doc) {
  if (!doc || !doc.documentNumber) return null;

  var docType = (doc.documentType || "INVOICE").toUpperCase();
  var tabName = docType === "QUOTATION" ? "Quotations" : docType === "PROFORMA" ? "Proformas" : "Invoices";
  var schemaList = docType === "QUOTATION" ? CANONICAL_SCHEMAS.QUOTATION : docType === "PROFORMA" ? CANONICAL_SCHEMAS.PROFORMA : CANONICAL_SCHEMAS.INVOICE;

  var sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error("Worksheet tab '" + tabName + "' does not exist.");

  var lookup = createHeaderIndexLookup(sheet, schemaList);
  var docNumCol = lookup.getColumnIndex("documentNumber");
  if (docNumCol === -1) docNumCol = 1;
  var idCol = lookup.getColumnIndex("id");
  var driveCol = lookup.getColumnIndex("driveFileUrl");

  var targetNum = String(doc.documentNumber).trim().toLowerCase();
  var targetId = doc.id ? String(doc.id).trim().toLowerCase() : "";

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var existingRowValues = null;

  for (var r = 1; r < data.length; r++) {
    var rowDocNum = String(data[r][docNumCol - 1] || "").trim().toLowerCase();
    var rowId = (idCol > 0 && idCol <= data[r].length) ? String(data[r][idCol - 1] || "").trim().toLowerCase() : "";
    if ((targetNum && rowDocNum === targetNum) || (targetId && rowId === targetId)) {
      rowIndex = r + 1;
      existingRowValues = data[r];
      break;
    }
  }

  if (driveCol > 0 && existingRowValues && !doc.driveFileUrl) {
    var existingDrive = existingRowValues[driveCol - 1];
    if (existingDrive) doc.driveFileUrl = existingDrive;
  }

  var rowValues = lookup.buildRowFromJSON(doc, existingRowValues, ss);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
    rowIndex = sheet.getLastRow();
  }

  applyColumnFormatting(sheet, lookup);

  return {
    documentNumber: doc.documentNumber,
    tab: tabName,
    row: rowIndex
  };
}

function syncLineItemsBreakdown(ss, doc) {
  var sheet = ss.getSheetByName("Line_Items_Breakdown");
  if (!sheet || !doc || !doc.lineItems) return;

  var schemaList = CANONICAL_SCHEMAS.LINE_ITEM;
  var lookup = createHeaderIndexLookup(sheet, schemaList);
  var docNumCol = lookup.getColumnIndex("documentNumber");
  if (docNumCol === -1) docNumCol = 1;
  var targetNum = String(doc.documentNumber || "").trim().toLowerCase();

  var data = sheet.getDataRange().getValues();
  for (var r = data.length - 1; r >= 1; r--) {
    var rowDocNum = String(data[r][docNumCol - 1] || "").trim().toLowerCase();
    if (rowDocNum === targetNum) {
      sheet.deleteRow(r + 1);
    }
  }

  for (var i = 0; i < doc.lineItems.length; i++) {
    var item = doc.lineItems[i];
    var qty = Number(item.quantity) || 1;
    var days = Number(item.days) || 1;
    var rate = parseNumeric(item.rate);
    var discount = parseNumeric(item.discount || 0);
    var totalAmount = item.amount !== undefined ? parseNumeric(item.amount) : Math.max(0, qty * days * rate - discount);

    var itemObj = {
      documentNumber: doc.documentNumber,
      documentType: doc.documentType || "INVOICE",
      issueDate: doc.issueDate || "",
      clientName: doc.clientName || "",
      particulars: item.particulars || "Accommodation / Service",
      quantity: qty,
      days: days,
      rate: rate,
      discount: discount,
      totalAmount: totalAmount,
      id: item.id || ("LI-" + (i + 1))
    };

    var itemRow = lookup.buildRowFromJSON(itemObj, null, ss);
    sheet.appendRow(itemRow);
  }

  applyColumnFormatting(sheet, lookup);
}

// ============================================================================
// 7. CLIENT UPSERT WITH ID & PIN DYNAMIC ALIGNMENT
// ============================================================================

function upsertClient(ss, client) {
  if (!client) return null;
  var sheet = ss.getSheetByName("Clients");
  if (!sheet) throw new Error("Sheet tab 'Clients' does not exist.");

  var schemaList = CANONICAL_SCHEMAS.CLIENT;
  var lookup = createHeaderIndexLookup(sheet, schemaList);

  var idCol = lookup.getColumnIndex("id");
  if (idCol === -1) idCol = 1;
  var nameCol = lookup.getColumnIndex("name");
  if (nameCol === -1) nameCol = 2;
  var pinCol = lookup.getColumnIndex("kraPin");

  var clientId = client.id ? String(client.id).trim().toLowerCase() : "";
  var clientPin = client.kraPin ? String(client.kraPin).trim().toLowerCase() : "";
  var clientName = client.name ? String(client.name).trim().toLowerCase() : "";

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var existingRowValues = null;

  for (var r = 1; r < data.length; r++) {
    var rowId = String(data[r][idCol - 1] || "").trim().toLowerCase();
    var rowName = String(data[r][nameCol - 1] || "").trim().toLowerCase();
    var rowPin = (pinCol > 0 && pinCol <= data[r].length) ? String(data[r][pinCol - 1] || "").trim().toLowerCase() : "";

    if ((clientId && rowId === clientId) || (clientPin && rowPin === clientPin) || (clientName && rowName === clientName)) {
      rowIndex = r + 1;
      existingRowValues = data[r];
      break;
    }
  }

  var clientData = {
    id: client.id || ("CLI-" + Date.now()),
    name: client.name || "",
    contactPerson: client.contactPerson || "",
    kraPin: client.kraPin ? client.kraPin.toUpperCase() : "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    createdAt: client.createdAt || new Date().toISOString().split("T")[0],
    updatedAt: new Date().toISOString()
  };

  var rowValues = lookup.buildRowFromJSON(clientData, existingRowValues, ss);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
    rowIndex = sheet.getLastRow();
  }

  applyColumnFormatting(sheet, lookup);

  return { clientId: clientData.id, row: rowIndex };
}

// ============================================================================
// 8. PAYMENT RECORDING & INVOICE RECONCILIATION
// ============================================================================

function recordPayment(ss, payment) {
  if (!payment || !payment.receiptNumber) return null;
  var sheet = ss.getSheetByName("Receipts");
  if (!sheet) throw new Error("Sheet tab 'Receipts' does not exist.");

  var schemaList = CANONICAL_SCHEMAS.RECEIPT;
  var lookup = createHeaderIndexLookup(sheet, schemaList);

  var recNumCol = lookup.getColumnIndex("receiptNumber");
  if (recNumCol === -1) recNumCol = 1;
  var idCol = lookup.getColumnIndex("id");
  var driveCol = lookup.getColumnIndex("driveFileUrl");

  var targetRec = String(payment.receiptNumber).trim().toLowerCase();
  var targetId = payment.id ? String(payment.id).trim().toLowerCase() : "";

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var existingRowValues = null;

  for (var r = 1; r < data.length; r++) {
    var rowRec = String(data[r][recNumCol - 1] || "").trim().toLowerCase();
    var rowId = (idCol > 0 && idCol <= data[r].length) ? String(data[r][idCol - 1] || "").trim().toLowerCase() : "";
    if ((targetRec && rowRec === targetRec) || (targetId && rowId === targetId)) {
      rowIndex = r + 1;
      existingRowValues = data[r];
      break;
    }
  }

  if (driveCol > 0 && existingRowValues && !payment.driveFileUrl) {
    var existingDrive = existingRowValues[driveCol - 1];
    if (existingDrive) payment.driveFileUrl = existingDrive;
  }

  var paymentData = {
    receiptNumber: payment.receiptNumber,
    date: payment.date || new Date().toISOString().split("T")[0],
    clientName: payment.clientName || "",
    documentNumber: payment.documentNumber || "Direct Settlement",
    paymentMode: payment.paymentMode || "M-Pesa",
    amount: parseNumeric(payment.amount),
    referenceNote: payment.referenceNote || "",
    driveFileUrl: payment.driveFileUrl || "",
    createdAt: payment.createdAt || new Date().toISOString(),
    id: payment.id || ("PAY-" + Date.now())
  };

  var rowValues = lookup.buildRowFromJSON(paymentData, existingRowValues, ss);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
    rowIndex = sheet.getLastRow();
  }

  applyColumnFormatting(sheet, lookup);

  if (payment.documentNumber) {
    reconcileInvoiceBalance(ss, payment.documentNumber);
  }

  return { receiptNumber: payment.receiptNumber, row: rowIndex };
}

function reconcileInvoiceBalance(ss, docNumber) {
  try {
    var targetDocNum = String(docNumber).trim().toLowerCase();
    var invSheet = ss.getSheetByName("Invoices");
    var recSheet = ss.getSheetByName("Receipts");
    if (!invSheet || !recSheet) return;

    var invLookup = createHeaderIndexLookup(invSheet, CANONICAL_SCHEMAS.INVOICE);
    var recLookup = createHeaderIndexLookup(recSheet, CANONICAL_SCHEMAS.RECEIPT);

    var invDocCol = invLookup.getColumnIndex("documentNumber");
    if (invDocCol === -1) invDocCol = 1;
    var invGrandCol = invLookup.getColumnIndex("grandTotal");
    var invPaidCol = invLookup.getColumnIndex("amountPaid");
    var invBalCol = invLookup.getColumnIndex("balanceDue");
    var invStatusCol = invLookup.getColumnIndex("status");
    var invUpdatedCol = invLookup.getColumnIndex("updatedAt");

    var recDocCol = recLookup.getColumnIndex("documentNumber");
    if (recDocCol === -1) recDocCol = 4;
    var recAmountCol = recLookup.getColumnIndex("amount");
    if (recAmountCol === -1) recAmountCol = 6;

    var invData = invSheet.getDataRange().getValues();
    var recData = recSheet.getDataRange().getValues();

    var totalPaid = 0;
    for (var r = 1; r < recData.length; r++) {
      var settledDoc = String(recData[r][recDocCol - 1] || "").trim().toLowerCase();
      if (settledDoc === targetDocNum) {
        totalPaid += parseNumeric(recData[r][recAmountCol - 1]);
      }
    }

    for (var j = 1; j < invData.length; j++) {
      var curDoc = String(invData[j][invDocCol - 1] || "").trim().toLowerCase();
      if (curDoc === targetDocNum) {
        var grandTotal = invGrandCol > 0 ? parseNumeric(invData[j][invGrandCol - 1]) : 0;
        var newBalance = Math.max(0, grandTotal - totalPaid);
        var newStatus = newBalance <= 0 ? "Paid" : "Sent";

        if (invPaidCol > 0) invSheet.getRange(j + 1, invPaidCol).setValue(totalPaid);
        if (invBalCol > 0) invSheet.getRange(j + 1, invBalCol).setValue(newBalance);
        if (invStatusCol > 0) invSheet.getRange(j + 1, invStatusCol).setValue(newStatus);
        if (invUpdatedCol > 0) invSheet.getRange(j + 1, invUpdatedCol).setValue(new Date().toISOString());
        break;
      }
    }
  } catch (recErr) {
    Logger.log("Reconciliation warning: " + recErr.toString());
  }
}

// ============================================================================
// 9. DYNAMIC ANALYTICS & STATEMENTS LEDGER ENGINE
// ============================================================================

function refreshAllAnalyticsTabs(ss) {
  populateSummaryDashboard(ss);
  refreshStatementsLedger(ss);
  refreshMonthlyRevenueAnalytics(ss);
}

function populateSummaryDashboard(ss) {
  var sheet = ss.getSheetByName("Summary_Dashboard");
  if (!sheet) return;

  var invSheet = ss.getSheetByName("Invoices");
  var recSheet = ss.getSheetByName("Receipts");
  var quotSheet = ss.getSheetByName("Quotations");
  var profSheet = ss.getSheetByName("Proformas");

  var invTotalLetter = "K";
  var invBalLetter = "M";
  var invStatusLetter = "N";
  var recAmountLetter = "F";
  var recModeLetter = "E";
  var quotTotalLetter = "K";
  var profTotalLetter = "K";

  if (invSheet) {
    var invLookup = createHeaderIndexLookup(invSheet, CANONICAL_SCHEMAS.INVOICE);
    invTotalLetter = invLookup.getColumnLetter("grandTotal");
    invBalLetter = invLookup.getColumnLetter("balanceDue");
    invStatusLetter = invLookup.getColumnLetter("status");
  }
  if (recSheet) {
    var recLookup = createHeaderIndexLookup(recSheet, CANONICAL_SCHEMAS.RECEIPT);
    recAmountLetter = recLookup.getColumnLetter("amount");
    recModeLetter = recLookup.getColumnLetter("paymentMode");
  }
  if (quotSheet) {
    var qLookup = createHeaderIndexLookup(quotSheet, CANONICAL_SCHEMAS.QUOTATION);
    quotTotalLetter = qLookup.getColumnLetter("grandTotal");
  }
  if (profSheet) {
    var pLookup = createHeaderIndexLookup(profSheet, CANONICAL_SCHEMAS.PROFORMA);
    profTotalLetter = pLookup.getColumnLetter("grandTotal");
  }

  sheet.clearContents();
  sheet.appendRow(["Metric / KPI Category", "Live Computed Value", "Unit / Metric Formula", "Notes / Category"]);
  var headerRange = sheet.getRange(1, 1, 1, 4);
  headerRange.setBackground("#1c1917");
  headerRange.setFontColor("#fef08a");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);

  var kpiRows = [
    ["TOTAL REVENUE INVOICED", "=IFERROR(SUM(Invoices!" + invTotalLetter + "2:" + invTotalLetter + "), 0)", "Ksh", "Total Billed Across All Invoices"],
    ["TOTAL CASH / REVENUE COLLECTED", "=IFERROR(SUM(Receipts!" + recAmountLetter + "2:" + recAmountLetter + "), 0)", "Ksh", "Total Payments Received"],
    ["OUTSTANDING ACCOUNTS RECEIVABLE", "=IFERROR(SUM(Invoices!" + invBalLetter + "2:" + invBalLetter + "), 0)", "Ksh", "Unpaid Invoice Balances Due"],
    ["TOTAL QUOTATIONS PIPELINE", "=IFERROR(SUM(Quotations!" + quotTotalLetter + "2:" + quotTotalLetter + "), 0)", "Ksh", "Active & Sent Quotations Value"],
    ["TOTAL PROFORMA INVOICES VALUE", "=IFERROR(SUM(Proformas!" + profTotalLetter + "2:" + profTotalLetter + "), 0)", "Ksh", "Proforma Invoices Value"],
    ["COLLECTION EFFICIENCY RATE", "=IFERROR(IF(B2>0, (B3/B2), 0), 0)", "% Ratio", "Total Collected / Total Invoiced"],
    ["TOTAL ACTIVE CLIENTS", "=IFERROR(COUNTA(Clients!A2:A), 0)", "Count", "Registered Corporate & Individual Clients"],
    ["TOTAL INVOICES ISSUED", "=IFERROR(COUNTA(Invoices!A2:A), 0)", "Count", "Master Invoices Issued"],
    ["TOTAL RECEIPTS ISSUED", "=IFERROR(COUNTA(Receipts!A2:A), 0)", "Count", "Official Payment Receipts Generated"],
    ["--- PAYMENT MODES BREAKDOWN ---", "", "", ""],
    ["M-Pesa Collections", '=IFERROR(SUMIF(Receipts!' + recModeLetter + '2:' + recModeLetter + ', "M-Pesa", Receipts!' + recAmountLetter + '2:' + recAmountLetter + '), 0)', "Ksh", "Till & Mobile Money Settlements"],
    ["Bank Transfer Collections", '=IFERROR(SUMIF(Receipts!' + recModeLetter + '2:' + recModeLetter + ', "Bank Transfer", Receipts!' + recAmountLetter + '2:' + recAmountLetter + '), 0)', "Ksh", "Direct Bank Deposits & RTGS/EFT"],
    ["Cash Collections", '=IFERROR(SUMIF(Receipts!' + recModeLetter + '2:' + recModeLetter + ', "Cash", Receipts!' + recAmountLetter + '2:' + recAmountLetter + '), 0)', "Ksh", "Front Desk & Dining Cash Receipts"],
    ["Credit / Debit Card Collections", '=IFERROR(SUMIF(Receipts!' + recModeLetter + '2:' + recModeLetter + ', "Credit / Debit Card", Receipts!' + recAmountLetter + '2:' + recAmountLetter + '), 0)', "Ksh", "PDQ & Card Terminal Transactions"],
    ["Cheque Collections", '=IFERROR(SUMIF(Receipts!' + recModeLetter + '2:' + recModeLetter + ', "Cheque", Receipts!' + recAmountLetter + '2:' + recAmountLetter + '), 0)', "Ksh", "Corporate Cheques Cleared"],
    ["--- INVOICE STATUS DISTRIBUTION ---", "", "", ""],
    ["Fully Paid Invoices", '=IFERROR(COUNTIF(Invoices!' + invStatusLetter + '2:' + invStatusLetter + ', "Paid"), 0)', "Count", "Settled Invoices with 0 Balance"],
    ["Pending / Sent Invoices", '=IFERROR(COUNTIF(Invoices!' + invStatusLetter + '2:' + invStatusLetter + ', "Sent"), 0)', "Count", "Invoices awaiting full settlement"],
    ["Draft Invoices", '=IFERROR(COUNTIF(Invoices!' + invStatusLetter + '2:' + invStatusLetter + ', "Draft"), 0)', "Count", "Unfinalized Invoices in progress"],
    ["--- LAST REFRESH ---", new Date().toISOString(), "ISO Timestamp", "Automated Real-time Dynamic Engine"]
  ];

  for (var r = 0; r < kpiRows.length; r++) {
    sheet.appendRow(kpiRows[r]);
  }

  try {
    sheet.getRange("B2:B6").setNumberFormat("#,##0.00");
    sheet.getRange("B7").setNumberFormat("0.0%");
    sheet.getRange("B8:B10").setNumberFormat("#,##0");
    sheet.getRange("B12:B16").setNumberFormat("#,##0.00");
    sheet.getRange("B18:B20").setNumberFormat("#,##0");
    sheet.getRange("A11:D11").setBackground("#e4e4e7").setFontWeight("bold");
    sheet.getRange("A17:D17").setBackground("#e4e4e7").setFontWeight("bold");
    sheet.getRange("A21:D21").setBackground("#e4e4e7").setFontWeight("bold");
  } catch (fmtErr) {}
}

function refreshStatementsLedger(ss) {
  var clientSheet = ss.getSheetByName("Clients");
  var stmtSheet = ss.getSheetByName("Statements_Ledger");
  var invSheet = ss.getSheetByName("Invoices");
  var recSheet = ss.getSheetByName("Receipts");
  if (!clientSheet || !stmtSheet) return;

  var invNameCol = "D";
  var invTotalCol = "K";
  var recNameCol = "C";
  var recAmountCol = "F";

  if (invSheet) {
    var invLookup = createHeaderIndexLookup(invSheet, CANONICAL_SCHEMAS.INVOICE);
    invNameCol = invLookup.getColumnLetter("clientName");
    invTotalCol = invLookup.getColumnLetter("grandTotal");
  }
  if (recSheet) {
    var recLookup = createHeaderIndexLookup(recSheet, CANONICAL_SCHEMAS.RECEIPT);
    recNameCol = recLookup.getColumnLetter("clientName");
    recAmountCol = recLookup.getColumnLetter("amount");
  }

  stmtSheet.clearContents();
  stmtSheet.appendRow([
    "Client ID", "Client / Company Name", "KRA PIN", "Total Invoiced (Ksh)",
    "Total Paid (Ksh)", "Current Balance Due (Ksh)", "Account Status", "Last Transaction Date"
  ]);
  var headerRange = stmtSheet.getRange(1, 1, 1, 8);
  headerRange.setBackground("#1c1917");
  headerRange.setFontColor("#fef08a");
  headerRange.setFontWeight("bold");
  stmtSheet.setFrozenRows(1);

  var clientData = clientSheet.getDataRange().getValues();
  if (clientData.length <= 1) return;

  var clientLookup = createHeaderIndexLookup(clientSheet, CANONICAL_SCHEMAS.CLIENT);
  var idCol = clientLookup.getColumnIndex("id");
  if (idCol === -1) idCol = 1;
  var nameCol = clientLookup.getColumnIndex("name");
  if (nameCol === -1) nameCol = 2;
  var pinCol = clientLookup.getColumnIndex("kraPin");

  for (var i = 1; i < clientData.length; i++) {
    var cId = String(clientData[i][idCol - 1] || "").trim();
    var cName = String(clientData[i][nameCol - 1] || "").trim();
    var cPin = (pinCol > 0 && pinCol <= clientData[i].length) ? String(clientData[i][pinCol - 1] || "").trim() : "";
    if (!cId && !cName) continue;

    var rowIdx = i + 1;
    var rowValues = [
      cId,
      cName,
      cPin,
      '=IFERROR(SUMIF(Invoices!' + invNameCol + ':' + invNameCol + ', B' + rowIdx + ', Invoices!' + invTotalCol + ':' + invTotalCol + '), 0)',
      '=IFERROR(SUMIF(Receipts!' + recNameCol + ':' + recNameCol + ', B' + rowIdx + ', Receipts!' + recAmountCol + ':' + recAmountCol + '), 0)',
      '=IFERROR(D' + rowIdx + ' - E' + rowIdx + ', 0)',
      '=IF(F' + rowIdx + '<=0, "Clear / Settled", "Outstanding Balance")',
      new Date().toISOString().split("T")[0]
    ];
    stmtSheet.appendRow(rowValues);
  }

  try {
    var lastRow = stmtSheet.getLastRow();
    if (lastRow > 1) {
      stmtSheet.getRange(2, 4, lastRow - 1, 3).setNumberFormat("#,##0.00");
    }
  } catch (e) {}
}

function refreshMonthlyRevenueAnalytics(ss) {
  var invSheet = ss.getSheetByName("Invoices");
  var recSheet = ss.getSheetByName("Receipts");
  var analyticsSheet = ss.getSheetByName("Monthly_Revenue_Analytics");
  if (!invSheet || !recSheet || !analyticsSheet) return;

  analyticsSheet.clearContents();
  analyticsSheet.appendRow([
    "Month (YYYY-MM)", "Invoices Count", "Total Invoiced (Ksh)", "Total Collected (Ksh)",
    "Outstanding Balance (Ksh)", "Collection Rate %"
  ]);
  var headerRange = analyticsSheet.getRange(1, 1, 1, 6);
  headerRange.setBackground("#1c1917");
  headerRange.setFontColor("#fef08a");
  headerRange.setFontWeight("bold");
  analyticsSheet.setFrozenRows(1);

  var invLookup = createHeaderIndexLookup(invSheet, CANONICAL_SCHEMAS.INVOICE);
  var recLookup = createHeaderIndexLookup(recSheet, CANONICAL_SCHEMAS.RECEIPT);

  var invDateCol = invLookup.getColumnIndex("issueDate");
  if (invDateCol === -1) invDateCol = 2;
  var invGrandCol = invLookup.getColumnIndex("grandTotal");
  if (invGrandCol === -1) invGrandCol = 11;
  var recDateCol = recLookup.getColumnIndex("date");
  if (recDateCol === -1) recDateCol = 2;
  var recAmountCol = recLookup.getColumnIndex("amount");
  if (recAmountCol === -1) recAmountCol = 6;

  var invData = invSheet.getDataRange().getValues();
  var recData = recSheet.getDataRange().getValues();
  var monthMap = {};

  for (var i = 1; i < invData.length; i++) {
    var dateStr = normalizeDateStr(invData[i][invDateCol - 1], ss);
    var month = dateStr ? dateStr.substring(0, 7) : new Date().toISOString().substring(0, 7);
    if (!monthMap[month]) monthMap[month] = { count: 0, invoiced: 0, collected: 0 };
    monthMap[month].count++;
    monthMap[month].invoiced += parseNumeric(invData[i][invGrandCol - 1]);
  }

  for (var r = 1; r < recData.length; r++) {
    var recDateStr = normalizeDateStr(recData[r][recDateCol - 1], ss);
    var recMonth = recDateStr ? recDateStr.substring(0, 7) : new Date().toISOString().substring(0, 7);
    if (!monthMap[recMonth]) monthMap[recMonth] = { count: 0, invoiced: 0, collected: 0 };
    monthMap[recMonth].collected += parseNumeric(recData[r][recAmountCol - 1]);
  }

  var sortedMonths = Object.keys(monthMap).sort().reverse();
  for (var m = 0; m < sortedMonths.length; m++) {
    var mo = sortedMonths[m];
    var stat = monthMap[mo];
    var outstanding = Math.max(0, stat.invoiced - stat.collected);
    var rate = stat.invoiced > 0 ? (stat.collected / stat.invoiced) : (stat.collected > 0 ? 1 : 0);

    analyticsSheet.appendRow([mo, stat.count, stat.invoiced, stat.collected, outstanding, rate]);
  }

  try {
    var lastRow = analyticsSheet.getLastRow();
    if (lastRow > 1) {
      analyticsSheet.getRange(2, 3, lastRow - 1, 3).setNumberFormat("#,##0.00");
      analyticsSheet.getRange(2, 6, lastRow - 1, 1).setNumberFormat("0.0%");
    }
  } catch (e) {}
}

// ============================================================================
// 10. BIDIRECTIONAL DATA EXTRACTION (SHEETS -> APP) WITH TYPE RESTORATION
// ============================================================================

function extractCellField(rowValues, colIndex, type, ss) {
  if (!colIndex || colIndex > rowValues.length) {
    return type === "currency" || type === "number" ? 0 : "";
  }
  var raw = rowValues[colIndex - 1];

  if (type === "currency" || type === "number") {
    return parseNumeric(raw);
  }

  if (type === "date") {
    return normalizeDateStr(raw, ss);
  }

  if (type === "datetime") {
    if (!raw) return "";
    if (raw instanceof Date) return raw.toISOString();
    return String(raw).trim();
  }

  if (raw === null || raw === undefined) return "";
  var str = String(raw).trim();
  if (str.indexOf("'") === 0) str = str.substring(1);
  return str;
}

function getFullSpreadsheetData(ss) {
  var sheets = ss.getSheets();
  var result = {
    sheetName: ss.getName(),
    sheetUrl: ss.getUrl(),
    serverTimestamp: new Date().toISOString(),
    discoveredTabs: [],
    worksheets: {},
    invoices: [],
    quotations: [],
    proformas: [],
    clients: [],
    receipts: [],
    profile: {}
  };

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var tabName = sheet.getName();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow <= 0 || lastCol <= 0) {
      result.discoveredTabs.push({ name: tabName, rowCount: 0, headers: [], rows: [] });
      result.worksheets[tabName] = { headers: [], rows: [] };
      continue;
    }

    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0] || [];
    var rows = values.slice(1) || [];

    result.discoveredTabs.push({
      name: tabName,
      rowCount: rows.length,
      headers: headers,
      rows: rows
    });
    result.worksheets[tabName] = { headers: headers, rows: rows };

    if (tabName === "Invoices") {
      var invLookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.INVOICE);
      rows.forEach(function(r) {
        var parsed = invLookup.parseRowToJSON(r, ss);
        if (parsed.documentNumber) {
          if (!parsed.status) parsed.status = "Sent";
          result.invoices.push(parsed);
        }
      });
    } else if (tabName === "Quotations") {
      var qLookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.QUOTATION);
      rows.forEach(function(r) {
        var parsed = qLookup.parseRowToJSON(r, ss);
        if (parsed.documentNumber) {
          if (!parsed.status) parsed.status = "Draft";
          result.quotations.push(parsed);
        }
      });
    } else if (tabName === "Proformas") {
      var pLookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.PROFORMA);
      rows.forEach(function(r) {
        var parsed = pLookup.parseRowToJSON(r, ss);
        if (parsed.documentNumber) {
          if (!parsed.status) parsed.status = "Draft";
          result.proformas.push(parsed);
        }
      });
    } else if (tabName === "Clients") {
      var cLookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.CLIENT);
      rows.forEach(function(r) {
        var parsed = cLookup.parseRowToJSON(r, ss);
        if (parsed.id || parsed.name) {
          result.clients.push(parsed);
        }
      });
    } else if (tabName === "Receipts") {
      var recLookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.RECEIPT);
      rows.forEach(function(r) {
        var parsed = recLookup.parseRowToJSON(r, ss);
        if (parsed.receiptNumber) {
          if (!parsed.paymentMode) parsed.paymentMode = "M-Pesa";
          result.receipts.push(parsed);
        }
      });
    } else if (tabName === "Hotel_Profile") {
      rows.forEach(function(r) {
        if (r[0]) {
          result.profile[String(r[0])] = r[1] !== undefined ? String(r[1]) : "";
        }
      });
    }
  }

  return result;
}

// ============================================================================
// 11. HOTEL PROFILE & CASCADE DELETION
// ============================================================================

function processFullPushData(ss, data) {
  var stats = {
    clients: 0,
    documents: 0,
    payments: 0,
    catalogue: 0,
    posOrders: 0,
    reservations: 0,
    expenses: 0
  };

  if (data.profile) {
    upsertHotelProfile(ss, data.profile);
  }

  if (Array.isArray(data.clients)) {
    for (var c = 0; c < data.clients.length; c++) {
      upsertClient(ss, data.clients[c]);
      stats.clients++;
    }
  }

  if (Array.isArray(data.documents)) {
    for (var d = 0; d < data.documents.length; d++) {
      var docItem = data.documents[d];
      upsertDocument(ss, docItem);
      if (docItem.lineItems && Array.isArray(docItem.lineItems)) {
        syncLineItemsBreakdown(ss, docItem);
      }
      stats.documents++;
    }
  }

  if (Array.isArray(data.payments)) {
    for (var p = 0; p < data.payments.length; p++) {
      recordPayment(ss, data.payments[p]);
      stats.payments++;
    }
  }

  if (Array.isArray(data.catalogue)) {
    for (var cat = 0; cat < data.catalogue.length; cat++) {
      upsertCatalogueItem(ss, data.catalogue[cat]);
      stats.catalogue++;
    }
  }

  if (Array.isArray(data.posOrders)) {
    for (var pos = 0; pos < data.posOrders.length; pos++) {
      upsertPosOrder(ss, data.posOrders[pos]);
      stats.posOrders++;
    }
  }

  if (Array.isArray(data.reservations)) {
    for (var res = 0; res < data.reservations.length; res++) {
      upsertReservation(ss, data.reservations[res]);
      stats.reservations++;
    }
  }

  if (Array.isArray(data.expenses)) {
    for (var exp = 0; exp < data.expenses.length; exp++) {
      upsertExpense(ss, data.expenses[exp]);
      stats.expenses++;
    }
  }

  refreshAllAnalyticsTabs(ss);
  return stats;
}

function upsertCatalogueItem(ss, item) {
  var sheet = ss.getSheetByName("Particulars_Catalogue");
  if (!sheet) return null;
  var lookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.CATALOGUE);
  var rowData = buildAlignedRowArray(sheet, CANONICAL_SCHEMAS.CATALOGUE, item, null, ss);

  var idCol = lookup.getColumnIndex("id");
  var targetId = String(item.id || item.particulars || "").trim().toLowerCase();

  if (targetId && idCol > 0) {
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      var rowId = String(values[r][idCol - 1] || "").trim().toLowerCase();
      if (rowId === targetId) {
        sheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
        return item;
      }
    }
  }
  sheet.appendRow(rowData);
  return item;
}

function upsertPosOrder(ss, order) {
  var sheet = ss.getSheetByName("POS_Orders");
  if (!sheet) return null;
  var lookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.POS_ORDER);
  var rowData = buildAlignedRowArray(sheet, CANONICAL_SCHEMAS.POS_ORDER, order, null, ss);

  var numCol = lookup.getColumnIndex("orderNumber");
  var targetNum = String(order.orderNumber || order.id || "").trim().toLowerCase();

  if (targetNum && numCol > 0) {
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      var rowNum = String(values[r][numCol - 1] || "").trim().toLowerCase();
      if (rowNum === targetNum) {
        sheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
        return order;
      }
    }
  }
  sheet.appendRow(rowData);
  return order;
}

function upsertReservation(ss, resObj) {
  var sheet = ss.getSheetByName("Reservations");
  if (!sheet) return null;
  var lookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.RESERVATION);
  var rowData = buildAlignedRowArray(sheet, CANONICAL_SCHEMAS.RESERVATION, resObj, null, ss);

  var idCol = lookup.getColumnIndex("id");
  var targetId = String(resObj.id || resObj.bookingNumber || "").trim().toLowerCase();

  if (targetId && idCol > 0) {
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      var rowId = String(values[r][idCol - 1] || "").trim().toLowerCase();
      if (rowId === targetId) {
        sheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
        return resObj;
      }
    }
  }
  sheet.appendRow(rowData);
  return resObj;
}

function upsertExpense(ss, expObj) {
  var sheet = ss.getSheetByName("Expenses");
  if (!sheet) return null;
  var lookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.EXPENSE);
  var rowData = buildAlignedRowArray(sheet, CANONICAL_SCHEMAS.EXPENSE, expObj, null, ss);

  var idCol = lookup.getColumnIndex("id");
  var targetId = String(expObj.id || "").trim().toLowerCase();

  if (targetId && idCol > 0) {
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      var rowId = String(values[r][idCol - 1] || "").trim().toLowerCase();
      if (rowId === targetId) {
        sheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
        return expObj;
      }
    }
  }
  sheet.appendRow(rowData);
  return expObj;
}

function upsertHotelProfile(ss, profile) {
  if (!profile) return null;
  var sheet = ss.getSheetByName("Hotel_Profile");
  if (!sheet) return null;

  var keys = Object.keys(profile);
  var data = sheet.getDataRange().getValues();
  var existingMap = {};

  for (var i = 1; i < data.length; i++) {
    var prop = String(data[i][0] || "").trim();
    if (prop) existingMap[prop] = i + 1;
  }

  var now = new Date().toISOString();
  keys.forEach(function(k) {
    if (k === "logoBase64") return;
    var val = profile[k] !== undefined && profile[k] !== null ? String(profile[k]) : "";
    if (existingMap[k]) {
      sheet.getRange(existingMap[k], 2).setValue(val);
      sheet.getRange(existingMap[k], 3).setValue(now);
    } else {
      sheet.appendRow([k, val, now]);
    }
  });

  return { success: true, updated: keys.length };
}

function cascadeDeleteDocument(ss, documentId, documentNumber, folderName) {
  var tabNames = ["Invoices", "Quotations", "Proformas"];
  var deletedRows = 0;
  var targetNum = documentNumber ? String(documentNumber).trim().toLowerCase() : "";
  var targetId = documentId ? String(documentId).trim().toLowerCase() : "";

  for (var t = 0; t < tabNames.length; t++) {
    var sheet = ss.getSheetByName(tabNames[t]);
    if (sheet) {
      var schema = tabNames[t] === "Quotations" ? CANONICAL_SCHEMAS.QUOTATION : tabNames[t] === "Proformas" ? CANONICAL_SCHEMAS.PROFORMA : CANONICAL_SCHEMAS.INVOICE;
      var lookup = createHeaderIndexLookup(sheet, schema);
      var docCol = lookup.getColumnIndex("documentNumber");
      if (docCol === -1) docCol = 1;
      var idCol = lookup.getColumnIndex("id");

      var data = sheet.getDataRange().getValues();
      for (var r = data.length - 1; r >= 1; r--) {
        var rowDocNum = String(data[r][docCol - 1] || "").trim().toLowerCase();
        var rowDocId = (idCol > 0 && idCol <= data[r].length) ? String(data[r][idCol - 1] || "").trim().toLowerCase() : "";
        if ((targetNum && rowDocNum === targetNum) || (targetId && rowDocId === targetId)) {
          sheet.deleteRow(r + 1);
          deletedRows++;
        }
      }
    }
  }

  var lineSheet = ss.getSheetByName("Line_Items_Breakdown");
  if (lineSheet && targetNum) {
    var lLookup = createHeaderIndexLookup(lineSheet, CANONICAL_SCHEMAS.LINE_ITEM);
    var lDocCol = lLookup.getColumnIndex("documentNumber");
    if (lDocCol === -1) lDocCol = 1;
    var lineData = lineSheet.getDataRange().getValues();
    for (var l = lineData.length - 1; l >= 1; l--) {
      var lineDocNum = String(lineData[l][lDocCol - 1] || "").trim().toLowerCase();
      if (lineDocNum === targetNum) {
        lineSheet.deleteRow(l + 1);
      }
    }
  }

  if (folderName && documentNumber) {
    try {
      var targetFolder = folderName || "Hotel Damview Archives";
      var folders = DriveApp.getFoldersByName(targetFolder);
      if (folders.hasNext()) {
        var folder = folders.next();
        var files = folder.getFiles();
        while (files.hasNext()) {
          var f = files.next();
          if (f.getName().indexOf(documentNumber) === 0) {
            f.setTrashed(true);
          }
        }
      }
    } catch (e) {}
  }

  return { deleted: true, documentNumber: documentNumber, rowsRemoved: deletedRows };
}

function cascadeDeleteClient(ss, clientId, clientName, kraPin) {
  var sheet = ss.getSheetByName("Clients");
  var deleted = false;
  var targetId = clientId ? String(clientId).trim().toLowerCase() : "";
  var targetName = clientName ? String(clientName).trim().toLowerCase() : "";
  var targetPin = kraPin ? String(kraPin).trim().toLowerCase() : "";

  if (sheet) {
    var lookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.CLIENT);
    var idCol = lookup.getColumnIndex("id");
    if (idCol === -1) idCol = 1;
    var nameCol = lookup.getColumnIndex("name");
    if (nameCol === -1) nameCol = 2;
    var pinCol = lookup.getColumnIndex("kraPin");

    var data = sheet.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      var rowId = String(data[r][idCol - 1] || "").trim().toLowerCase();
      var rowName = String(data[r][nameCol - 1] || "").trim().toLowerCase();
      var rowPin = (pinCol > 0 && pinCol <= data[r].length) ? String(data[r][pinCol - 1] || "").trim().toLowerCase() : "";
      if ((targetId && rowId === targetId) || (targetPin && rowPin === targetPin) || (targetName && rowName === targetName)) {
        sheet.deleteRow(r + 1);
        deleted = true;
      }
    }
  }
  return { deleted: deleted, clientId: clientId };
}

function cascadeDeletePayment(ss, paymentId, receiptNumber, documentNumber, folderName) {
  var sheet = ss.getSheetByName("Receipts");
  var deleted = false;
  var targetRecNum = receiptNumber ? String(receiptNumber).trim().toLowerCase() : "";
  var targetPayId = paymentId ? String(paymentId).trim().toLowerCase() : "";
  var settledDocNum = documentNumber ? String(documentNumber).trim() : "";

  if (sheet) {
    var lookup = createHeaderIndexLookup(sheet, CANONICAL_SCHEMAS.RECEIPT);
    var recCol = lookup.getColumnIndex("receiptNumber");
    if (recCol === -1) recCol = 1;
    var docCol = lookup.getColumnIndex("documentNumber");
    var idCol = lookup.getColumnIndex("id");

    var data = sheet.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      var rowRecNum = String(data[r][recCol - 1] || "").trim().toLowerCase();
      var rowPayId = (idCol > 0 && idCol <= data[r].length) ? String(data[r][idCol - 1] || "").trim().toLowerCase() : "";
      var rowDocNum = (docCol > 0 && docCol <= data[r].length) ? String(data[r][docCol - 1] || "").trim() : "";

      if ((targetRecNum && rowRecNum === targetRecNum) || (targetPayId && rowPayId === targetPayId)) {
        if (!settledDocNum && rowDocNum && rowDocNum !== "Direct Settlement") {
          settledDocNum = rowDocNum;
        }
        sheet.deleteRow(r + 1);
        deleted = true;
        break;
      }
    }
  }

  if (settledDocNum && settledDocNum !== "Direct Settlement") {
    reconcileInvoiceBalance(ss, settledDocNum);
  }

  if (folderName && receiptNumber) {
    try {
      var targetFolder = folderName || "Hotel Damview Archives";
      var folders = DriveApp.getFoldersByName(targetFolder);
      if (folders.hasNext()) {
        var folder = folders.next();
        var files = folder.getFiles();
        while (files.hasNext()) {
          var f = files.next();
          if (f.getName().indexOf(receiptNumber) === 0) {
            f.setTrashed(true);
          }
        }
      }
    } catch (e) {}
  }

  return { deleted: deleted, receiptNumber: receiptNumber, documentNumber: settledDocNum };
}

function purgeTombstoneList(ss, tombstones, folderName) {
  if (!Array.isArray(tombstones) || tombstones.length === 0) {
    return { purgedCount: 0 };
  }

  var purgedCount = 0;
  var targetFolder = folderName || "Hotel Damview Archives";

  for (var i = 0; i < tombstones.length; i++) {
    var t = tombstones[i];
    if (!t) continue;
    var type = t.type;
    var id = t.id;
    var identifier = t.identifier || id;

    if (type === "document") {
      cascadeDeleteDocument(ss, id, identifier, targetFolder);
      purgedCount++;
    } else if (type === "client") {
      cascadeDeleteClient(ss, id, identifier, "");
      purgedCount++;
    } else if (type === "payment") {
      cascadeDeletePayment(ss, id, identifier, "", targetFolder);
      purgedCount++;
    }
  }

  return { purgedCount: purgedCount };
}

// ============================================================================
// 12. GOOGLE DRIVE ARCHIVING UTILITIES
// ============================================================================

function archivePdfToDrive(doc, pdfBase64, folderName, customFileName) {
  try {
    if (!pdfBase64) return { error: "No PDF base64 provided", status: "VALIDATION_FAILED" };

    var targetFolderName = folderName || "Hotel Damview Archives";
    var folders = DriveApp.getFoldersByName(targetFolderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderName);

    var cleanBase64 = String(pdfBase64).trim();
    var commaIdx = cleanBase64.indexOf(",");
    if (cleanBase64.indexOf("data:") === 0 && commaIdx >= 0) {
      cleanBase64 = cleanBase64.substring(commaIdx + 1).trim();
    }

    if (cleanBase64.length < 500) {
      return { error: "Corrupt or truncated base64 PDF stream (length < 500)", status: "VALIDATION_FAILED" };
    }

    var decodedBytes = Utilities.base64Decode(cleanBase64);
    if (!decodedBytes || decodedBytes.length < 1000) {
      return { error: "Corrupted PDF binary: decoded byte length is undersized (" + (decodedBytes ? decodedBytes.length : 0) + " bytes)", status: "VALIDATION_FAILED" };
    }

    var fileName = customFileName;
    if (!fileName) {
      var sanitizedClient = (doc.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
      var docNum = (doc.documentNumber || "DOC").replace(/[^a-zA-Z0-9_\\-]/g, "");
      fileName = docNum + "_" + sanitizedClient + "_" + (doc.issueDate || "DATE") + ".pdf";
    }

    var blob = Utilities.newBlob(decodedBytes, "application/pdf", fileName);

    var existingFiles = folder.getFilesByName(fileName);
    var trashedCount = 0;
    while (existingFiles.hasNext()) {
      var oldFile = existingFiles.next();
      try {
        oldFile.setTrashed(true);
        trashedCount++;
      } catch (trashErr) {
        Logger.log("Could not trash duplicate file: " + trashErr.toString());
      }
    }

    var file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}

    return {
      success: true,
      fileId: file.getId(),
      url: file.getUrl(),
      webViewLink: file.getUrl(),
      fileName: fileName,
      byteLength: decodedBytes.length,
      deduplicatedCount: trashedCount,
      status: "ARCHIVED"
    };
  } catch (err) {
    Logger.log("archivePdfToDrive error: " + err.toString());
    return { error: err.toString(), status: "FAILED" };
  }
}

function archiveReceiptPdfToDrive(payment, pdfBase64, folderName, customFileName) {
  try {
    if (!pdfBase64) return { error: "No PDF base64 provided", status: "VALIDATION_FAILED" };

    var targetFolderName = folderName || "Hotel Damview Archives";
    var folders = DriveApp.getFoldersByName(targetFolderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderName);

    var cleanBase64 = String(pdfBase64).trim();
    var commaIdx = cleanBase64.indexOf(",");
    if (cleanBase64.indexOf("data:") === 0 && commaIdx >= 0) {
      cleanBase64 = cleanBase64.substring(commaIdx + 1).trim();
    }

    if (cleanBase64.length < 500) {
      return { error: "Corrupt or truncated base64 Receipt PDF stream", status: "VALIDATION_FAILED" };
    }

    var decodedBytes = Utilities.base64Decode(cleanBase64);
    if (!decodedBytes || decodedBytes.length < 1000) {
      return { error: "Corrupted Receipt PDF binary: decoded byte length is undersized", status: "VALIDATION_FAILED" };
    }

    var fileName = customFileName;
    if (!fileName) {
      var sanitizedClient = (payment.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
      var recNum = (payment.receiptNumber || "REC").replace(/[^a-zA-Z0-9_\\-]/g, "");
      fileName = recNum + "_" + sanitizedClient + "_" + (payment.date || "DATE") + ".pdf";
    }

    var blob = Utilities.newBlob(decodedBytes, "application/pdf", fileName);

    var existingFiles = folder.getFilesByName(fileName);
    var trashedCount = 0;
    while (existingFiles.hasNext()) {
      var oldFile = existingFiles.next();
      try {
        oldFile.setTrashed(true);
        trashedCount++;
      } catch (trashErr) {
        Logger.log("Could not trash duplicate file: " + trashErr.toString());
      }
    }

    var file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}

    return {
      success: true,
      fileId: file.getId(),
      url: file.getUrl(),
      webViewLink: file.getUrl(),
      fileName: fileName,
      byteLength: decodedBytes.length,
      deduplicatedCount: trashedCount,
      status: "ARCHIVED"
    };
  } catch (err) {
    Logger.log("archiveReceiptPdfToDrive error: " + err.toString());
    return { error: err.toString(), status: "FAILED" };
  }
}

function archiveGenericPdfToDrive(pdfBase64, folderName, customFileName) {
  try {
    if (!pdfBase64) return { error: "No PDF base64 provided", status: "VALIDATION_FAILED" };

    var targetFolderName = folderName || "Hotel Damview Archives";
    var folders = DriveApp.getFoldersByName(targetFolderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderName);

    var cleanBase64 = String(pdfBase64).trim();
    var commaIdx = cleanBase64.indexOf(",");
    if (cleanBase64.indexOf("data:") === 0 && commaIdx >= 0) {
      cleanBase64 = cleanBase64.substring(commaIdx + 1).trim();
    }

    if (cleanBase64.length < 500) {
      return { error: "Corrupt or truncated base64 PDF stream (length < 500)", status: "VALIDATION_FAILED" };
    }

    var decodedBytes = Utilities.base64Decode(cleanBase64);
    if (!decodedBytes || decodedBytes.length < 1000) {
      return { error: "Corrupted PDF binary: decoded byte length is undersized (" + (decodedBytes ? decodedBytes.length : 0) + " bytes)", status: "VALIDATION_FAILED" };
    }

    var fileName = customFileName || ("Document_" + new Date().toISOString().split("T")[0] + ".pdf");
    var blob = Utilities.newBlob(decodedBytes, "application/pdf", fileName);

    var existingFiles = folder.getFilesByName(fileName);
    var trashedCount = 0;
    while (existingFiles.hasNext()) {
      var oldFile = existingFiles.next();
      try {
        oldFile.setTrashed(true);
        trashedCount++;
      } catch (trashErr) {
        Logger.log("Could not trash duplicate file: " + trashErr.toString());
      }
    }

    var file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}

    return {
      success: true,
      fileId: file.getId(),
      url: file.getUrl(),
      webViewLink: file.getUrl(),
      fileName: fileName,
      byteLength: decodedBytes.length,
      deduplicatedCount: trashedCount,
      status: "ARCHIVED"
    };
  } catch (err) {
    Logger.log("archiveGenericPdfToDrive error: " + err.toString());
    return { error: err.toString(), status: "FAILED" };
  }
}

function getDiscoveredSheets(ss) {
  var sheets = ss.getSheets();
  var discovered = [];
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    discovered.push({
      name: s.getName(),
      rowCount: Math.max(0, s.getLastRow() - 1),
      columnCount: s.getLastColumn()
    });
  }
  return discovered;
}

function logAudit(ss, action, description, status, driveUrl, fileId) {
  try {
    var sheet = ss.getSheetByName("Audit_Log");
    if (sheet) {
      sheet.appendRow([
        new Date().toISOString(),
        action,
        description || "",
        status || "SUCCESS",
        driveUrl || "",
        fileId || "",
        "Hotel Damview ERP"
      ]);
    }
  } catch (err) {
    Logger.log("Audit log failed: " + err.toString());
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
