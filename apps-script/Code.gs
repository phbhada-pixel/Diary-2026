/**
 * ============================================================================
 * प्राथमिक आरोग्य केंद्र भादा — मासिक दौरा दैनंदिनी व्यवस्थापन प्रणाली
 * Google Apps Script Backend API (Code.gs)
 * Google Account: phbhada@gmail.com
 * Primary & Permanent Database: Single Google Spreadsheet in Personal Drive
 * ============================================================================
 *
 * SETUP INSTRUCTIONS (Script Properties):
 * 1. Open script.google.com signed in as phbhada@gmail.com
 * 2. Paste this entire file into Code.gs and Save.
 * 3. Go to Project Settings (gear icon) -> Script Properties -> Add script property:
 *      Property: APP_SECRET_TOKEN
 *      Value:    <your-strong-secret-token>  (must match GOOGLE_APPS_SCRIPT_SECRET in app)
 *    (Optional) To pin an existing spreadsheet, also add:
 *      Property: SPREADSHEET_ID
 *      Value:    <your-spreadsheet-id>
 * 4. Click Deploy -> New deployment -> Web app:
 *      - Execute as: Me (phbhada@gmail.com)
 *      - Who has access: Anyone
 * 5. Copy the Web App URL (.../exec) and set GOOGLE_APPS_SCRIPT_URL and
 *    GOOGLE_APPS_SCRIPT_SECRET in your application's server environment secrets.
 */

var APP_SPREADSHEET_TITLE = 'PHC_Bhada_Monthly_Tour_Diary_DB';
var PROP_SECRET_TOKEN = 'APP_SECRET_TOKEN';
var PROP_SPREADSHEET_ID = 'SPREADSHEET_ID';

var SHEET_NAMES = {
  Employee_Master: 'Employee_Master',
  Village_Master: 'Village_Master',
  Subcenter_Master: 'Subcenter_Master',
  Weekly_Schedule_Master: 'Weekly_Schedule_Master',
  Government_Holiday_Master: 'Government_Holiday_Master',
  Leave_Management: 'Leave_Management',
  Special_Event_Master: 'Special_Event_Master',
  Monthly_Diary: 'Monthly_Diary',
  Diary_Change_History: 'Diary_Change_History',
  Application_Settings: 'Application_Settings',
};

var ALL_MASTER_SHEETS = [
  SHEET_NAMES.Employee_Master,
  SHEET_NAMES.Village_Master,
  SHEET_NAMES.Subcenter_Master,
  SHEET_NAMES.Weekly_Schedule_Master,
  SHEET_NAMES.Government_Holiday_Master,
  SHEET_NAMES.Leave_Management,
  SHEET_NAMES.Special_Event_Master,
  SHEET_NAMES.Monthly_Diary,
  SHEET_NAMES.Diary_Change_History,
  SHEET_NAMES.Application_Settings,
];

