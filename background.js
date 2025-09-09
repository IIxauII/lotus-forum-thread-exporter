// Lotus Forum Thread Exporter - Background Service Worker
// Background script loaded

// Storage Manager - Centralized storage operations
import { StorageManager } from './js/storage/storage-manager.js';
let storageManager = null;
let isInitializing = false;
let isInitialized = false;

// Initialize storage with proper defaults
async function initializeStorage() {
  try {
    if (isInitialized || isInitializing) {
      console.log("ℹ️ Storage initialization skipped (already in progress or completed)");
      return;
    }
    isInitializing = true;

    // Initialize storage managers
    storageManager = new StorageManager();
    await storageManager.initialize();
    
    console.log("✅ Storage initialized successfully");
    isInitialized = true;
  } catch (error) {
    console.error("❌ Error initializing storage:", error);
  } finally {
    isInitializing = false;
  }
}

// Initialize basic storage without external modules
async function initializeBasicStorage() {
  try {
    // Initialize Chrome storage with defaults
    const existingStats = await chrome.storage.local.get(["exportStats", "exportHistory"]);
    if (!existingStats.exportStats) {
      await chrome.storage.local.set({
        exportStats: {
          totalExports: 0,
          lastExport: null,
        },
        exportHistory: [],
      });
    }
  } catch (error) {
    console.error("❌ Error initializing basic storage:", error);
  }
}

// (Legacy migration removed)

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

// Legacy functions removed - now using StorageManager

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup, but we can also add additional logic here if needed
  console.log("Extension icon clicked on tab:", tab.url);
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle storage operations with new storage manager
  if (request.action === "storeExport") {
    handleStoreExport(request, sendResponse);
    return true;
  }

  if (request.action === "downloadPDF") {
    handleDownloadPDF(request, sendResponse);
    return true;
  }

  if (request.action === "clearExportHistory") {
    handleClearExportHistory(sendResponse);
    return true;
  }

  if (request.action === "getExportHistory") {
    handleGetExportHistory(sendResponse);
    return true;
  }

  if (request.action === "getStorageStats") {
    handleGetStorageStats(sendResponse);
    return true;
  }

  if (request.action === "updateExportStats") {
    handleUpdateExportStats(sendResponse);
    return true;
  }

  if (request.action === "storePdfBlob") {
    handleStorePdfBlob(request, sendResponse);
    return true;
  }

  if (request.action === "getSettings") {
    chrome.storage.local.get(
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

  if (request.action === "downloadViaObjectUrl") {
    // Trigger download using a blob URL created in an extension page
    chrome.downloads.download(
      {
        url: request.url,
        filename: request.filename || `export_${Date.now()}.pdf`,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      }
    );
    return true;
  }
});

// Message handler functions routed through StorageManager

async function handleStoreExport(request, sendResponse) {
  try {
    const result = await storageManager.storeExport(request.exportData);
    sendResponse(result);
  } catch (error) {
    console.error("Error storing export:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDownloadPDF(request, sendResponse) {
  try {
    const { success, pdfBlob, error } = await storageManager.getPdf(request.exportId);
    if (!success || !pdfBlob) {
      sendResponse({ success: false, error: error || 'PDF not found' });
      return;
    }

    const dataUrl = await blobToDataUrl(pdfBlob);
    const filename = `${request.exportId}.pdf`;

    chrome.downloads.download({ url: dataUrl, filename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
  } catch (error) {
    console.error("Error downloading PDF:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleClearExportHistory(sendResponse) {
  try {
    const result = await storageManager.clearAllStorage();
    sendResponse(result);
  } catch (error) {
    console.error("Error clearing export history:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetExportHistory(sendResponse) {
  try {
    const exportHistory = await storageManager.getExportHistory();
    sendResponse({ exportHistory });
  } catch (error) {
    console.error("Error getting export history:", error);
    sendResponse({ exportHistory: [], error: error.message });
  }
}

async function handleGetStorageStats(sendResponse) {
  try {
    const stats = await storageManager.getStorageStats();
    sendResponse({ success: true, stats });
  } catch (error) {
    console.error("Error getting storage stats:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateExportStats(sendResponse) {
  try {
    const { exportStats = { totalExports: 0, lastExport: null } } = await chrome.storage.local.get(["exportStats"]);
    exportStats.totalExports += 1;
    exportStats.lastExport = new Date().toISOString();
    
    await chrome.storage.local.set({ exportStats });
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error updating export stats:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStorePdfBlob(request, sendResponse) {
  try {
    const { exportId, pdfBase64, pdfSize } = request;
    
    console.log("🔍 Storing PDF blob:", exportId, "Size:", pdfSize);
    
    // Convert base64 back to blob
    const response = await fetch(pdfBase64);
    const pdfBlob = await response.blob();
    
    console.log("🔍 Converted to blob, size:", pdfBlob.size);
    
    // Store in IndexedDB using StorageManager
    await storageManager.indexedDB.storePdf(exportId, pdfBlob);
    
    // Update metadata to mark PDF as stored
    const { exportHistory = [] } = await chrome.storage.local.get(["exportHistory"]);
    const exportIndex = exportHistory.findIndex(exp => exp.id === exportId);
    if (exportIndex !== -1) {
      exportHistory[exportIndex].pdfStored = true;
      await chrome.storage.local.set({ exportHistory });
      console.log("✅ Updated metadata to mark PDF as stored");
    }
    
    console.log("✅ PDF blob stored in IndexedDB:", exportId, "Size:", pdfSize);
    sendResponse({ success: true });
  } catch (error) {
    console.error("❌ Error storing PDF blob:", error);
    console.error("❌ Error details:", error.name, error.message);
    sendResponse({ success: false, error: error.message });
  }
}

// Helper function for blob to data URL conversion
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64 = btoa(binary);
  return `data:application/pdf;base64,${base64}`;
}

