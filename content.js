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

  // Store PDF blob in IndexedDB
  async function storePdfBlob(exportId, pdfBlob) {
    try {
      // Convert blob to base64 for transmission
      const base64 = await blobToBase64(pdfBlob);
      
      // Send to background script for storage
      const result = await chrome.runtime.sendMessage({
        action: "storePdfBlob",
        exportId: exportId,
        pdfBase64: base64,
        pdfSize: pdfBlob.size
      });
      
      if (result.success) {
        logger.log("✅ PDF blob stored successfully", { exportId, size: pdfBlob.size });
      } else {
        logger.warn("⚠️ PDF blob storage failed", { error: result.error });
      }
    } catch (error) {
      logger.warn("Failed to store PDF blob", { error: error.message });
    }
  }

  // Convert blob to base64
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Initialize extension
  async function init() {
    if (isInitialized) {
      return;
    }

    // ALWAYS set up listeners first, regardless of initial state
    chrome.runtime.onMessage.addListener(handleMessage);

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.extensionEnabled) {
        handleToggleExtension(changes.extensionEnabled.newValue);
      }
    });

    // Wait for storage to be ready with retry logic
    let isEnabled = false;
    let retryCount = 0;
    const maxRetries = 10;

    while (retryCount < maxRetries) {
      try {
        const result = await chrome.storage.local.get(["extensionEnabled"]);

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
      
      // Add global error handler for this export
      const originalErrorHandler = window.onerror;
      const originalUnhandledRejection = window.onunhandledrejection;
      
      window.onerror = (message, source, lineno, colno, error) => {
        logger.error("Export: global error caught", {
          message,
          source,
          lineno,
          colno,
          error: error ? error.message : null,
          stack: error ? error.stack : null
        });
        return false; // Don't prevent default handling
      };
      
      window.onunhandledrejection = (event) => {
        logger.error("Export: unhandled promise rejection", {
          reason: event.reason,
          promise: event.promise
        });
        return false; // Don't prevent default handling
      };

      // Generate unique export ID
      const exportId = `export_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Set export ID for logger
      logger.setExportId(exportId);
      logger.log("Starting thread export");

      logger.log("Export: starting scrape", { exportId });
      const scrapeStartTime = performance.now();
      
      // Get thread data
      const threadData = await scraper.scrapeThreadData();
      
      const scrapeEndTime = performance.now();
      logger.log("Export: scrape complete", {
        exportId,
        postCount: threadData.posts.length,
        scrapeDuration: Math.round(scrapeEndTime - scrapeStartTime) + " ms"
      });

      // Generate PDF
      logger.log("Export: generating PDF", { exportId });
      const pdfStartTime = performance.now();
      
      const pdfBlob = await pdfGenerator.generatePDF(threadData);
      
      const pdfEndTime = performance.now();
      
      logger.log("Export: PDF generated", {
        exportId,
        pdfSize: pdfBlob && pdfBlob.size,
        pdfGenerationDuration: Math.round(pdfEndTime - pdfStartTime) + " ms"
      });

      // No page-level caching; background persists to IndexedDB

      // Download PDF immediately (original behavior)
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${threadData.title.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Background streaming removed - using direct download only
      logger.log("Export: using direct download only (background streaming disabled)", { 
        exportId, 
        pdfSize: pdfBlob.size 
      });

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
        pdfStored: false, // Will be updated after storage
        consoleLogs: logger.getCurrentLogs(),
      };

      // Store export metadata first
      try {
        const result = await chrome.runtime.sendMessage({
          action: "storeExport",
          exportData: exportData,
        });
        
        if (result.success) {
          logger.log("✅ Export metadata stored successfully", { exportId });
          
          // Now store the PDF blob separately
          await storePdfBlob(exportId, pdfBlob);
        } else {
          logger.warn("⚠️ Export storage failed", { error: result.error });
        }
      } catch (error) {
        logger.warn("Failed to store export", { error: error.message });
      }

      // Store logs after export is added to history
      logger.log("✅ Thread exported successfully");
      // Give a moment for the export to be stored before trying to store logs
      setTimeout(() => {
        logger.storeLogs();
      }, 100);
      uiManager.updateButtonState("success");

      // Notify popup of successful export
      try {
        await chrome.runtime.sendMessage({ action: "exportComplete" });
      } catch (error) {
        logger.warn("Failed to notify popup of export completion", { error: error.message });
      }

      // Update export statistics
      try {
        await chrome.runtime.sendMessage({ action: "updateExportStats" });
      } catch (error) {
        logger.warn("Failed to update export statistics", { error: error.message });
      }

      // Final success log
      logger.log("Export: all operations completed successfully", {
        exportId,
        pdfSize: pdfBlob.size,
        totalPosts: threadData.posts.length
      });
    } catch (error) {
      logger.error("❌ Export failed", {
        error: error.message,
        stack: error.stack,
      });
      console.error("❌ Export failed:", error);
      uiManager.updateButtonState("error");

      // Notify popup of export error
      try {
        await chrome.runtime.sendMessage({
          action: "exportError",
          error: error.message,
        });
      } catch (sendError) {
        logger.warn("Failed to notify popup of export error", { error: sendError.message });
      }
    } finally {
      isExporting = false;
      
      // Restore original error handlers
      window.onerror = originalErrorHandler;
      window.onunhandledrejection = originalUnhandledRejection;
      
      // Cleanup logging
      logger.log("Export: cleanup completed", {
        isExporting: false,
        errorHandlersRestored: true
      });
      
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
      case "reStreamLastPDF":
        // Deprecated; background now persists PDFs in IndexedDB
        sendResponse({ success: false, error: "not_supported" });
        break;
      case "downloadPdfFromCache":
        // Request background to serialize the Blob to data URL and return via download API –
        // but for very large files we create object URL in the page context.
        (async () => {
          try {
            // Ask background for a data URL or stream directive
            chrome.runtime.sendMessage({ action: "downloadPDF", exportId: request.exportId });
            sendResponse({ success: true });
          } catch (e) {
            sendResponse({ success: false, error: e && e.message });
          }
        })();
        return true;
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