var SHEET_HEADERS = {
  Employee_Master: [
    'Unique_ID',
    'कर्मचाऱ्याचे नाव',
    'पदनाम',
    'कार्यालय',
    'मुख्यालय',
    'ई-मेल',
    'मोबाईल',
    'अंमलबजावणी दिनांक (ISO)',
    'अंमलबजावणी दिनांक',
    'अद्ययावत दिनांक',
  ],
  Village_Master: [
    'Unique_ID',
    'गावाचे नाव',
    'उपकेंद्र ID',
    'उपकेंद्राचे नाव',
    'लोकसंख्या',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Subcenter_Master: [
    'Unique_ID',
    'उपकेंद्राचे नाव',
    'ठिकाण',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Weekly_Schedule_Master: [
    'Unique_ID',
    'Weekday_Key',
    'वार',
    'आठवड्याचा क्रमांक',
    'आठवडा लेबल',
    'गाव ID',
    'गावाचे नाव',
    'उपकेंद्राचे नाव',
    'आरोग्य सेवा सत्राचे स्वरूप',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Government_Holiday_Master: [
    'Unique_ID',
    'वर्ष',
    'तारीख (ISO)',
    'सुट्टीची तारीख',
    'सुट्टीचे नाव',
    'सुट्टीचा प्रकार',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Leave_Management: [
    'Unique_ID',
    'रजेचा प्रकार',
    'सुरुवात (ISO)',
    'समाप्ती (ISO)',
    'सुरुवातीचा दिनांक',
    'समाप्तीचा दिनांक',
    'एकूण दिवस',
    'रजेचे कारण',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Special_Event_Master: [
    'Unique_ID',
    'तारीख (ISO)',
    'दिनांक',
    'कार्यक्रमाचा प्रकार',
    'कोठे',
    'कामाचे स्वरूप',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Monthly_Diary: [
    'Unique_ID',
    'वर्ष',
    'महिना',
    'महिना व वर्ष',
    'Sheet_Name',
    'कर्मचारी नाव',
    'पदनाम',
    'कार्यालय',
    'एकूण दिवस',
    'कामकाजाचे दिवस',
    'रविवार',
    'शासकीय सुट्ट्या',
    'रजा',
    'विशेष कार्यक्रम',
    'मॅन्युअल बदल',
    'Warnings_JSON',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Diary_Change_History: [
    'Unique_ID',
    'दिनांक व वेळ',
    'विभाग',
    'नोंद ID',
    'कृती',
    'तपशील',
    'जुनी माहिती',
    'नवीन माहिती',
  ],
  Application_Settings: [
    'Unique_ID',
    'सुट्टी समायोजन दिशा',
    'कोठून (मुख्यालय)',
    'अंमलबजावणी दिनांक',
    'आर्थिक वर्ष सुरुवात महिना',
    'मुख्यालय नाव',
    'कार्यालय नाव',
    'तालुका बैठक ठिकाण',
    'उपकेंद्र बैठक १',
    'उपकेंद्र बैठक २',
    'अद्ययावत दिनांक',
  ],
};

var MONTHLY_SHEET_TABLE_HEADERS = [
  'अनुक्रमांक',
  'दिनांक',
  'वार',
  'कोठून',
  'कोठे',
  'कामाचे स्वरूप',
  'प्रकार',
  'मूळ नियोजित तारीख',
  'समायोजित तारीख',
  'मॅन्युअल संपादन',
  'टिप्पणी',
  'Date_ISO',
  'Entry_Type_Key',
  'Original_Date_ISO',
  'Adjusted_Date_ISO',
  'Source_ID',
];

var WEEKDAY_LABELS = {
  monday: 'सोमवार',
  tuesday: 'मंगळवार',
  thursday: 'गुरुवार',
  friday: 'शुक्रवार',
  saturday: 'शनिवार',
};

var WEEK_OCCURRENCE_LABELS = {
  1: 'पहिला',
  2: 'दुसरा',
  3: 'तिसरा',
  4: 'चौथा',
  5: 'पाचवा',
};

var ENTRY_TYPE_LABELS = {
  sunday: 'रविवार',
  holiday: 'शासकीय सुट्टी',
  leave: 'रजा',
  special_event: 'विशेष कार्यक्रम',
  wednesday_weekly: 'आठवडी बैठक',
  wednesday_hq: 'बुधवार मुख्यालय बैठक',
  wednesday_asha: 'आशा बैठक व मासिक आढावा',
  district_meeting: 'जिल्हास्तरीय बैठक',
  taluka_meeting: 'तालुकास्तरीय आढावा बैठक',
  subcenter_meeting: 'उपकेंद्रस्तरीय बैठक',
  weekly_schedule: 'वारनिहाय आरोग्य सेवा सत्र',
  adjusted_schedule: 'वारनिहाय आरोग्य सेवा सत्र',
  office_work: 'कार्यालयीन कामकाज',
};

var MARATHI_DAYS = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

var DEFAULT_EMPLOYEE = {
  id: 'emp_primary',
  fullName: 'श्री. हिप्परगेकर जी. एस.',
  designation: 'आरोग्य सहाय्यक',
  officeName: 'प्राथमिक आरोग्य केंद्र भादा',
  headquarters: 'भादा',
  email: 'phbhada@gmail.com',
  mobile: '',
  implementationDate: '2026-04-01',
};

var DEFAULT_SETTINGS = {
  id: 'settings_primary',
  holidayAdjustmentDirection: 'next',
  defaultFromPlace: 'भादा',
  implementationDate: '2026-04-01',
  financialYearStartMonth: 4,
  hqPlace: 'प्राथमिक आरोग्य केंद्र भादा मुख्यालय',
  officePlace: 'प्राथमिक आरोग्य केंद्र भादा',
  talukaMeetingPlace: 'तालुका आरोग्य अधिकारी कार्यालय, औसा',
  subcenterMeeting1Place: 'उपकेंद्र आलमला',
  subcenterMeeting2Place: 'उपकेंद्र लखनगाव',
};

// ============================================================================
// HTTP Entry Points: doGet(e) & doPost(e)
// ============================================================================

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    validateSecretToken_(params.token);

    var action = String(params.action || 'checkDatabaseConnection').trim();
    if (action === 'checkDatabaseConnection') {
      return jsonResponse_({ ok: true, data: checkDatabaseConnection() });
    }
    if (action === 'getApplicationSettings') {
      return jsonResponse_({ ok: true, data: getApplicationSettings() });
    }
    if (action === 'bootstrap') {
      return jsonResponse_({ ok: true, data: getBootstrapBundle_() });
    }
    if (action === 'getRecords') {
      var sheetName = String(params.sheetName || '').trim();
      var yearFilter = params.year ? Number(params.year) : undefined;
      return jsonResponse_({ ok: true, data: getRecords(sheetName, { year: yearFilter }) });
    }
    if (action === 'getMonthlyDiary') {
      var id = String(params.id || '').trim();
      return jsonResponse_({ ok: true, data: getMonthlyDiaryById_(id) });
    }

    return jsonResponse_({ ok: false, status: 400, error: 'अवैध विनंती क्रिया (action): ' + action });
  } catch (err) {
    return errorJsonResponse_(err);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    var rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body;
    try {
      body = JSON.parse(rawBody);
    } catch (_parseErr) {
      throw createAppError_('अवैध JSON विनंती प्राप्त झाली.', 400);
    }

    validateSecretToken_(body.token || (e && e.parameter && e.parameter.token));

    var action = String(body.action || '').trim();
    var payload = body.payload || {};

    // Read-only actions do not need exclusive write lock
    if (action === 'bootstrap') {
      return jsonResponse_({ ok: true, data: getBootstrapBundle_() });
    }
    if (action === 'getRecords') {
      return jsonResponse_({ ok: true, data: getRecords(payload.sheetName, payload.filters || {}) });
    }
    if (action === 'getApplicationSettings') {
      return jsonResponse_({ ok: true, data: getApplicationSettings() });
    }
    if (action === 'getMonthlyDiary') {
      return jsonResponse_({ ok: true, data: getMonthlyDiaryById_(payload.id) });
    }

    // Acquire script lock for all mutating / initialization operations to prevent data corruption
    lockAcquired = lock.tryLock(30000);
    if (!lockAcquired) {
      throw createAppError_('डेटाबेस सध्या व्यस्त आहे. कृपया काही सेकंदांनी पुन्हा प्रयत्न करा.', 503);
    }

    if (action === 'checkDatabaseConnection') {
      return jsonResponse_({ ok: true, data: checkDatabaseConnection() });
    }
    if (action === 'initializeSpreadsheet') {
      var ss = initializeSpreadsheet();
      return jsonResponse_({
        ok: true,
        data: { spreadsheetId: ss.getId(), spreadsheetTitle: ss.getName(), initialized: true },
      });
    }
    if (action === 'addRecord') {
      return jsonResponse_({ ok: true, data: addRecord(payload.sheetName, payload.record, payload.historySummary) });
    }
    if (action === 'updateRecord') {
      return jsonResponse_({
        ok: true,
        data: updateRecord(payload.sheetName, payload.uniqueId, payload.updates, payload.historySummary),
      });
    }
    if (action === 'deleteRecord') {
      return jsonResponse_({
        ok: true,
        data: deleteRecord(payload.sheetName, payload.uniqueId, payload.historySummary),
      });
    }
    if (action === 'generateMonthlyDiary') {
      return jsonResponse_({
        ok: true,
        data: generateMonthlyDiary(payload.diaryDocument, payload.historyAction),
      });
    }
    if (action === 'deleteMonthlyDiary') {
      return jsonResponse_({ ok: true, data: deleteMonthlyDiary_(payload.id) });
    }
    if (action === 'restoreBackup') {
      return jsonResponse_({ ok: true, data: restoreBackup_(payload.data) });
    }

    throw createAppError_('अवैध विनंती क्रिया (action): ' + action, 400);
  } catch (err) {
    return errorJsonResponse_(err);
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (_ignore) {}
    }
  }
}

// ============================================================================
// Security: Secret Token Validation (Stored in Script Properties)
// ============================================================================

function validateSecretToken_(providedToken) {
  var expected = PropertiesService.getScriptProperties().getProperty(PROP_SECRET_TOKEN);
  if (!expected || !String(expected).trim()) {
    throw createAppError_(
      'Apps Script मध्ये APP_SECRET_TOKEN (Script Property) सेट केलेला नाही. कृपया Project Settings -> Script Properties मध्ये APP_SECRET_TOKEN सेट करा.',
      500
    );
  }
  if (!providedToken || String(providedToken).trim() !== String(expected).trim()) {
    throw createAppError_('Secret Token चुकीचा आहे.', 401);
  }
}

// ============================================================================
// Core Mandatory Functions
// ============================================================================

/**
 * Resolves or creates EXACTLY ONE Google Spreadsheet in personal Drive (phbhada@gmail.com)
 * and ensures all 10 required master sheets + headers + safe defaults exist.
 */
function initializeSpreadsheet() {
  var ss = getOrCreateSingleSpreadsheet_();
  createRequiredSheets(ss);
  return ss;
}

/**
 * Creates all 10 Master Sheets inside the single spreadsheet if missing (never recreates existing).
 * Adds headers with Unique_ID as Column A, and seeds/backfills default Employee & Settings non-destructively.
 */
function createRequiredSheets(ss) {
  var targetSs = ss || getOrCreateSingleSpreadsheet_();
  var now = new Date().toISOString();

  for (var i = 0; i < ALL_MASTER_SHEETS.length; i++) {
    var name = ALL_MASTER_SHEETS[i];
    var sheet = targetSs.getSheetByName(name);
    if (!sheet) {
      sheet = targetSs.insertSheet(name);
      sheet.setFrozenRows(1);
    }

    var headers = SHEET_HEADERS[name];
    var lastRow = sheet.getLastRow();

    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);

      if (name === SHEET_NAMES.Employee_Master) {
        var defEmp = objectAssign_({}, DEFAULT_EMPLOYEE, { updatedAt: now });
        sheet.getRange(2, 1, 1, headers.length).setValues([employeeToRow_(defEmp)]);
      } else if (name === SHEET_NAMES.Application_Settings) {
        var defSet = objectAssign_({}, DEFAULT_SETTINGS, { updatedAt: now });
        sheet.getRange(2, 1, 1, headers.length).setValues([settingsToRow_(defSet)]);
      } else if (name === SHEET_NAMES.Subcenter_Master) {
        var subRows = [
          subcenterToRow_({
            id: 'sub_alamla',
            name: 'उपकेंद्र आलमला',
            location: 'आलमला',
            notes: 'नियम ३ नुसार मासिक उपकेंद्रस्तरीय बैठक',
            createdAt: now,
            updatedAt: now,
          }),
          subcenterToRow_({
            id: 'sub_lakhangaon',
            name: 'उपकेंद्र लखनगाव',
            location: 'लखनगाव',
            notes: 'नियम ३ नुसार मासिक उपकेंद्रस्तरीय बैठक',
            createdAt: now,
            updatedAt: now,
          }),
        ];
        sheet.getRange(2, 1, subRows.length, headers.length).setValues(subRows);
      }
    } else {
      // Preserve existing user data; check header row and backfill ONLY missing required fields
      var topRowsCount = Math.min(lastRow, 2);
      var topValues = sheet.getRange(1, 1, topRowsCount, headers.length).getDisplayValues();
      var row1Blank = isRowEmpty_(topValues[0]);
      if (row1Blank) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      if (name === SHEET_NAMES.Employee_Master) {
        if (lastRow < 2 || isRowEmpty_(topValues[1])) {
          var empSeed = objectAssign_({}, DEFAULT_EMPLOYEE, { updatedAt: now });
          sheet.getRange(2, 1, 1, headers.length).setValues([employeeToRow_(empSeed)]);
        } else if (needsEmployeeBackfill_(topValues[1])) {
          var empNorm = rowToEmployee_(topValues[1]);
          empNorm.updatedAt = now;
          sheet.getRange(2, 1, 1, headers.length).setValues([employeeToRow_(empNorm)]);
        }
      } else if (name === SHEET_NAMES.Application_Settings) {
        if (lastRow < 2 || isRowEmpty_(topValues[1])) {
          var setSeed = objectAssign_({}, DEFAULT_SETTINGS, { updatedAt: now });
          sheet.getRange(2, 1, 1, headers.length).setValues([settingsToRow_(setSeed)]);
        } else if (needsSettingsBackfill_(topValues[1])) {
          var setNorm = rowToSettings_(topValues[1]);
          setNorm.updatedAt = now;
          sheet.getRange(2, 1, 1, headers.length).setValues([settingsToRow_(setNorm)]);
        }
      }
    }
  }

  // Clean up default blank "Sheet1" if all 10 master sheets exist and Sheet1 is completely empty
  var defaultSheet1 = targetSs.getSheetByName('Sheet1');
  if (defaultSheet1 && defaultSheet1.getLastRow() === 0 && targetSs.getSheets().length > ALL_MASTER_SHEETS.length) {
    try {
      targetSs.deleteSheet(defaultSheet1);
    } catch (_ignore) {}
  }

  SpreadsheetApp.flush();
  return ALL_MASTER_SHEETS;
}

/**
 * Reads all valid records from a Master Sheet.
 */
function getRecords(sheetName, filters) {
  assertValidMasterSheet_(sheetName);
  var ss = initializeSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw createAppError_('Sheet अस्तित्वात नाही: ' + sheetName, 404);
  }

  var rows = readDataRows_(sheet, SHEET_HEADERS[sheetName].length);
  var records = [];

  for (var i = 0; i < rows.length; i++) {
    var rec = mapRowToEntity_(sheetName, rows[i].values);
    if (rec) records.push(rec);
  }

  if (sheetName === SHEET_NAMES.Government_Holiday_Master && filters && filters.year) {
    var yr = Number(filters.year);
    records = records.filter(function (h) {
      return Number(h.year) === yr;
    });
  }

  if (sheetName === SHEET_NAMES.Diary_Change_History) {
    records.sort(function (a, b) {
      return String(b.changeDate || '').localeCompare(String(a.changeDate || ''));
    });
    var lim = (filters && Number(filters.limit)) || 200;
    return records.slice(0, lim);
  }

  return sortRecords_(sheetName, records);
}

/**
 * Adds a new record directly to Google Sheets with Unique_ID and duplicate prevention.
 */
function addRecord(sheetName, record, historySummary) {
  assertValidMasterSheet_(sheetName);
  if (!record || typeof record !== 'object') {
    throw createAppError_('डेटा सेव्ह होत नाही: अवैध माहिती पाठवली आहे.', 400);
  }

  var ss = initializeSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw createAppError_('Sheet अस्तित्वात नाही: ' + sheetName, 404);
  }

  var existingRows = readDataRows_(sheet, SHEET_HEADERS[sheetName].length);
  var now = new Date().toISOString();
  var created;

  if (sheetName === SHEET_NAMES.Subcenter_Master) {
    var cleanSubName = String(record.name || '').trim();
    if (!cleanSubName) throw createAppError_('उपकेंद्राचे नाव आवश्यक आहे.', 400);
    for (var s = 0; s < existingRows.length; s++) {
      if (String(existingRows[s].values[1] || '').trim().toLowerCase() === cleanSubName.toLowerCase()) {
        throw createAppError_('Duplicate Record आढळला: या नावाचे उपकेंद्र आधीच Google Sheets मध्ये नोंदवलेले आहे.', 409);
      }
    }
    created = {
      id: record.id || generateUniqueId_('sub'),
      name: cleanSubName,
      location: String(record.location || '').trim(),
      notes: String(record.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
  } else if (sheetName === SHEET_NAMES.Village_Master) {
    var cleanVilName = String(record.name || '').trim();
    if (!cleanVilName) throw createAppError_('गावाचे नाव आवश्यक आहे.', 400);
    for (var v = 0; v < existingRows.length; v++) {
      if (String(existingRows[v].values[1] || '').trim().toLowerCase() === cleanVilName.toLowerCase()) {
        throw createAppError_('Duplicate Record आढळला: या नावाचे गाव आधीच Google Sheets मध्ये नोंदवलेले आहे.', 409);
      }
    }
    created = {
      id: record.id || generateUniqueId_('vil'),
      name: cleanVilName,
      subcenterId: String(record.subcenterId || '').trim(),
      subcenterName: String(record.subcenterName || '').trim(),
      population: String(record.population || '').trim(),
      notes: String(record.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
  } else if (sheetName === SHEET_NAMES.Weekly_Schedule_Master) {
    var wd = String(record.weekday || '').trim();
    var wk = Number(record.weekNumber);
    for (var w = 0; w < existingRows.length; w++) {
      if (String(existingRows[w].values[1] || '').trim() === wd && Number(existingRows[w].values[3]) === wk) {
        throw createAppError_(
          'Duplicate Record आढळला: या वाराच्या या आठवड्यासाठी आधीच कार्यक्रम नोंदवलेला आहे. कृपया तो संपादित (Edit) करा.',
          409
        );
      }
    }
    created = {
      id: record.id || generateUniqueId_('ws'),
      weekday: wd,
      weekNumber: wk,
      villageId: String(record.villageId || '').trim(),
      villageName: String(record.villageName || '').trim(),
      subcenterName: String(record.subcenterName || '').trim(),
      sessionType: String(record.sessionType || '').trim(),
      notes: String(record.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
  } else if (sheetName === SHEET_NAMES.Government_Holiday_Master) {
    var hDate = String(record.date || '').trim();
    for (var h = 0; h < existingRows.length; h++) {
      if (String(existingRows[h].values[2] || '').trim() === hDate) {
        throw createAppError_('Duplicate Record आढळला: या तारखेला आधीच शासकीय सुट्टी नोंदवलेली आहे.', 409);
      }
    }
    created = {
      id: record.id || generateUniqueId_('hol'),
      date: hDate,
      year: Number(hDate.slice(0, 4)) || Number(record.year),
      name: String(record.name || '').trim(),
      holidayType: String(record.holidayType || 'सार्वजनिक सुट्टी').trim(),
      notes: String(record.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
  } else if (sheetName === SHEET_NAMES.Leave_Management) {
    created = {
      id: record.id || generateUniqueId_('lv'),
      leaveType: String(record.leaveType || '').trim(),
      startDate: String(record.startDate || '').trim(),
      endDate: String(record.endDate || '').trim(),
      totalDays: Number(record.totalDays) || 1,
      reason: String(record.reason || '').trim(),
      notes: String(record.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
  } else if (sheetName === SHEET_NAMES.Special_Event_Master) {
    var evDate = String(record.date || '').trim();
    if (evDate.indexOf('WORK_LOG_') !== 0) {
      for (var ev = 0; ev < existingRows.length; ev++) {
        if (String(existingRows[ev].values[1] || '').trim() === evDate) {
          throw createAppError_('Duplicate Record आढळला: या तारखेला आधीच विशेष कार्यक्रम नोंदवलेला आहे.', 409);
        }
      }
    }
    created = {
      id: record.id || generateUniqueId_('ev'),
      date: evDate,
      eventType: String(record.eventType || 'इतर विशेष शासकीय कार्यक्रम').trim(),
      location: String(record.location || '').trim(),
      workDescription: String(record.workDescription || '').trim(),
      notes: String(record.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
  } else {
    throw createAppError_('या शीटसाठी थेट नोंद जोडण्याची परवानगी नाही: ' + sheetName, 400);
  }

  var rowValues = mapEntityToRow_(sheetName, created);
  sheet.appendRow(rowValues);
  SpreadsheetApp.flush();

  appendHistory_(ss, {
    entityType: sheetName,
    entityId: created.id,
    action: 'CREATE',
    summary: historySummary || ('नवीन नोंद जोडली: ' + sheetName),
    oldData: null,
    newData: JSON.stringify(created),
  });

  return created;
}

/**
 * Updates an existing record in Google Sheets strictly by Unique_ID (Column A).
 */
function updateRecord(sheetName, uniqueId, updates, historySummary) {
  assertValidMasterSheet_(sheetName);
  var ss = initializeSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw createAppError_('Sheet अस्तित्वात नाही: ' + sheetName, 404);
  }

  var headersLen = SHEET_HEADERS[sheetName].length;
  var existingRows = readDataRows_(sheet, headersLen);
  var now = new Date().toISOString();

  // Singleton entities: Employee_Master & Application_Settings
  if (sheetName === SHEET_NAMES.Employee_Master) {
    var empTarget = existingRows.length > 0 ? existingRows[0] : null;
    var prevEmp = empTarget ? rowToEmployee_(empTarget.values) : objectAssign_({}, DEFAULT_EMPLOYEE, { updatedAt: now });
    var nextEmp = {
      id: prevEmp.id || DEFAULT_EMPLOYEE.id,
      fullName: String(updates.fullName !== undefined ? updates.fullName : prevEmp.fullName).trim(),
      designation: String(updates.designation !== undefined ? updates.designation : prevEmp.designation).trim(),
      officeName: String(updates.officeName !== undefined ? updates.officeName : prevEmp.officeName).trim(),
      headquarters: String(updates.headquarters !== undefined ? updates.headquarters : prevEmp.headquarters).trim() || 'भादा',
      email: String(updates.email !== undefined ? updates.email : prevEmp.email).trim(),
      mobile: String(updates.mobile !== undefined ? updates.mobile : prevEmp.mobile).trim(),
      implementationDate: String(updates.implementationDate || prevEmp.implementationDate || '2026-04-01').trim(),
      updatedAt: now,
    };
    var empRow = employeeToRow_(nextEmp);
    if (empTarget) {
      sheet.getRange(empTarget.rowNumber, 1, 1, empRow.length).setValues([empRow]);
    } else {
      sheet.appendRow(empRow);
    }
    SpreadsheetApp.flush();
    appendHistory_(ss, {
      entityType: SHEET_NAMES.Employee_Master,
      entityId: nextEmp.id,
      action: 'UPDATE',
      summary: historySummary || ('कर्मचारी माहिती अद्ययावत: ' + nextEmp.fullName),
      oldData: JSON.stringify(prevEmp),
      newData: JSON.stringify(nextEmp),
    });
    return nextEmp;
  }

  if (sheetName === SHEET_NAMES.Application_Settings) {
    var setTarget = existingRows.length > 0 ? existingRows[0] : null;
    var prevSet = setTarget ? rowToSettings_(setTarget.values) : objectAssign_({}, DEFAULT_SETTINGS, { updatedAt: now });
    var dir = updates.holidayAdjustmentDirection === 'previous' ? 'previous' : 'next';
    var nextSet = {
      id: prevSet.id || DEFAULT_SETTINGS.id,
      holidayAdjustmentDirection: dir,
      defaultFromPlace: String(updates.defaultFromPlace || prevSet.defaultFromPlace || 'भादा').trim(),
      implementationDate: String(updates.implementationDate || prevSet.implementationDate || '2026-04-01').trim(),
      financialYearStartMonth: Number(updates.financialYearStartMonth || prevSet.financialYearStartMonth) || 4,
      hqPlace: String(updates.hqPlace || prevSet.hqPlace).trim(),
      officePlace: String(updates.officePlace || prevSet.officePlace).trim(),
      talukaMeetingPlace: String(updates.talukaMeetingPlace || prevSet.talukaMeetingPlace).trim(),
      subcenterMeeting1Place: String(updates.subcenterMeeting1Place || prevSet.subcenterMeeting1Place).trim(),
      subcenterMeeting2Place: String(updates.subcenterMeeting2Place || prevSet.subcenterMeeting2Place).trim(),
      updatedAt: now,
    };
    var setRow = settingsToRow_(nextSet);
    if (setTarget) {
      sheet.getRange(setTarget.rowNumber, 1, 1, setRow.length).setValues([setRow]);
    } else {
      sheet.appendRow(setRow);
    }
    SpreadsheetApp.flush();
    appendHistory_(ss, {
      entityType: SHEET_NAMES.Application_Settings,
      entityId: nextSet.id,
      action: 'UPDATE',
      summary: historySummary || ('सेटिंग्ज अद्ययावत (सुट्टी समायोजन दिशा: ' + (dir === 'next' ? 'पुढील दिवस' : 'मागील दिवस') + ')'),
      oldData: JSON.stringify(prevSet),
      newData: JSON.stringify(nextSet),
    });
    return nextSet;
  }

  var target = null;
  for (var i = 0; i < existingRows.length; i++) {
    if (String(existingRows[i].values[0] || '').trim() === String(uniqueId || '').trim()) {
      target = existingRows[i];
      break;
    }
  }
  if (!target) {
    throw createAppError_('Update किंवा Delete अयशस्वी झाले: संबंधित Unique_ID नोंद आढळली नाही.', 404);
  }

  var prev = mapRowToEntity_(sheetName, target.values);
  var updated;

  if (sheetName === SHEET_NAMES.Subcenter_Master) {
    var cleanSub = String(updates.name || '').trim();
    for (var s = 0; s < existingRows.length; s++) {
      if (existingRows[s].rowNumber !== target.rowNumber &&
          String(existingRows[s].values[1] || '').trim().toLowerCase() === cleanSub.toLowerCase()) {
        throw createAppError_('Duplicate Record आढळला: या नावाचे उपकेंद्र आधीच नोंदवलेले आहे.', 409);
      }
    }
    updated = objectAssign_({}, prev, {
      name: cleanSub,
      location: String(updates.location || '').trim(),
      notes: String(updates.notes || '').trim(),
      updatedAt: now,
    });
  } else if (sheetName === SHEET_NAMES.Village_Master) {
    var cleanVil = String(updates.name || '').trim();
    for (var v = 0; v < existingRows.length; v++) {
      if (existingRows[v].rowNumber !== target.rowNumber &&
          String(existingRows[v].values[1] || '').trim().toLowerCase() === cleanVil.toLowerCase()) {
        throw createAppError_('Duplicate Record आढळला: या नावाचे गाव आधीच नोंदवलेले आहे.', 409);
      }
    }
    updated = objectAssign_({}, prev, {
      name: cleanVil,
      subcenterId: String(updates.subcenterId || '').trim(),
      subcenterName: String(updates.subcenterName || '').trim(),
      population: String(updates.population || '').trim(),
      notes: String(updates.notes || '').trim(),
      updatedAt: now,
    });
  } else if (sheetName === SHEET_NAMES.Weekly_Schedule_Master) {
    var wd = String(updates.weekday || prev.weekday).trim();
    var wk = Number(updates.weekNumber || prev.weekNumber);
    for (var w = 0; w < existingRows.length; w++) {
      if (existingRows[w].rowNumber !== target.rowNumber &&
          String(existingRows[w].values[1] || '').trim() === wd &&
          Number(existingRows[w].values[3]) === wk) {
        throw createAppError_('Duplicate Record आढळला: निवडलेल्या वार व आठवड्यासाठी आधीच दुसरा कार्यक्रम नोंदवलेला आहे.', 409);
      }
    }
    updated = objectAssign_({}, prev, {
      weekday: wd,
      weekNumber: wk,
      villageId: String(updates.villageId || '').trim(),
      villageName: String(updates.villageName || '').trim(),
      subcenterName: String(updates.subcenterName || '').trim(),
      sessionType: String(updates.sessionType || '').trim(),
      notes: String(updates.notes || '').trim(),
      updatedAt: now,
    });
  } else if (sheetName === SHEET_NAMES.Government_Holiday_Master) {
    var hDate = String(updates.date || '').trim();
    for (var h = 0; h < existingRows.length; h++) {
      if (existingRows[h].rowNumber !== target.rowNumber &&
          String(existingRows[h].values[2] || '').trim() === hDate) {
        throw createAppError_('Duplicate Record आढळला: या तारखेला आधीच दुसरी शासकीय सुट्टी नोंदवलेली आहे.', 409);
      }
    }
    updated = objectAssign_({}, prev, {
      date: hDate,
      year: Number(hDate.slice(0, 4)) || prev.year,
      name: String(updates.name || '').trim(),
      holidayType: String(updates.holidayType || 'सार्वजनिक सुट्टी').trim(),
      notes: String(updates.notes || '').trim(),
      updatedAt: now,
    });
  } else if (sheetName === SHEET_NAMES.Leave_Management) {
    updated = objectAssign_({}, prev, {
      leaveType: String(updates.leaveType || '').trim(),
      startDate: String(updates.startDate || '').trim(),
      endDate: String(updates.endDate || '').trim(),
      totalDays: Number(updates.totalDays) || prev.totalDays,
      reason: String(updates.reason || '').trim(),
      notes: String(updates.notes || '').trim(),
      updatedAt: now,
    });
  } else if (sheetName === SHEET_NAMES.Special_Event_Master) {
    var evDate = String(updates.date || '').trim();
    for (var ev = 0; ev < existingRows.length; ev++) {
      if (existingRows[ev].rowNumber !== target.rowNumber &&
          String(existingRows[ev].values[1] || '').trim() === evDate) {
        throw createAppError_('Duplicate Record आढळला: या तारखेला आधीच दुसरा विशेष कार्यक्रम नोंदवलेला आहे.', 409);
      }
    }
    updated = objectAssign_({}, prev, {
      date: evDate,
      eventType: String(updates.eventType || 'इतर विशेष शासकीय कार्यक्रम').trim(),
      location: String(updates.location || '').trim(),
      workDescription: String(updates.workDescription || '').trim(),
      notes: String(updates.notes || '').trim(),
      updatedAt: now,
    });
  } else {
    throw createAppError_('Update अयशस्वी झाले: अवैध शीट ' + sheetName, 400);
  }

  var nextRow = mapEntityToRow_(sheetName, updated);
  sheet.getRange(target.rowNumber, 1, 1, nextRow.length).setValues([nextRow]);

  // Keep linked villages in sync if a subcenter is renamed
  if (sheetName === SHEET_NAMES.Subcenter_Master && prev.name !== updated.name) {
    var vilSheet = ss.getSheetByName(SHEET_NAMES.Village_Master);
    if (vilSheet) {
      var vilRows = readDataRows_(vilSheet, SHEET_HEADERS.Village_Master.length);
      for (var vr = 0; vr < vilRows.length; vr++) {
        var vObj = rowToVillage_(vilRows[vr].values);
        if (vObj.subcenterId === updated.id) {
          vObj.subcenterName = updated.name;
          vObj.updatedAt = now;
          var vRow = villageToRow_(vObj);
          vilSheet.getRange(vilRows[vr].rowNumber, 1, 1, vRow.length).setValues([vRow]);
        }
      }
    }
  }

  SpreadsheetApp.flush();

  appendHistory_(ss, {
    entityType: sheetName,
    entityId: updated.id,
    action: 'UPDATE',
    summary: historySummary || ('नोंद अद्ययावत केली: ' + sheetName),
    oldData: JSON.stringify(prev),
    newData: JSON.stringify(updated),
  });

  if (sheetName === SHEET_NAMES.Leave_Management) {
    return { prev: prev, updated: updated };
  }
  return updated;
}

/**
 * Deletes the exact row matching Unique_ID from Google Sheets.
 */
function deleteRecord(sheetName, uniqueId, historySummary) {
  assertValidMasterSheet_(sheetName);
  var ss = initializeSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw createAppError_('Sheet अस्तित्वात नाही: ' + sheetName, 404);
  }

  var rows = readDataRows_(sheet, SHEET_HEADERS[sheetName].length);
  var target = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].values[0] || '').trim() === String(uniqueId || '').trim()) {
      target = rows[i];
      break;
    }
  }
  if (!target) {
    throw createAppError_('Update किंवा Delete अयशस्वी झाले: संबंधित नोंद आढळली नाही.', 404);
  }

  var prev = mapRowToEntity_(sheetName, target.values);
  sheet.deleteRow(target.rowNumber);
  SpreadsheetApp.flush();

  appendHistory_(ss, {
    entityType: sheetName,
    entityId: String(uniqueId),
    action: 'DELETE',
    summary: historySummary || ('नोंद हटवली: ' + sheetName),
    oldData: JSON.stringify(prev),
    newData: null,
  });

  return { deleted: true, previous: prev };
}

/**
 * Creates/updates a dedicated monthly tab (e.g. April_2026, May_2026) inside the SAME spreadsheet
 * and upserts the summary index row in Monthly_Diary (never creates duplicate sheets or rows).
 */
function generateMonthlyDiary(diaryDoc, historyAction) {
  if (!diaryDoc || !diaryDoc.id || !diaryDoc.sheetName || !Array.isArray(diaryDoc.entries)) {
    throw createAppError_('डेटा सेव्ह होत नाही: मासिक दैनंदिनीचा तपशील अपूर्ण आहे.', 400);
  }

  var ss = initializeSpreadsheet();
  var tabName = String(diaryDoc.sheetName).trim();
  var monthSheet = ss.getSheetByName(tabName);
  if (!monthSheet) {
    monthSheet = ss.insertSheet(tabName);
  }

  var sheetValues = buildMonthlyDiarySheetValues_(diaryDoc);
  monthSheet.clearContents();
  if (sheetValues.length > 0) {
    // Pad all rows to uniform width for setValues()
    var maxCols = MONTHLY_SHEET_TABLE_HEADERS.length;
    var padded = sheetValues.map(function (r) {
      var out = r.slice(0, maxCols);
      while (out.length < maxCols) out.push('');
      return out;
    });
    monthSheet.getRange(1, 1, padded.length, maxCols).setValues(padded);
    monthSheet.setFrozenRows(6);
  }

  // Upsert index row in Monthly_Diary by Unique_ID
  var indexSheet = ss.getSheetByName(SHEET_NAMES.Monthly_Diary);
  var indexRows = readDataRows_(indexSheet, SHEET_HEADERS.Monthly_Diary.length);
  var existing = null;
  for (var i = 0; i < indexRows.length; i++) {
    if (String(indexRows[i].values[0] || '').trim() === String(diaryDoc.id).trim()) {
      existing = indexRows[i];
      break;
    }
  }

  var indexRow = monthlyDiaryIndexToRow_(diaryDoc);
  if (existing) {
    indexSheet.getRange(existing.rowNumber, 1, 1, indexRow.length).setValues([indexRow]);
  } else {
    indexSheet.appendRow(indexRow);
  }

  SpreadsheetApp.flush();

  if (historyAction && historyAction.summary) {
    appendHistory_(ss, {
      entityType: SHEET_NAMES.Monthly_Diary,
      entityId: diaryDoc.id,
      action: historyAction.action || 'GENERATE',
      summary: historyAction.summary,
      oldData: historyAction.oldData || null,
      newData: historyAction.newData || null,
    });
  }

  return diaryDoc;
}

/**
 * Reads persisted Application_Settings directly from Google Sheets.
 */
function getApplicationSettings() {
  var ss = initializeSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.Application_Settings);
  if (!sheet) {
    throw createAppError_('Sheet अस्तित्वात नाही: Application_Settings', 404);
  }
  var rows = readDataRows_(sheet, SHEET_HEADERS.Application_Settings.length);
  if (rows.length === 0) {
    throw createAppError_('Application_Settings शीटमध्ये प्रणाली सेटिंग्ज आढळल्या नाहीत.', 500);
  }
  return rowToSettings_(rows[0].values);
}

/**
 * Live Read + Write verification against Google Sheets.
 * Only returns connected: true after verifying spreadsheet access, all 10 master sheets,
 * valid Employee_Master & Application_Settings rows, and a live non-destructive write-back.
 */
function checkDatabaseConnection() {
  var ss = initializeSpreadsheet();

  var missingSheets = [];
  for (var i = 0; i < ALL_MASTER_SHEETS.length; i++) {
    if (!ss.getSheetByName(ALL_MASTER_SHEETS[i])) {
      missingSheets.push(ALL_MASTER_SHEETS[i]);
    }
  }
  if (missingSheets.length > 0) {
    throw createAppError_('Sheet अस्तित्वात नाही: ' + missingSheets.join(', '), 500);
  }

  var empSheet = ss.getSheetByName(SHEET_NAMES.Employee_Master);
  var setSheet = ss.getSheetByName(SHEET_NAMES.Application_Settings);
  var empRows = readDataRows_(empSheet, SHEET_HEADERS.Employee_Master.length);
  var setRows = readDataRows_(setSheet, SHEET_HEADERS.Application_Settings.length);

  if (empRows.length === 0) {
    throw createAppError_('Employee_Master शीटमध्ये कर्मचारी माहिती आढळली नाही.', 500);
  }
  if (setRows.length === 0) {
    throw createAppError_('Application_Settings शीटमध्ये प्रणाली सेटिंग्ज आढळल्या नाहीत.', 500);
  }

  var employee = rowToEmployee_(empRows[0].values);
  var settings = rowToSettings_(setRows[0].values);
  if (!employee.officeName || !employee.fullName || !employee.designation) {
    throw createAppError_('Employee_Master मधील आवश्यक माहिती अपूर्ण आहे.', 500);
  }

  // Live non-destructive WRITE + READ verification on Application_Settings!K2 (updatedAt cell)
  var verifiedAt = new Date().toISOString();
  var verifyCell = setSheet.getRange(2, 11);
  verifyCell.setValue(verifiedAt);
  SpreadsheetApp.flush();
  var readBack = String(verifyCell.getDisplayValue() || '').trim();
  if (readBack !== verifiedAt) {
    throw createAppError_('डेटा सेव्ह होत नाही: Google Sheets Read/Write चाचणी अयशस्वी झाली.', 500);
  }

  return {
    connected: true,
    authMode: 'google_apps_script_web_app',
    readWriteVerified: true,
    verifiedAt: verifiedAt,
    spreadsheetId: ss.getId(),
    spreadsheetTitle: ss.getName(),
    masterSheetsCount: ALL_MASTER_SHEETS.length,
    masterSheetsVerified: ALL_MASTER_SHEETS.slice(),
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      designation: employee.designation,
      officeName: employee.officeName,
      headquarters: employee.headquarters,
    },
    settings: {
      id: settings.id,
      defaultFromPlace: settings.defaultFromPlace,
      holidayAdjustmentDirection: settings.holidayAdjustmentDirection,
      officePlace: settings.officePlace,
    },
  };
}

// ============================================================================
// Bootstrap, Monthly Diary Hydration & Backup Restore Helpers
// ============================================================================

function getBootstrapBundle_() {
  var ss = initializeSpreadsheet();

  var empRows = readDataRows_(ss.getSheetByName(SHEET_NAMES.Employee_Master), SHEET_HEADERS.Employee_Master.length);
  var setRows = readDataRows_(ss.getSheetByName(SHEET_NAMES.Application_Settings), SHEET_HEADERS.Application_Settings.length);

  if (empRows.length === 0) {
    throw createAppError_('Employee_Master शीटमध्ये कर्मचारी माहिती आढळली नाही.', 500);
  }
  if (setRows.length === 0) {
    throw createAppError_('Application_Settings शीटमध्ये प्रणाली सेटिंग्ज आढळल्या नाहीत.', 500);
  }

  var employee = rowToEmployee_(empRows[0].values);
  var settings = rowToSettings_(setRows[0].values);

  var subcenters = sortRecords_(
    SHEET_NAMES.Subcenter_Master,
    readDataRows_(ss.getSheetByName(SHEET_NAMES.Subcenter_Master), SHEET_HEADERS.Subcenter_Master.length).map(function (r) {
      return rowToSubcenter_(r.values);
    })
  );

  var villages = sortRecords_(
    SHEET_NAMES.Village_Master,
    readDataRows_(ss.getSheetByName(SHEET_NAMES.Village_Master), SHEET_HEADERS.Village_Master.length).map(function (r) {
      return rowToVillage_(r.values);
    })
  );

  var weeklySchedules = sortRecords_(
    SHEET_NAMES.Weekly_Schedule_Master,
    readDataRows_(ss.getSheetByName(SHEET_NAMES.Weekly_Schedule_Master), SHEET_HEADERS.Weekly_Schedule_Master.length).map(function (r) {
      return rowToWeeklySchedule_(r.values);
    })
  );

  var holidays = sortRecords_(
    SHEET_NAMES.Government_Holiday_Master,
    readDataRows_(ss.getSheetByName(SHEET_NAMES.Government_Holiday_Master), SHEET_HEADERS.Government_Holiday_Master.length).map(function (r) {
      return rowToHoliday_(r.values);
    })
  );

  var leaves = sortRecords_(
    SHEET_NAMES.Leave_Management,
    readDataRows_(ss.getSheetByName(SHEET_NAMES.Leave_Management), SHEET_HEADERS.Leave_Management.length).map(function (r) {
      return rowToLeave_(r.values);
    })
  );

  var specialEvents = sortRecords_(
    SHEET_NAMES.Special_Event_Master,
    readDataRows_(ss.getSheetByName(SHEET_NAMES.Special_Event_Master), SHEET_HEADERS.Special_Event_Master.length).map(function (r) {
      return rowToSpecialEvent_(r.values);
    })
  );

  var changeHistory = readDataRows_(ss.getSheetByName(SHEET_NAMES.Diary_Change_History), SHEET_HEADERS.Diary_Change_History.length)
    .map(function (r) {
      return rowToHistory_(r.values);
    })
    .sort(function (a, b) {
      return String(b.changeDate || '').localeCompare(String(a.changeDate || ''));
    })
    .slice(0, 200);

  var diaryIndexRows = readDataRows_(ss.getSheetByName(SHEET_NAMES.Monthly_Diary), SHEET_HEADERS.Monthly_Diary.length);
  var monthlyDiaries = [];
  for (var i = 0; i < diaryIndexRows.length; i++) {
    var meta = rowToMonthlyDiaryIndex_(diaryIndexRows[i].values);
    if (!meta.id || !meta.sheetName) continue;
    var tab = ss.getSheetByName(meta.sheetName);
    if (!tab) continue;
    var doc = hydrateMonthlyDiaryFromTab_(meta, tab);
    monthlyDiaries.push(doc);
  }
  monthlyDiaries.sort(function (a, b) {
    return b.year !== a.year ? b.year - a.year : b.month - a.month;
  });

  return {
    employee: employee,
    settings: settings,
    subcenters: subcenters,
    villages: villages,
    weeklySchedules: weeklySchedules,
    holidays: holidays,
    leaves: leaves,
    specialEvents: specialEvents,
    monthlyDiaries: monthlyDiaries,
    changeHistory: changeHistory,
  };
}

function getMonthlyDiaryById_(id) {
  var ss = initializeSpreadsheet();
  var indexSheet = ss.getSheetByName(SHEET_NAMES.Monthly_Diary);
  var indexRows = readDataRows_(indexSheet, SHEET_HEADERS.Monthly_Diary.length);
  for (var i = 0; i < indexRows.length; i++) {
    if (String(indexRows[i].values[0] || '').trim() === String(id || '').trim()) {
      var meta = rowToMonthlyDiaryIndex_(indexRows[i].values);
      var tab = ss.getSheetByName(meta.sheetName);
      if (!tab) return null;
      return hydrateMonthlyDiaryFromTab_(meta, tab);
    }
  }
  return null;
}

function deleteMonthlyDiary_(id) {
  var ss = initializeSpreadsheet();
  var indexSheet = ss.getSheetByName(SHEET_NAMES.Monthly_Diary);
  var indexRows = readDataRows_(indexSheet, SHEET_HEADERS.Monthly_Diary.length);
  var found = null;
  for (var i = 0; i < indexRows.length; i++) {
    if (String(indexRows[i].values[0] || '').trim() === String(id || '').trim()) {
      found = indexRows[i];
      break;
    }
  }
  if (!found) {
    throw createAppError_('दैनंदिनी आढळली नाही.', 404);
  }
  var meta = rowToMonthlyDiaryIndex_(found.values);
  indexSheet.deleteRow(found.rowNumber);

  var tab = ss.getSheetByName(meta.sheetName);
  if (tab && ss.getSheets().length > 1) {
    ss.deleteSheet(tab);
  }
  SpreadsheetApp.flush();

  appendHistory_(ss, {
    entityType: SHEET_NAMES.Monthly_Diary,
    entityId: id,
    action: 'DELETE',
    summary: meta.monthLabelMarathi + ' दैनंदिनी हटवली',
    oldData: JSON.stringify(meta),
    newData: null,
  });
  return { deleted: true };
}

function restoreBackup_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw createAppError_('अवैध बॅकअप फाईल स्वरूप.', 400);
  }
  var ss = initializeSpreadsheet();

  function replaceMaster(sheetName, rows) {
    var sheet = ss.getSheetByName(sheetName);
    var headers = SHEET_HEADERS[sheetName];
    var all = [headers].concat(rows);
    sheet.clearContents();
    sheet.getRange(1, 1, all.length, headers.length).setValues(all);
  }

  if (payload.Employee_Master) {
    replaceMaster(SHEET_NAMES.Employee_Master, [employeeToRow_(payload.Employee_Master)]);
  }
  if (payload.Application_Settings) {
    replaceMaster(SHEET_NAMES.Application_Settings, [settingsToRow_(payload.Application_Settings)]);
  }
  if (Array.isArray(payload.Subcenter_Master)) {
    replaceMaster(SHEET_NAMES.Subcenter_Master, payload.Subcenter_Master.map(subcenterToRow_));
  }
  if (Array.isArray(payload.Village_Master)) {
    replaceMaster(SHEET_NAMES.Village_Master, payload.Village_Master.map(villageToRow_));
  }
  if (Array.isArray(payload.Weekly_Schedule_Master)) {
    replaceMaster(SHEET_NAMES.Weekly_Schedule_Master, payload.Weekly_Schedule_Master.map(weeklyScheduleToRow_));
  }
  if (Array.isArray(payload.Government_Holiday_Master)) {
    replaceMaster(SHEET_NAMES.Government_Holiday_Master, payload.Government_Holiday_Master.map(holidayToRow_));
  }
  if (Array.isArray(payload.Leave_Management)) {
    replaceMaster(SHEET_NAMES.Leave_Management, payload.Leave_Management.map(leaveToRow_));
  }
  if (Array.isArray(payload.Special_Event_Master)) {
    replaceMaster(SHEET_NAMES.Special_Event_Master, payload.Special_Event_Master.map(specialEventToRow_));
  }
  if (Array.isArray(payload.Monthly_Diary)) {
    replaceMaster(SHEET_NAMES.Monthly_Diary, payload.Monthly_Diary.map(monthlyDiaryIndexToRow_));
    for (var i = 0; i < payload.Monthly_Diary.length; i++) {
      generateMonthlyDiary(payload.Monthly_Diary[i], null);
    }
  }

  SpreadsheetApp.flush();
  appendHistory_(ss, {
    entityType: 'System',
    entityId: 'restore',
    action: 'UPDATE',
    summary: 'डेटाबेस बॅकअप यशस्वीरित्या Google Sheets मध्ये रिस्टोअर केला',
    oldData: null,
    newData: null,
  });
  return { restored: true };
}

// ============================================================================
// Single-Spreadsheet Resolution (Zero Duplicate Spreadsheets)
// ============================================================================

function getOrCreateSingleSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();

  // 1. If script is container-bound to a Spreadsheet, use it directly
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      props.setProperty(PROP_SPREADSHEET_ID, active.getId());
      return active;
    }
  } catch (_ignore) {}

  // 2. Stored SPREADSHEET_ID in Script Properties
  var savedId = props.getProperty(PROP_SPREADSHEET_ID);
  if (savedId && String(savedId).trim()) {
    try {
      var opened = SpreadsheetApp.openById(String(savedId).trim());
      if (opened) return opened;
    } catch (_openErr) {
      // Fall through if manually trashed/removed
    }
  }

  // 3. Search personal Google Drive for existing spreadsheet by exact title (prevents duplicates)
  var files = DriveApp.getFilesByName(APP_SPREADSHEET_TITLE);
  while (files.hasNext()) {
    var f = files.next();
    if (!f.isTrashed() && f.getMimeType() === MimeType.GOOGLE_SHEETS) {
      props.setProperty(PROP_SPREADSHEET_ID, f.getId());
      return SpreadsheetApp.openById(f.getId());
    }
  }

  // 4. Create EXACTLY ONE new spreadsheet only when none exists
  var created = SpreadsheetApp.create(APP_SPREADSHEET_TITLE);
  if (!created) {
    throw createAppError_('Google Spreadsheet उपलब्ध नाही.', 500);
  }
  props.setProperty(PROP_SPREADSHEET_ID, created.getId());
  return created;
}

