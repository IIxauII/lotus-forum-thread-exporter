// Lotus Forum Thread Exporter - Background Service Worker
// Background script loaded

// PDF storage (temporary storage for downloads)
const pdfStorage = new Map();

// Initialize storage with proper defaults
async function initializeStorage() {
  // Initializing storage

  try {
    // Initialize sync storage (settings only - 100KB limit)
    const existingSettings = await chrome.storage.sync.get([
      "extensionEnabled",
    ]);

    if (
      Object.keys(existingSettings).length === 0 ||
      existingSettings.extensionEnabled === undefined
    ) {
      await chrome.storage.sync.set({
        extensionEnabled: true,
        exportTheme: "british-racing-green",
        includeAttachments: true,
        maxHistorySize: 10,
        enableConsoleLogging: true,
      });
    }

    // Initialize local storage (PDF data - 10MB + unlimitedStorage)
    const existingStats = await chrome.storage.local.get([
      "exportStats",
      "exportHistory",
    ]);
    if (!existingStats.exportStats) {
      await chrome.storage.local.set({
        exportStats: {
          totalExports: 0,
          lastExport: null,
        },
        exportHistory: [],
        storageStats: {
          totalSize: 0,
          lastCleanup: null,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error initializing storage:", error);
  }
}

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Lotus Forum Thread Exporter installed");
  await initializeStorage();
});

// Initialize on startup (when service worker starts)
chrome.runtime.onStartup.addListener(async () => {
  console.log("Lotus Forum Thread Exporter started");
  await initializeStorage();
});

// Also initialize immediately when script loads
initializeStorage();

// Test storage access and quota
chrome.storage.local.get(["exportHistory"], (result) => {
  console.log("🔍 Background script storage test:", result);
});

// Check storage quota and permissions
chrome.storage.local.getBytesInUse().then((bytes) => {
  console.log("🔍 Current storage usage:", bytes, "bytes");
  console.log("🔍 Storage quota:", chrome.storage.local.QUOTA_BYTES, "bytes");
  console.log(
    "🔍 Usage percentage:",
    ((bytes / chrome.storage.local.QUOTA_BYTES) * 100).toFixed(2) + "%"
  );

  // Check if unlimitedStorage permission is working
  if (
    chrome.storage.local.QUOTA_BYTES === undefined ||
    chrome.storage.local.QUOTA_BYTES > 10485760
  ) {
    console.log("✅ Unlimited storage permission is ACTIVE");
  } else {
    console.log(
      "❌ Unlimited storage permission is NOT active - limited to 10MB"
    );
    console.log("💡 User may need to grant the unlimitedStorage permission");
  }
});

// Smart PDF Storage Management Functions
async function manageExportHistory(newExport) {
  try {
    console.log("🔍 Managing export history for:", newExport.threadTitle);
    console.log("🔍 Export data:", {
      id: newExport.id,
      title: newExport.threadTitle,
      hasPdfBase64: !!newExport.pdfBase64,
      pdfBase64Length: newExport.pdfBase64 ? newExport.pdfBase64.length : 0,
      pdfSize: newExport.pdfSize,
    });

    const { exportHistory = [] } = await chrome.storage.local.get([
      "exportHistory",
    ]);
    console.log("🔍 Current export history length:", exportHistory.length);

    // Add new export to the beginning
    exportHistory.unshift(newExport);

    // Try to save with PDF data first
    const result = await trySaveWithPdf(exportHistory, newExport);

    // Verify storage
    const verify = await chrome.storage.local.get(["exportHistory"]);
    console.log(
      "🔍 Verification - stored exports:",
      verify.exportHistory.length
    );
    if (verify.exportHistory[0]) {
      console.log("🔍 First export in storage:", {
        id: verify.exportHistory[0].id,
        title: verify.exportHistory[0].threadTitle,
        hasPdfBase64: !!verify.exportHistory[0].pdfBase64,
        pdfBase64Length: verify.exportHistory[0].pdfBase64
          ? verify.exportHistory[0].pdfBase64.length
          : 0,
        pdfStored: verify.exportHistory[0].pdfStored,
      });
    }

    // Check storage quota
    await checkStorageQuota();
  } catch (error) {
    console.error("❌ Error managing export history:", error);
  }
}

// Try to save with PDF data, fallback to smart cleanup if needed
async function trySaveWithPdf(exportHistory, newExport) {
  // With Chrome storage approach, we only store metadata (no PDF data in this storage)
  // PDFs are stored separately in Chrome storage using chunking
  console.log("🔍 Using Chrome storage approach - storing metadata only");

  // Remove PDF data from all entries (PDFs are stored separately)
  const exportHistoryMetadata = exportHistory.map((exp) => ({
    ...exp,
    pdfBase64: undefined, // Remove base64 data
    pdfSize: exp.pdfSize, // Keep size info
    pdfStored: exp.pdfStored || false, // Keep storage status
  }));

  const dataSize = JSON.stringify(exportHistoryMetadata).length;
  const quota = chrome.storage.local.QUOTA_BYTES;
  const usagePercent = (dataSize / quota) * 100;

  console.log("🔍 Metadata size:", dataSize, "bytes");
  console.log("🔍 Storage quota:", quota, "bytes");
  console.log("🔍 Usage percentage:", usagePercent.toFixed(2) + "%");

  // Metadata should always fit (it's small)
  if (usagePercent < 95) {
    console.log("✅ Under 95% quota - saving metadata");
    await chrome.storage.local.set({ exportHistory: exportHistoryMetadata });
    console.log(
      `📁 Added export to history: ${newExport.threadTitle} (metadata only, PDF in Chrome storage)`
    );
    return { success: true, withPdf: newExport.pdfStored, chromeStorage: true };
  }

  // If metadata is too large, clean up old entries
  console.log("⚠️ Metadata too large - cleaning up old entries");
  const cleanedHistory = await smartCleanup(exportHistoryMetadata, newExport);

  if (cleanedHistory) {
    const cleanedSize = JSON.stringify(cleanedHistory).length;
    const cleanedPercent = (cleanedSize / quota) * 100;

    if (cleanedPercent < 95) {
      console.log("✅ Cleanup successful - saving metadata");
      await chrome.storage.local.set({ exportHistory: cleanedHistory });
      console.log(
        `📁 Added export to history: ${newExport.threadTitle} (metadata after cleanup)`
      );
      return {
        success: true,
        withPdf: newExport.pdfStored,
        chromeStorage: true,
        cleaned: true,
      };
    }
  }

  // This should never happen with metadata-only storage
  console.error("❌ Cannot fit metadata - this should not happen");
  throw new Error("Cannot fit metadata in storage");
}

// Smart cleanup: remove old entries without PDFs, then old entries with PDFs if needed
async function smartCleanup(exportHistory, newExport) {
  console.log("🧹 Starting smart cleanup...");

  // First pass: remove entries without PDFs (oldest first)
  let cleaned = [...exportHistory];
  const withoutPdf = cleaned.filter(
    (exp) => !exp.pdfBase64 || exp.pdfStored === false
  );
  const withPdf = cleaned.filter(
    (exp) => exp.pdfBase64 && exp.pdfStored !== false
  );

  console.log("🔍 Entries without PDF:", withoutPdf.length);
  console.log("🔍 Entries with PDF:", withPdf.length);

  // Remove oldest entries without PDFs first
  const toRemove = withoutPdf.slice(1); // Keep the newest one without PDF
  cleaned = cleaned.filter((exp) => !toRemove.includes(exp));

  console.log("🧹 Removed", toRemove.length, "entries without PDFs");

  // Check if we can fit now
  let dataSize = JSON.stringify(cleaned).length;
  let usagePercent = (dataSize / chrome.storage.local.QUOTA_BYTES) * 100;

  if (usagePercent < 95) {
    console.log("✅ Cleanup successful after removing entries without PDFs");
    return cleaned;
  }

  // Second pass: remove oldest entries with PDFs
  console.log("🧹 Still over quota - removing oldest entries with PDFs...");

  // Sort by timestamp (oldest first) and remove oldest
  const sortedWithPdf = withPdf.sort((a, b) => {
    const timeA = new Date(a.exportDate || a.timestamp || 0).getTime();
    const timeB = new Date(b.exportDate || b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  // Remove oldest entries with PDFs until we're under 95%
  let removedCount = 0;
  while (usagePercent >= 95 && sortedWithPdf.length > 1) {
    const oldest = sortedWithPdf.shift();
    cleaned = cleaned.filter((exp) => exp.id !== oldest.id);
    removedCount++;

    dataSize = JSON.stringify(cleaned).length;
    usagePercent = (dataSize / chrome.storage.local.QUOTA_BYTES) * 100;
  }

  console.log("🧹 Removed", removedCount, "additional entries with PDFs");
  console.log("🔍 Final usage after cleanup:", usagePercent.toFixed(2) + "%");

  return cleaned;
}

async function checkStorageQuota() {
  try {
    const usage = await chrome.storage.local.getBytesInUse();
    const quota = chrome.storage.local.QUOTA_BYTES; // 10MB
    const usagePercent = (usage / quota) * 100;

    console.log(
      `📊 Storage usage: ${(usage / 1024 / 1024).toFixed(2)}MB / ${(
        quota /
        1024 /
        1024
      ).toFixed(2)}MB (${usagePercent.toFixed(1)}%)`
    );

    if (usagePercent > 80) {
      console.warn("⚠️ Storage quota approaching limit, consider cleanup");
      // Could trigger additional cleanup here if needed
    }
  } catch (error) {
    console.error("❌ Error checking storage quota:", error);
  }
}

async function getExportHistory() {
  try {
    const { exportHistory = [] } = await chrome.storage.local.get([
      "exportHistory",
    ]);
    return exportHistory;
  } catch (error) {
    console.error("❌ Error getting export history:", error);
    return [];
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup, but we can also add additional logic here if needed
  console.log("Extension icon clicked on tab:", tab.url);
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "storePDF") {
    try {
      // Store PDF in memory
      pdfStorage.set(request.exportId, {
        pdfBase64: request.pdfBase64,
        pdfSize: request.pdfSize,
        timestamp: Date.now(),
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error("Error storing PDF:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === "downloadPDF") {
    // Use async function to handle the download
    (async () => {
      try {
        const pdfData = pdfStorage.get(request.exportId);
        if (!pdfData) {
          sendResponse({ success: false, error: "PDF not found" });
          return;
        }

        // Use the base64 data URL directly (no need to convert back to blob)
        const dataUrl = pdfData.pdfBase64;

        // Trigger download using the data URL directly
        chrome.downloads.download(
          {
            url: dataUrl,
            filename: `export_${request.exportId}.pdf`,
            saveAs: false,
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("Download failed:", chrome.runtime.lastError);
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else {
              sendResponse({ success: true, downloadId: downloadId });
            }
          }
        );
      } catch (error) {
        console.error("Error downloading PDF:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  if (request.action === "clearExportHistory") {
    try {
      // Clear export history from storage
      chrome.storage.local.remove(["exportHistory"]);

      // Clear PDF storage
      pdfStorage.clear();

      // Reset export stats
      chrome.storage.local.set({
        exportStats: { totalExports: 0, lastExport: null },
      });

      sendResponse({ success: true });
    } catch (error) {
      console.error("Error clearing export history:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === "updateExportStats") {
    chrome.storage.local.get(["exportStats"], (result) => {
      const stats = result.exportStats || { totalExports: 0, lastExport: null };
      stats.totalExports += 1;
      stats.lastExport = new Date().toISOString();

      chrome.storage.local.set({ exportStats: stats });
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === "addExportToHistory") {
    console.log("🔍 Processing addExportToHistory request...");
    console.log("🔍 Export data received:", {
      id: request.exportData.id,
      title: request.exportData.threadTitle,
      hasPdfBase64: !!request.exportData.pdfBase64,
      pdfBase64Length: request.exportData.pdfBase64
        ? request.exportData.pdfBase64.length
        : 0,
    });

    manageExportHistory(request.exportData)
      .then(() => {
        console.log("🔍 Export history management completed successfully");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("❌ Error in manageExportHistory:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "getExportHistory") {
    getExportHistory()
      .then((history) => {
        sendResponse({ exportHistory: history });
      })
      .catch((error) => {
        sendResponse({ exportHistory: [], error: error.message });
      });
    return true;
  }

  if (request.action === "getSettings") {
    chrome.storage.sync.get(
      [
        "extensionEnabled",
        "exportTheme",
        "includeAttachments",
        "maxHistorySize",
        "enableConsoleLogging",
      ],
      (result) => {
        sendResponse({
          extensionEnabled: result.extensionEnabled !== false,
          exportTheme: result.exportTheme || "british-racing-green",
          includeAttachments: result.includeAttachments !== false,
          maxHistorySize: result.maxHistorySize || 10,
          enableConsoleLogging: result.enableConsoleLogging !== false,
        });
      }
    );
    return true;
  }

  if (request.action === "getExportStats") {
    chrome.storage.local.get(["exportStats"], (result) => {
      sendResponse({
        exportStats: result.exportStats || {
          totalExports: 0,
          lastExport: null,
        },
      });
    });
    return true;
  }
});
