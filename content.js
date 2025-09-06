// Lotus Forum Thread Exporter - Main Content Script
// Orchestrates all components for thread detection, scraping, and PDF generation

(function () {
  "use strict";

  // Prevent multiple initializations
  if (window.lotusThreadExporterInitialized) {
    return;
  }
  window.lotusThreadExporterInitialized = true;

  // Initialize components
  const detector = new ThreadDetector(CONFIG);
  const scraper = new ThreadScraper(CONFIG, detector);
  const pdfGenerator = new PDFGenerator(CONFIG);
  const uiManager = new UIManager(CONFIG);

  // Initialize Chrome storage manager

  let isExporting = false;
  let isInitialized = false;

  // Initialize extension
  async function init() {
    if (isInitialized) {
      return;
    }

    // ALWAYS set up listeners first, regardless of initial state
    chrome.runtime.onMessage.addListener(handleMessage);

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync" && changes.extensionEnabled) {
        handleToggleExtension(changes.extensionEnabled.newValue);
      }
    });

    // Wait for storage to be ready with retry logic
    let isEnabled = false;
    let retryCount = 0;
    const maxRetries = 10;

    while (retryCount < maxRetries) {
      try {
        const result = await chrome.storage.sync.get(["extensionEnabled"]);

        if (result.extensionEnabled !== undefined) {
          isEnabled = result.extensionEnabled;
          break;
        } else {
          retryCount++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error("❌ Storage check failed:", error);
        retryCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (retryCount >= maxRetries) {
      console.error(
        "❌ Storage not ready after max retries - defaulting to disabled"
      );
      isEnabled = false;
    }

    // Handle initial state
    if (isEnabled) {
      if (detector.isWoltLabThread()) {
        uiManager.addExportButton();
        uiManager.setExportHandler(handleExportClick);
      }
    }

    isInitialized = true;
  }

  // Handle export button click
  async function handleExportClick() {
    if (isExporting || !uiManager.isEnabled()) return;

    try {
      isExporting = true;
      uiManager.updateButtonState("exporting");

      // Generate unique export ID
      const exportId = `export_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Set export ID for logger (if available)
      if (typeof logger !== "undefined") {
        logger.setExportId(exportId);
        logger.log("Starting thread export");
      }

      // Get thread data
      const threadData = await scraper.scrapeThreadData();

      // Generate PDF
      const pdfBlob = await pdfGenerator.generatePDF(threadData);

      // Download PDF immediately (original behavior)
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${threadData.title.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Send PDF to background script for storage and download
      let pdfStored = false;
      try {
        // Convert blob to base64 for transmission
        const pdfBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });

        // Send PDF to background script
        const response = await chrome.runtime.sendMessage({
          action: "storePDF",
          exportId: exportId,
          pdfBase64: pdfBase64,
          pdfSize: pdfBlob.size,
        });

        if (response && response.success) {
          pdfStored = true;
        }
      } catch (error) {
        console.error("Error storing PDF:", error);
      }

      // Store metadata in Chrome storage (no PDF data)
      const exportData = {
        id: exportId,
        threadTitle: threadData.title,
        threadUrl: window.location.href,
        exportDate: new Date().toISOString(),
        timestamp: new Date().toISOString(), // Keep for backward compatibility
        postCount: threadData.posts.length,
        pageCount: threadData.posts.length, // Keep for backward compatibility
        pdfSize: pdfBlob.size,
        pdfStored: pdfStored, // Mark if PDF was stored in IndexedDB
        consoleLogs:
          typeof logger !== "undefined" ? logger.getCurrentLogs() : [],
      };

      // Add to export history first
      chrome.runtime.sendMessage({
        action: "addExportToHistory",
        exportData: exportData,
      });

      // Store logs after export is added to history
      if (typeof logger !== "undefined") {
        logger.log("✅ Thread exported successfully");
        // Give a moment for the export to be stored before trying to store logs
        setTimeout(() => {
          logger.storeLogs();
        }, 100);
      }
      uiManager.updateButtonState("success");

      // Notify popup of successful export
      chrome.runtime.sendMessage({ action: "exportComplete" });

      // Update export statistics
      chrome.runtime.sendMessage({ action: "updateExportStats" });
    } catch (error) {
      if (typeof logger !== "undefined") {
        logger.error("❌ Export failed", {
          error: error.message,
          stack: error.stack,
        });
      } else {
        console.error("❌ Export failed:", error);
      }
      uiManager.updateButtonState("error");

      // Notify popup of export error
      chrome.runtime.sendMessage({
        action: "exportError",
        error: error.message,
      });
    } finally {
      isExporting = false;
      // Note: Button state reset is handled in uiManager.updateButtonState()
    }
  }

  // Handle messages from popup
  function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case "toggleExtension":
        handleToggleExtension(request.enabled);
        sendResponse({ success: true });
        break;
      case "exportThread":
        if (detector.isWoltLabThread() && uiManager.isEnabled()) {
          handleExportClick();
          sendResponse({ success: true });
        } else {
          sendResponse({
            success: false,
            error: "Not a valid thread or extension disabled",
          });
        }
        break;
    }
    return true; // Keep message channel open for async response
  }

  // Handle extension toggle
  async function handleToggleExtension(enabled) {
    // Update UIManager status
    uiManager.toggleExtension(enabled);

    if (enabled) {
      // Extension enabled - re-initialize if on a WoltLab thread
      if (detector.isWoltLabThread()) {
        uiManager.addExportButton();
        uiManager.setExportHandler(handleExportClick);
      }
    } else {
      // Extension disabled - remove export button
      uiManager.removeExportButton();
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