// ============================================================================
// Row Mappers, Sorting, Formatting & Utility Helpers
// ============================================================================

function readDataRows_(sheet, colCount) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, colCount).getDisplayValues();
  var out = [];
  var seenIds = {};
  for (var i = 0; i < values.length; i++) {
    if (!isRowEmpty_(values[i])) {
      var rowNumber = i + 2;
      var rowVals = values[i];
      var idVal = String(rowVals[0] || '').trim();
      if (!idVal || seenIds[idVal]) {
        var prefix = (idVal && idVal.indexOf('_') > 0) ? idVal.split('_')[0] : 'rec';
        var newId = generateUniqueId_(prefix);
        rowVals[0] = newId;
        try {
          sheet.getRange(rowNumber, 1).setValue(newId);
        } catch (_ignore) {}
        seenIds[newId] = true;
      } else {
        seenIds[idVal] = true;
      }
      out.push({ rowNumber: rowNumber, values: rowVals });
    }
  }
  return out;
}

function isRowEmpty_(row) {
  if (!row) return true;
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || '').trim() !== '') return false;
  }
  return true;
}

function cell_(row, idx) {
  return String((row && row[idx]) !== undefined && row[idx] !== null ? row[idx] : '');
}

function formatDateDDMMYYYY_(iso) {
  if (!iso || String(iso).length < 10) return String(iso || '');
  var parts = String(iso).slice(0, 10).split('-');
  if (parts.length !== 3) return String(iso);
  return parts[2] + '-' + parts[1] + '-' + parts[0];
}

