const CONFIG = {
  PROJECT_TITLE: "Mentoring Workspace",
  MENTOR: "Mentor",
  MENTEE: "Mentee",
  PEOPLE: ["Mentor", "Mentee"],
  START_DATE: "2026-06-01",

  // Optional: paste existing file IDs here. Leave blank to let the script
  // create a Doc and Sheet in your Drive on first use.
  DOCUMENT_ID: "",
  SPREADSHEET_ID: "",

  DOCUMENT_NAME: "Mentoring Daily Log",
  SPREADSHEET_NAME: "Mentoring Task Tracker",
  TASKS_SHEET: "Tasks",
  LOGS_SHEET: "Daily Log",
};

const TASK_HEADERS = ["id", "title", "status", "assignee", "updatedAt", "doDate", "deadline"];
const LOG_HEADERS = ["id", "date", "workedOn", "notes", "blockers", "nextStep", "createdAt", "figureName", "figureDescription", "figureNames", "figureDescriptions"];
const STATUS_VALUES = ["not_started", "in_progress", "waiting", "blocked", "done"];
const STATUS_ALIASES = { open: "in_progress" };
const MAX_FIGURE_BYTES = 5 * 1024 * 1024;
const MAX_FIGURE_FILES = 6;
const MAX_TOTAL_FIGURE_BYTES = 12 * 1024 * 1024;

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle(CONFIG.PROJECT_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function initializeProject() {
  return withProjectLock_(() => {
    ensureSchema_();
    const state = readState_();
    Logger.log(`Daily log document: ${state.sync.docUrl}`);
    Logger.log(`Task spreadsheet: ${state.sync.sheetUrl}`);
    return state.sync;
  });
}

function apiGetState() {
  return withProjectLock_(() => {
    ensureSchema_();
    return readState_();
  });
}

function apiSubmitDailyLog(log) {
  return withProjectLock_(() => {
    ensureSchema_();
    const clean = normalizeLog_(log);
    const spreadsheet = getSpreadsheet_();
    const sheet = getSheet_(spreadsheet, CONFIG.LOGS_SHEET, LOG_HEADERS);
    sheet.appendRow(LOG_HEADERS.map((header) => clean[header] || ""));
    appendLogToDocument_(clean);
    formatLogSheet_(sheet);
    return readState_();
  });
}

function apiUpsertTask(task) {
  return withProjectLock_(() => {
    ensureSchema_();
    const clean = normalizeTask_(task);
    const spreadsheet = getSpreadsheet_();
    const sheet = getSheet_(spreadsheet, CONFIG.TASKS_SHEET, TASK_HEADERS);
    upsertRow_(sheet, TASK_HEADERS, clean.id, clean);
    formatTaskSheet_(sheet);
    return readState_();
  });
}

function apiDeleteTask(id) {
  return withProjectLock_(() => {
    ensureSchema_();
    const spreadsheet = getSpreadsheet_();
    const sheet = getSheet_(spreadsheet, CONFIG.TASKS_SHEET, TASK_HEADERS);
    deleteRowById_(sheet, String(id));
    formatTaskSheet_(sheet);
    return readState_();
  });
}

function readState_() {
  const spreadsheet = getSpreadsheet_();
  const document = getDocument_();
  return {
    version: 4,
    project: {
      title: CONFIG.PROJECT_TITLE,
      mentor: CONFIG.MENTOR,
      mentee: CONFIG.MENTEE,
      people: CONFIG.PEOPLE,
      startDate: CONFIG.START_DATE,
    },
    tasks: readObjects_(getSheet_(spreadsheet, CONFIG.TASKS_SHEET, TASK_HEADERS)).map((task) => ({
      id: task.id,
      title: task.title,
      status: STATUS_ALIASES[task.status] || task.status || "not_started",
      owner: task.assignee || task.owner,
      updatedAt: task.updatedAt,
      scheduledDate: task.doDate || task.scheduledDate,
      deadline: task.deadline,
    })),
    dailyLogs: readObjects_(getSheet_(spreadsheet, CONFIG.LOGS_SHEET, LOG_HEADERS)).map((log) => ({
      id: log.id,
      date: log.date,
      workedOn: log.workedOn,
      notes: log.notes,
      blockers: log.blockers,
      nextStep: log.nextStep,
      createdAt: log.createdAt,
      figureName: log.figureName,
      figureDescription: log.figureDescription,
      figureNames: log.figureNames,
      figureDescriptions: log.figureDescriptions,
      figures: parseFigureMetadata_(log),
    })),
    sync: {
      mode: "google",
      docName: document.getName(),
      docUrl: document.getUrl(),
      sheetName: spreadsheet.getName(),
      sheetUrl: spreadsheet.getUrl(),
      lastSync: new Date().toISOString(),
    },
  };
}

function ensureSchema_() {
  const spreadsheet = getSpreadsheet_();
  const tasksSheet = getSheet_(spreadsheet, CONFIG.TASKS_SHEET, TASK_HEADERS);
  if (tasksSheet.getLastRow() < 2) {
    buildDefaultTasks_().forEach((task) => {
      tasksSheet.appendRow(TASK_HEADERS.map((header) => task[header] || ""));
    });
  }
  formatTaskSheet_(tasksSheet);

  const logsSheet = getSheet_(spreadsheet, CONFIG.LOGS_SHEET, LOG_HEADERS);
  formatLogSheet_(logsSheet);

  getDocument_();
}

function getSpreadsheet_() {
  const configuredId = String(CONFIG.SPREADSHEET_ID || "").trim();
  if (configuredId) return SpreadsheetApp.openById(configuredId);

  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty("SPREADSHEET_ID");
  if (savedId) return SpreadsheetApp.openById(savedId);

  const spreadsheet = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  return spreadsheet;
}

function getDocument_() {
  const configuredId = String(CONFIG.DOCUMENT_ID || "").trim();
  if (configuredId) return DocumentApp.openById(configuredId);

  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty("DOCUMENT_ID");
  if (savedId) return DocumentApp.openById(savedId);

  const document = DocumentApp.create(CONFIG.DOCUMENT_NAME);
  document.getBody().appendParagraph(CONFIG.PROJECT_TITLE).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  document.getBody().appendParagraph(`Mentor: ${CONFIG.MENTOR}`);
  document.getBody().appendParagraph(`Mentee: ${CONFIG.MENTEE}`);
  document.getBody().appendParagraph(`People: ${CONFIG.PEOPLE.join(", ")}`);
  document.saveAndClose();
  properties.setProperty("DOCUMENT_ID", document.getId());
  return DocumentApp.openById(document.getId());
}

function getSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const existing = headerRange.getValues()[0].map(String);
  const needsHeaders = sheet.getLastRow() === 0 || headers.some((header, index) => existing[index] !== header);
  if (needsHeaders) headerRange.setValues([headers]);
  sheet.setFrozenRows(1);
  headerRange
    .setFontWeight("bold")
    .setBackground("#e5eadf")
    .setFontColor("#28261f");
}

