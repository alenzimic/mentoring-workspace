(function (window) {
  const App = window.MentoringWorkspace = window.MentoringWorkspace || {};

  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function todayInput() {
    return toDateInput(new Date());
  }

  function parseDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function toDateInput(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isDateInput(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function formatShortDate(value) {
    const date = parseDate(value);
    return date ? date.toLocaleDateString([], { month: "short", day: "numeric" }) : "No date";
  }

  function formatLongDate(value) {
    const date = parseDate(value);
    return date ? date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "Unscheduled";
  }

  function formatDateTime(value) {
    if (!value) return "Never";
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function unique(values) {
    const seen = new Set();
    return values
      .map((value) => String(value || "").trim())
      .filter((value) => {
        if (!value || seen.has(value.toLowerCase())) return false;
        seen.add(value.toLowerCase());
        return true;
      });
  }

  function includesText(value, query) {
    return String(value || "").toLowerCase().includes(String(query || "").trim().toLowerCase());
  }

  App.Utils = {
    addDays,
    createId,
    escapeHtml,
    formatDateTime,
    formatLongDate,
    formatShortDate,
    includesText,
    isDateInput,
    parseDate,
    stripTime,
    todayInput,
    toDateInput,
    unique,
  };
})(window);