function generateUniqueId_(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Utilities.getUuid().slice(0, 6);
}

function appendHistory_(ss, entry) {
  var sheet = ss.getSheetByName(SHEET_NAMES.Diary_Change_History);
  if (!sheet) return;
  var rec = {
    id: generateUniqueId_('hist'),
    changeDate: new Date().toISOString(),
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    summary: entry.summary,
    oldData: entry.oldData || '',
    newData: entry.newData || '',
  };
  sheet.appendRow(historyToRow_(rec));
}

function employeeToRow_(e) {
  return [
    e.id,
    e.fullName,
    e.designation,
    e.officeName,
    e.headquarters,
    e.email,
    e.mobile || '',
    e.implementationDate,
    formatDateDDMMYYYY_(e.implementationDate),
    e.updatedAt,
  ];
}

function rowToEmployee_(r) {
  return {
    id: cell_(r, 0).trim() || DEFAULT_EMPLOYEE.id,
    fullName: cell_(r, 1).trim() || DEFAULT_EMPLOYEE.fullName,
    designation: cell_(r, 2).trim() || DEFAULT_EMPLOYEE.designation,
    officeName: cell_(r, 3).trim() || DEFAULT_EMPLOYEE.officeName,
    headquarters: cell_(r, 4).trim() || DEFAULT_EMPLOYEE.headquarters,
    email: cell_(r, 5).trim() || DEFAULT_EMPLOYEE.email,
    mobile: cell_(r, 6).trim(),
    implementationDate: cell_(r, 7).trim() || DEFAULT_EMPLOYEE.implementationDate,
    updatedAt: cell_(r, 9).trim() || new Date().toISOString(),
  };
}