function formatTaskSheet_(sheet) {
  ensureHeaders_(sheet, TASK_HEADERS);
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("B:B").setWrap(true);
  sheet.getRange(2, 3, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_VALUES, true)
      .setAllowInvalid(false)
      .build()
  );
  sheet.getRange("F:G").setNumberFormat("yyyy-mm-dd");
  sheet.setColumnWidths(1, 1, 190);
  sheet.setColumnWidths(2, 1, 340);
  sheet.setColumnWidths(3, 1, 120);
  sheet.setColumnWidths(4, 1, 130);
  sheet.setColumnWidths(5, 1, 210);
  sheet.setColumnWidths(6, 2, 125);
}

function formatLogSheet_(sheet) {
  ensureHeaders_(sheet, LOG_HEADERS);
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("C:K").setWrap(true);
  sheet.setColumnWidths(1, 1, 190);
  sheet.setColumnWidths(2, 1, 110);
  sheet.setColumnWidths(3, 4, 260);
  sheet.setColumnWidths(7, 1, 210);
  sheet.setColumnWidths(8, 1, 180);
  sheet.setColumnWidths(9, 3, 280);
}

function withProjectLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index] instanceof Date ? toDateInput_(row[index]) : row[index];
    });
    return object;
  });
}

function upsertRow_(sheet, headers, id, object) {
  const values = sheet.getDataRange().getValues();
  const rowValues = headers.map((header) => object[header] || "");
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][0]) === String(id)) {
      sheet.getRange(row + 1, 1, 1, headers.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

function deleteRowById_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let row = values.length - 1; row >= 1; row -= 1) {
    if (String(values[row][0]) === id) {
      sheet.deleteRow(row + 1);
      return;
    }
  }
}

function appendLogToDocument_(log) {
  const document = getDocument_();
  const body = document.getBody();
  body.appendParagraph(formatDisplayDate_(log.date)).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  appendSection_(body, "Worked on", log.workedOn);
  appendSection_(body, "Notes", log.notes);
  appendSection_(body, "Blockers", log.blockers);
  appendSection_(body, "Next step", log.nextStep);
  appendFigures_(body, log);
  body.appendParagraph("");
  document.saveAndClose();
}

