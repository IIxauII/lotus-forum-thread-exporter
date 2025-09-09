// Lotus Forum Thread Exporter - Logger Module
// Dedicated logging system for export debugging

class Logger {
  constructor(exportId = null) {
    this.exportId = exportId;
    this.logs = [];
  }

  // Set export ID for current session
  setExportId(exportId) {
    this.exportId = exportId;
  }

  // Log methods
  log(message, data = null) {
    this.addLog("log", message, data);
  }

  error(message, data = null) {
    this.addLog("error", message, data);
  }

  warn(message, data = null) {
    this.addLog("warn", message, data);
  }

  // Add log entry
  addLog(level, message, data) {
    return;
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      data: data,
      exportId: this.exportId,
    };

    this.logs.push(logEntry);

    // Also log to console for development
    const consoleMethod =
      level === "error"
        ? console.error
        : level === "warn"
        ? console.warn
        : console.log;
    consoleMethod(`[${level.toUpperCase()}] ${message}`, data || "");

    // Store logs if export ID is set
    if (this.exportId) {
      this.storeLogs();
    }
  }

  // Store logs in chrome.storage.local
  async storeLogs() {
    return;
    if (!this.exportId) {
      return;
    }

    try {
      const { exportHistory = [] } = await chrome.storage.local.get([
        "exportHistory",
      ]);
      const exportIndex = exportHistory.findIndex(
        (exp) => exp.id === this.exportId
      );

      if (exportIndex !== -1) {
        exportHistory[exportIndex].consoleLogs = this.logs;
        await chrome.storage.local.set({ exportHistory });
      }
    } catch (error) {
      console.error("Logger: Failed to store logs:", error);
    }
  }

  // Get logs for specific export
  async getLogs(exportId) {
    try {
      const { exportHistory = [] } = await chrome.storage.local.get([
        "exportHistory",
      ]);
      const exportItem = exportHistory.find((exp) => exp.id === exportId);
      return exportItem ? exportItem.consoleLogs || [] : [];
    } catch (error) {
      console.error("Logger: Failed to get logs:", error);
      return [];
    }
  }

  // Clear logs for current session
  clearLogs() {
    this.logs = [];
  }

  // Get current session logs
  getCurrentLogs() {
    return this.logs;
  }

  // Format logs for clipboard
  formatLogsForClipboard(logs) {
    return logs
      .map(
        (log) =>
          `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${
            log.data ? " " + JSON.stringify(log.data) : ""
          }`
      )
      .join("\n");
  }
}

// Ensure a global singleton exists and is safe to access everywhere
(function () {
  try {
    if (typeof window !== "undefined") {
      if (!window.logger || typeof window.logger.log !== "function") {
        window.logger = new Logger();
      }
      if (!window.LOG) {
        window.LOG = window.logger; // optional alias
      }
    }
  } catch (e) {
    // Fallback intentionally no-op; console remains available
  }
})();