function needsEmployeeBackfill_(r) {
  return (
    !cell_(r, 0).trim() ||
    !cell_(r, 1).trim() ||
    !cell_(r, 2).trim() ||
    !cell_(r, 3).trim() ||
    !cell_(r, 4).trim() ||
    !cell_(r, 5).trim() ||
    !cell_(r, 7).trim()
  );
}

function settingsToRow_(s) {
  return [
    s.id,
    s.holidayAdjustmentDirection,
    s.defaultFromPlace,
    s.implementationDate,
    String(s.financialYearStartMonth),
    s.hqPlace,
    s.officePlace,
    s.talukaMeetingPlace,
    s.subcenterMeeting1Place,
    s.subcenterMeeting2Place,
    s.updatedAt,
  ];
}

function rowToSettings_(r) {
  var dir = cell_(r, 1).trim() === 'previous' ? 'previous' : 'next';
  return {
    id: cell_(r, 0).trim() || DEFAULT_SETTINGS.id,
    holidayAdjustmentDirection: dir,
    defaultFromPlace: cell_(r, 2).trim() || DEFAULT_SETTINGS.defaultFromPlace,
    implementationDate: cell_(r, 3).trim() || DEFAULT_SETTINGS.implementationDate,
    financialYearStartMonth: Number(cell_(r, 4).trim()) || DEFAULT_SETTINGS.financialYearStartMonth,
    hqPlace: cell_(r, 5).trim() || DEFAULT_SETTINGS.hqPlace,
    officePlace: cell_(r, 6).trim() || DEFAULT_SETTINGS.officePlace,
    talukaMeetingPlace: cell_(r, 7).trim() || DEFAULT_SETTINGS.talukaMeetingPlace,
    subcenterMeeting1Place: cell_(r, 8).trim() || DEFAULT_SETTINGS.subcenterMeeting1Place,
    subcenterMeeting2Place: cell_(r, 9).trim() || DEFAULT_SETTINGS.subcenterMeeting2Place,
    updatedAt: cell_(r, 10).trim() || new Date().toISOString(),
  };
}