function appendSection_(body, label, value) {
  if (!value) return;
  body.appendParagraph(label).setHeading(DocumentApp.ParagraphHeading.HEADING3);
  appendFormattedText_(body, value);
}

function appendFormattedText_(body, value) {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    const table = readMarkdownTable_(lines, index);
    if (table) {
      appendMarkdownTable_(body, table.rows);
      index = table.nextIndex - 1;
      continue;
    }

    const bullet = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      body.appendListItem(bullet[1]).setGlyphType(DocumentApp.GlyphType.BULLET);
      continue;
    }

    body.appendParagraph(line);
  }
}

function readMarkdownTable_(lines, startIndex) {
  if (!isMarkdownTableRow_(lines[startIndex]) || !isMarkdownTableSeparator_(lines[startIndex + 1])) return null;

  const tableLines = [lines[startIndex]];
  let index = startIndex + 2;
  while (index < lines.length && isMarkdownTableRow_(lines[index])) {
    tableLines.push(lines[index]);
    index += 1;
  }

  const rows = tableLines.map(parseMarkdownTableRow_).filter((row) => row.length);
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return {
    rows: rows.map((row) => row.concat(Array(Math.max(0, width - row.length)).fill(" "))),
    nextIndex: index,
  };
}

function isMarkdownTableRow_(line) {
  const value = String(line || "").trim();
  return value.startsWith("|") && value.endsWith("|") && value.slice(1, -1).includes("|");
}

function isMarkdownTableSeparator_(line) {
  if (!isMarkdownTableRow_(line)) return false;
  return parseMarkdownTableRow_(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTableRow_(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => String(cell || "").trim() || " ");
}

function appendMarkdownTable_(body, rows) {
  if (!rows.length) return;
  const table = body.appendTable(rows);
  try {
    for (let column = 0; column < table.getRow(0).getNumCells(); column += 1) {
      table.getRow(0).getCell(column).editAsText().setBold(true);
    }
  } catch (error) {
    Logger.log(`Could not style table header: ${error.message}`);
  }
}

function appendFigures_(body, log) {
  const figures = log.figures || [];
  if (!figures.length) return;

  body.appendParagraph(figures.length === 1 ? "Figure" : "Figures").setHeading(DocumentApp.ParagraphHeading.HEADING3);
  figures.forEach((figure, index) => {
    const blob = figureBlobFromDataUrl_(figure.dataUrl, figure.mimeType, figure.name);
    if (!blob) return;

    if (figures.length > 1) body.appendParagraph(`Figure ${index + 1}${figure.name ? `: ${figure.name}` : ""}`);
    const image = body.appendImage(blob);
    const width = image.getWidth();
    const height = image.getHeight();
    const maxWidth = 520;
    if (width > maxWidth) {
      image.setWidth(maxWidth);
      image.setHeight(Math.round((height / width) * maxWidth));
    }
    if (figure.description) body.appendParagraph(String(figure.description)).editAsText().setItalic(true);
  });

  if (log.figureDescription && !figures.some((figure) => figure.description === log.figureDescription)) {
    body.appendParagraph(String(log.figureDescription)).editAsText().setItalic(true);
  }
}

function figureBlobFromDataUrl_(dataUrl, fallbackMimeType, fallbackName) {
  const value = String(dataUrl || "").trim();
  if (!value) return null;

  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("The figure upload could not be decoded.");

  const mimeType = String(match[1] || fallbackMimeType || "").toLowerCase();
  if (!/^image\/(png|jpe?g|gif)$/.test(mimeType)) {
    throw new Error("Only PNG, JPG, or GIF figures are supported.");
  }

  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > MAX_FIGURE_BYTES) throw new Error("Choose a figure under 5 MB.");
  return Utilities.newBlob(bytes, mimeType, fallbackName || "figure");
}

function normalizeTask_(task) {
  const normalizedStatus = STATUS_ALIASES[task.status] || task.status;
  const assignee = String(task.assignee || task.owner || CONFIG.MENTEE);
  const doDate = task.doDate || task.scheduledDate;
  return {
    id: task.id || createId_("task"),
    title: String(task.title || "").trim(),
    status: STATUS_VALUES.includes(normalizedStatus) ? normalizedStatus : "not_started",
    assignee,
    owner: assignee,
    updatedAt: task.updatedAt || new Date().toISOString(),
    doDate: isDateInput_(doDate) ? doDate : "",
    scheduledDate: isDateInput_(doDate) ? doDate : "",
    deadline: isDateInput_(task.deadline) ? task.deadline : "",
  };
}