function needsSettingsBackfill_(r) {
  var rawDir = cell_(r, 1).trim();
  return (
    !cell_(r, 0).trim() ||
    (rawDir !== 'next' && rawDir !== 'previous') ||
    !cell_(r, 2).trim() ||
    !cell_(r, 3).trim() ||
    !cell_(r, 4).trim() ||
    !cell_(r, 5).trim() ||
    !cell_(r, 6).trim() ||
    !cell_(r, 7).trim() ||
    !cell_(r, 8).trim() ||
    !cell_(r, 9).trim()
  );
}

function subcenterToRow_(s) {
  return [s.id, s.name, s.location, s.notes, s.createdAt, s.updatedAt];
}
function rowToSubcenter_(r) {
  return { id: cell_(r, 0), name: cell_(r, 1), location: cell_(r, 2), notes: cell_(r, 3), createdAt: cell_(r, 4), updatedAt: cell_(r, 5) };
}

function villageToRow_(v) {
  return [v.id, v.name, v.subcenterId, v.subcenterName, v.population, v.notes, v.createdAt, v.updatedAt];
}
function rowToVillage_(r) {
  return {
    id: cell_(r, 0),
    name: cell_(r, 1),
    subcenterId: cell_(r, 2),
    subcenterName: cell_(r, 3),
    population: cell_(r, 4),
    notes: cell_(r, 5),
    createdAt: cell_(r, 6),
    updatedAt: cell_(r, 7),
  };
}