function normalizeLog_(log) {
  const figures = normalizeFigures_(log);
  const firstFigure = figures[0] || {};
  const figureDescription = String(log.figureDescription || firstFigure.description || "").trim();

  return {
    id: log.id || createId_("log"),
    date: log.date || toDateInput_(new Date()),
    workedOn: String(log.workedOn || "").trim(),
    notes: String(log.notes || "").trim(),
    blockers: String(log.blockers || "").trim(),
    nextStep: String(log.nextStep || "").trim(),
    createdAt: log.createdAt || new Date().toISOString(),
    figureName: String(log.figureName || firstFigure.name || "").trim(),
    figureDescription,
    figureMimeType: String(log.figureMimeType || firstFigure.mimeType || "").trim(),
    figureDataUrl: String(log.figureDataUrl || firstFigure.dataUrl || "").trim(),
    figureNames: figures.map((figure) => figure.name).filter(Boolean).join("\n"),
    figureDescriptions: figures.map((figure) => figure.description).filter(Boolean).join("\n") || figureDescription,
    figures,
  };
}

function normalizeFigures_(log) {
  const rawFigures = Array.isArray(log.figures) && log.figures.length
    ? log.figures
    : log.figureDataUrl || log.figureName
      ? [{
          name: log.figureName,
          description: log.figureDescription,
          mimeType: log.figureMimeType,
          dataUrl: log.figureDataUrl,
        }]
      : [];

  if (rawFigures.length > MAX_FIGURE_FILES) throw new Error(`Attach ${MAX_FIGURE_FILES} figures or fewer.`);

  let totalBytes = 0;
  const figures = rawFigures.map((figure) => {
    const normalized = {
      name: String(figure.name || figure.figureName || "").trim(),
      description: String(figure.description || figure.figureDescription || "").trim(),
      mimeType: String(figure.mimeType || figure.figureMimeType || "").trim(),
      dataUrl: String(figure.dataUrl || figure.figureDataUrl || "").trim(),
    };
    if (normalized.dataUrl) {
      const match = normalized.dataUrl.match(/^data:[^;]+;base64,([\s\S]+)$/);
      if (match) totalBytes += Utilities.base64Decode(match[1]).length;
    }
    return normalized;
  }).filter((figure) => figure.name || figure.description || figure.dataUrl);

  if (totalBytes > MAX_TOTAL_FIGURE_BYTES) throw new Error("Keep all figures under 12 MB total.");
  return figures;
}

function parseFigureMetadata_(log) {
  const names = String(log.figureNames || log.figureName || "").split(/\n|;/).map((value) => value.trim()).filter(Boolean);
  const descriptions = String(log.figureDescriptions || log.figureDescription || "").split(/\n\n|\n/).map((value) => value.trim()).filter(Boolean);
  return names.map((name, index) => ({
    name,
    description: descriptions[index] || descriptions[0] || "",
    mimeType: "",
  }));
}

function buildDefaultTasks_() {
  const start = parseDate_(CONFIG.START_DATE);
  return [
    normalizeTask_({ title: "Define goals and success criteria", status: "in_progress", owner: CONFIG.MENTOR, scheduledDate: CONFIG.START_DATE, deadline: toDateInput_(addDays_(start, 2)) }),
    normalizeTask_({ title: "Set up the shared workspace", status: "not_started", owner: CONFIG.MENTEE, scheduledDate: toDateInput_(addDays_(start, 1)), deadline: toDateInput_(addDays_(start, 4)) }),
    normalizeTask_({ title: "Review background materials", status: "waiting", owner: CONFIG.MENTEE, scheduledDate: toDateInput_(addDays_(start, 2)), deadline: toDateInput_(addDays_(start, 6)) }),
    normalizeTask_({ title: "Confirm the first checkpoint meeting", status: "done", owner: CONFIG.MENTOR, scheduledDate: CONFIG.START_DATE, deadline: CONFIG.START_DATE }),
    normalizeTask_({ title: "Prepare midpoint progress summary", status: "not_started", owner: CONFIG.MENTEE, scheduledDate: toDateInput_(addDays_(start, 42)), deadline: toDateInput_(addDays_(start, 48)) }),
  ];
}

function createId_(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseDate_(value) {
  const parts = String(value).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays_(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInput_(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInput_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function formatDisplayDate_(value) {
  return Utilities.formatDate(parseDate_(value), Session.getScriptTimeZone(), "MMMM d, yyyy");
}