function weeklyScheduleToRow_(w) {
  return [
    w.id,
    w.weekday,
    WEEKDAY_LABELS[w.weekday] || w.weekday,
    String(w.weekNumber),
    WEEK_OCCURRENCE_LABELS[w.weekNumber] || String(w.weekNumber),
    w.villageId,
    w.villageName,
    w.subcenterName,
    w.sessionType,
    w.notes,
    w.createdAt,
    w.updatedAt,
  ];
}
function rowToWeeklySchedule_(r) {
  return {
    id: cell_(r, 0),
    weekday: cell_(r, 1),
    weekNumber: Number(cell_(r, 3)),
    villageId: cell_(r, 5),
    villageName: cell_(r, 6),
    subcenterName: cell_(r, 7),
    sessionType: cell_(r, 8),
    notes: cell_(r, 9),
    createdAt: cell_(r, 10),
    updatedAt: cell_(r, 11),
  };
}

function holidayToRow_(h) {
  return [h.id, String(h.year), h.date, formatDateDDMMYYYY_(h.date), h.name, h.holidayType, h.notes, h.createdAt, h.updatedAt];
}
function rowToHoliday_(r) {
  var dt = cell_(r, 2).trim();
  var col3 = cell_(r, 3).trim();
  var col4 = cell_(r, 4).trim();
  var col5 = cell_(r, 5).trim();
  var col3IsDate = /^\d{2}-\d{2}-\d{4}$/.test(col3) || /^\d{4}-\d{2}-\d{2}$/.test(col3);
  var shifted = !col3IsDate && col3.length > 0 && !col5;
  return {
    id: cell_(r, 0),
    year: Number(cell_(r, 1)) || Number(dt.slice(0, 4)),
    date: dt,
    name: shifted ? col3 : col4,
    holidayType: shifted ? (col4 || 'सार्वजनिक सुट्टी') : (col5 || 'सार्वजनिक सुट्टी'),
    notes: cell_(r, 6),
    createdAt: cell_(r, 7),
    updatedAt: cell_(r, 8),
  };
}

function leaveToRow_(l) {
  return [
    l.id,
    l.leaveType,
    l.startDate,
    l.endDate,
    formatDateDDMMYYYY_(l.startDate),
    formatDateDDMMYYYY_(l.endDate),
    String(l.totalDays),
    l.reason,
    l.notes,
    l.createdAt,
    l.updatedAt,
  ];
}
function rowToLeave_(r) {
  return {
    id: cell_(r, 0),
    leaveType: cell_(r, 1),
    startDate: cell_(r, 2),
    endDate: cell_(r, 3),
    totalDays: Number(cell_(r, 6)) || 1,
    reason: cell_(r, 7),
    notes: cell_(r, 8),
    createdAt: cell_(r, 9),
    updatedAt: cell_(r, 10),
  };
}

function specialEventToRow_(ev) {
  return [ev.id, ev.date, formatDateDDMMYYYY_(ev.date), ev.eventType, ev.location, ev.workDescription, ev.notes, ev.createdAt, ev.updatedAt];
}
function rowToSpecialEvent_(r) {
  return {
    id: cell_(r, 0),
    date: cell_(r, 1),
    eventType: cell_(r, 3),
    location: cell_(r, 4),
    workDescription: cell_(r, 5),
    notes: cell_(r, 6),
    createdAt: cell_(r, 7),
    updatedAt: cell_(r, 8),
  };
}

function historyToRow_(h) {
  return [h.id, h.changeDate, h.entityType, h.entityId, h.action, h.summary, h.oldData || '', h.newData || ''];
}
function rowToHistory_(r) {
  return {
    id: cell_(r, 0),
    changeDate: cell_(r, 1),
    entityType: cell_(r, 2),
    entityId: cell_(r, 3),
    action: cell_(r, 4) || 'UPDATE',
    summary: cell_(r, 5),
    oldData: cell_(r, 6) || null,
    newData: cell_(r, 7) || null,
  };
}

function monthlyDiaryIndexToRow_(d) {
  return [
    d.id,
    String(d.year),
    String(d.month),
    d.monthLabelMarathi,
    d.sheetName,
    d.employeeName,
    d.designation,
    d.officeName,
    String(d.summary.totalDays),
    String(d.summary.workingDays),
    String(d.summary.sundays),
    String(d.summary.holidays),
    String(d.summary.leaves),
    String(d.summary.specialEvents),
    d.hasManualEdits ? 'होय' : 'नाही',
    JSON.stringify(d.warnings || []),
    d.createdAt,
    d.updatedAt,
  ];
}

function rowToMonthlyDiaryIndex_(r) {
  var warnings = [];
  try {
    warnings = JSON.parse(cell_(r, 15) || '[]');
  } catch (_e) {
    warnings = [];
  }
  return {
    id: cell_(r, 0),
    year: Number(cell_(r, 1)),
    month: Number(cell_(r, 2)),
    monthLabelMarathi: cell_(r, 3),
    sheetName: cell_(r, 4),
    employeeName: cell_(r, 5),
    designation: cell_(r, 6),
    officeName: cell_(r, 7),
    hasManualEdits: cell_(r, 14) === 'होय',
    warnings: warnings,
    createdAt: cell_(r, 16),
    updatedAt: cell_(r, 17),
  };
}

function buildMonthlyDiarySheetValues_(doc) {
  var rows = [
    ['मासिक दौरा दैनंदिनी'],
    [doc.designation + ' ' + doc.employeeName],
    [doc.officeName],
    ['महिना: ' + doc.monthLabelMarathi],
    [],
    MONTHLY_SHEET_TABLE_HEADERS,
  ];
  for (var i = 0; i < doc.entries.length; i++) {
    var e = doc.entries[i];
    rows.push([
      String(e.serialNo),
      formatDateDDMMYYYY_(e.date),
      e.dayNameMarathi,
      e.fromPlace,
      e.toPlace,
      e.workDescription,
      ENTRY_TYPE_LABELS[e.entryType] || e.entryType,
      e.originalDate ? formatDateDDMMYYYY_(e.originalDate) : '',
      e.adjustedDate ? formatDateDDMMYYYY_(e.adjustedDate) : '',
      e.isManualEdit ? 'होय' : 'नाही',
      e.notes || '',
      e.date,
      e.entryType,
      e.originalDate || '',
      e.adjustedDate || '',
      e.sourceId || '',
    ]);
  }
  return rows;
}

function hydrateMonthlyDiaryFromTab_(meta, tab) {
  var lastRow = tab.getLastRow();
  var entries = [];
  if (lastRow >= 7) {
    var rawRows = tab.getRange(7, 1, lastRow - 6, MONTHLY_SHEET_TABLE_HEADERS.length).getDisplayValues();
    for (var i = 0; i < rawRows.length; i++) {
      var r = rawRows[i];
      var serial = Number(cell_(r, 0));
      var dateIso = cell_(r, 11).trim();
      if (!serial || !dateIso) continue;
      var parts = dateIso.split('-');
      var dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      var dow = isNaN(dt.getTime()) ? 0 : dt.getDay();
      entries.push({
        serialNo: serial,
        date: dateIso,
        dayOfWeek: dow,
        dayNameMarathi: cell_(r, 2) || MARATHI_DAYS[dow] || '',
        fromPlace: cell_(r, 3) || 'भादा',
        toPlace: cell_(r, 4),
        workDescription: cell_(r, 5),
        entryType: cell_(r, 12) || 'office_work',
        originalDate: cell_(r, 13) || null,
        adjustedDate: cell_(r, 14) || null,
        sourceId: cell_(r, 15) || null,
        isManualEdit: cell_(r, 9) === 'होय',
        notes: cell_(r, 10),
      });
    }
  }
  entries.sort(function (a, b) {
    return a.serialNo - b.serialNo;
  });

  var summary = computeSummary_(entries);
  return {
    id: meta.id,
    year: meta.year,
    month: meta.month,
    monthLabelMarathi: meta.monthLabelMarathi,
    sheetName: meta.sheetName,
    employeeName: meta.employeeName,
    designation: meta.designation,
    officeName: meta.officeName,
    entries: entries,
    warnings: meta.warnings || [],
    summary: summary,
    hasManualEdits: entries.some(function (x) { return x.isManualEdit; }) || meta.hasManualEdits,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

function computeSummary_(entries) {
  var sundays = 0, holidays = 0, leaves = 0, specialEvents = 0, villageTours = 0, meetings = 0, officeDays = 0;
  for (var i = 0; i < entries.length; i++) {
    var t = entries[i].entryType;
    if (t === 'sunday') sundays++;
    else if (t === 'holiday') holidays++;
    else if (t === 'leave') leaves++;
    else if (t === 'special_event') specialEvents++;
    else if (t === 'weekly_schedule' || t === 'adjusted_schedule') villageTours++;
    else if (t === 'wednesday_hq' || t === 'wednesday_asha' || t === 'taluka_meeting' || t === 'subcenter_meeting') meetings++;
    else if (t === 'office_work') officeDays++;
  }
  var totalDays = entries.length;
  return {
    totalDays: totalDays,
    workingDays: totalDays - sundays - holidays - leaves,
    sundays: sundays,
    holidays: holidays,
    leaves: leaves,
    specialEvents: specialEvents,
    villageTours: villageTours,
    meetings: meetings,
    officeDays: officeDays,
  };
}

function mapRowToEntity_(sheetName, row) {
  if (sheetName === SHEET_NAMES.Employee_Master) return rowToEmployee_(row);
  if (sheetName === SHEET_NAMES.Application_Settings) return rowToSettings_(row);
  if (sheetName === SHEET_NAMES.Subcenter_Master) return rowToSubcenter_(row);
  if (sheetName === SHEET_NAMES.Village_Master) return rowToVillage_(row);
  if (sheetName === SHEET_NAMES.Weekly_Schedule_Master) return rowToWeeklySchedule_(row);
  if (sheetName === SHEET_NAMES.Government_Holiday_Master) return rowToHoliday_(row);
  if (sheetName === SHEET_NAMES.Leave_Management) return rowToLeave_(row);
  if (sheetName === SHEET_NAMES.Special_Event_Master) return rowToSpecialEvent_(row);
  if (sheetName === SHEET_NAMES.Diary_Change_History) return rowToHistory_(row);
  if (sheetName === SHEET_NAMES.Monthly_Diary) return rowToMonthlyDiaryIndex_(row);
  return null;
}

function mapEntityToRow_(sheetName, obj) {
  if (sheetName === SHEET_NAMES.Employee_Master) return employeeToRow_(obj);
  if (sheetName === SHEET_NAMES.Application_Settings) return settingsToRow_(obj);
  if (sheetName === SHEET_NAMES.Subcenter_Master) return subcenterToRow_(obj);
  if (sheetName === SHEET_NAMES.Village_Master) return villageToRow_(obj);
  if (sheetName === SHEET_NAMES.Weekly_Schedule_Master) return weeklyScheduleToRow_(obj);
  if (sheetName === SHEET_NAMES.Government_Holiday_Master) return holidayToRow_(obj);
  if (sheetName === SHEET_NAMES.Leave_Management) return leaveToRow_(obj);
  if (sheetName === SHEET_NAMES.Special_Event_Master) return specialEventToRow_(obj);
  if (sheetName === SHEET_NAMES.Diary_Change_History) return historyToRow_(obj);
  if (sheetName === SHEET_NAMES.Monthly_Diary) return monthlyDiaryIndexToRow_(obj);
  return [];
}

function sortRecords_(sheetName, list) {
  var copy = list.slice();
  if (sheetName === SHEET_NAMES.Subcenter_Master || sheetName === SHEET_NAMES.Village_Master) {
    copy.sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'mr');
    });
  } else if (sheetName === SHEET_NAMES.Weekly_Schedule_Master) {
    var order = { monday: 1, tuesday: 2, thursday: 3, friday: 4, saturday: 5 };
    copy.sort(function (a, b) {
      var d = (order[a.weekday] || 9) - (order[b.weekday] || 9);
      return d !== 0 ? d : Number(a.weekNumber) - Number(b.weekNumber);
    });
  } else if (sheetName === SHEET_NAMES.Government_Holiday_Master) {
    copy.sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || ''));
    });
  } else if (sheetName === SHEET_NAMES.Leave_Management) {
    copy.sort(function (a, b) {
      return String(b.startDate || '').localeCompare(String(a.startDate || ''));
    });
  } else if (sheetName === SHEET_NAMES.Special_Event_Master) {
    copy.sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }
  return copy;
}

function assertValidMasterSheet_(sheetName) {
  if (ALL_MASTER_SHEETS.indexOf(sheetName) === -1) {
    throw createAppError_('Sheet अस्तित्वात नाही: ' + sheetName, 404);
  }
}

function objectAssign_(target) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (!src) continue;
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) {
        target[k] = src[k];
      }
    }
  }
  return target;
}

function createAppError_(message, status) {
  var err = new Error(message);
  err.status = status || 500;
  return err;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorJsonResponse_(err) {
  var message = (err && err.message) ? String(err.message) : 'Google Apps Script सर्व्हरवर अनपेक्षित त्रुटी आली.';
  var status = (err && err.status) ? Number(err.status) : 500;
  return jsonResponse_({ ok: false, status: status, error: message });
}
