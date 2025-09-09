// Lotus Forum Thread Exporter - Popup Script
// Handles popup interface functionality and communication with content script

class PopupManager {
  constructor() {
    this.extensionEnabled = true;
    this.currentTab = null;
    this.exportStats = {
      totalExports: 0,
      lastExport: null,
    };
    this.storageStats = null;

    this.init();
  }

  async init() {
    // Popup initialized

    // Get current tab
    await this.getCurrentTab();

    // Load extension state
    await this.loadExtensionState();

    // Load export statistics
    await this.loadExportStats();

    // Load export history
    await this.loadExportHistory();

    // Load storage statistics
    await this.loadStorageStats();

    // Setup event listeners
    this.setupEventListeners();

    // Setup refresh button
    this.setupClearButton();

    // Update UI based on current state
    this.updateUI();
  }

  // Get current active tab
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      this.currentTab = tab;
      // Current tab loaded
    } catch (error) {
      console.error("Error getting current tab:", error);
    }
  }

  // Load extension state from storage
  async loadExtensionState() {
    try {
      const result = await chrome.storage.local.get(["extensionEnabled"]);
      this.extensionEnabled = result.extensionEnabled !== false; // Default to true
    } catch (error) {
      console.error("❌ Error loading extension state:", error);
      this.extensionEnabled = true;
    }
  }

  // Load export statistics
  async loadExportStats() {
    try {
      const result = await chrome.storage.local.get(["exportStats"]);
      if (result.exportStats) {
        this.exportStats = result.exportStats;
      }
      // Export stats loaded
    } catch (error) {
      console.error("Error loading export stats:", error);
    }
  }

  // Load storage statistics
  async loadStorageStats() {
    try {
      const result = await chrome.runtime.sendMessage({
        action: "getStorageStats",
      });

      if (result.success && result.stats) {
        this.storageStats = result.stats;
        this.updateStorageDisplay();
      }
    } catch (error) {
      console.error("Error loading storage stats:", error);
    }
  }

  // Load export history
  async loadExportHistory() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getExportHistory",
      });

      if (response && response.exportHistory) {
        this.exportHistory = response.exportHistory;
        // Export history loaded

        this.renderExportHistory();
      } else {
        // No export history found
        this.exportHistory = [];
      }
    } catch (error) {
      console.error("❌ Error loading export history:", error);
      this.exportHistory = [];
    }
  }

  // Save extension state
  async saveExtensionState() {
    try {
      await chrome.storage.local.set({
        extensionEnabled: this.extensionEnabled,
      });
      console.log("Extension state saved:", this.extensionEnabled);
    } catch (error) {
      console.error("Error saving extension state:", error);
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Extension toggle
    const toggle = document.getElementById("extensionToggle");
    toggle.addEventListener("change", (e) => {
      this.toggleExtension(e.target.checked);
      this.updateToggleStatus();
    });
  }

  // Setup clear history button
  setupClearButton() {
    const clearBtn = document.getElementById("clearHistoryBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        console.log("🔍 Clear history button clicked");
        this.clearExportHistory();
      });
    }
  }

  // Debug storage directly
  async debugStorage() {
    try {
      console.log("🔍 Debugging storage directly...");
      const result = await chrome.storage.local.get([
        "exportHistory",
        "exportStats",
      ]);
      console.log("🔍 Direct storage result:", result);
      console.log(
        "🔍 Export history length:",
        result.exportHistory ? result.exportHistory.length : 0
      );
      if (result.exportHistory && result.exportHistory.length > 0) {
        console.log("🔍 First export:", {
          id: result.exportHistory[0].id,
          title: result.exportHistory[0].threadTitle,
          hasPdfBase64: !!result.exportHistory[0].pdfBase64,
          pdfBase64Length: result.exportHistory[0].pdfBase64
            ? result.exportHistory[0].pdfBase64.length
            : 0,
        });
      }

      // Also test the message passing
      console.log("🔍 Testing getExportHistory message...");
      const response = await chrome.runtime.sendMessage({
        action: "getExportHistory",
      });
      console.log("🔍 getExportHistory response:", response);

      // Test if background script is responding
      console.log("🔍 Testing background script communication...");
      try {
        const testResponse = await chrome.runtime.sendMessage({
          action: "getExportStats",
        });
        console.log("🔍 Background script test response:", testResponse);
      } catch (error) {
        console.error("❌ Background script not responding:", error);
      }

      // Test adding a small dummy export first
      console.log("🔍 Testing addExportToHistory with small dummy data...");
      const smallDummyExport = {
        id: "small_test_" + Date.now(),
        threadTitle: "Small Test Export",
        threadUrl: "https://test.com",
        exportDate: new Date().toISOString(),
        postCount: 1,
        pdfSize: 1000,
        pdfBase64: undefined, // No PDF data
        consoleLogs: [],
      };

      const smallAddResponse = await chrome.runtime.sendMessage({
        action: "addExportToHistory",
        exportData: smallDummyExport,
      });
      console.log("🔍 Small addExportToHistory response:", smallAddResponse);

      // Test adding a dummy export with PDF data
      console.log("🔍 Testing addExportToHistory with dummy data...");
      const dummyExport = {
        id: "test_" + Date.now(),
        threadTitle: "Test Export",
        threadUrl: "https://test.com",
        exportDate: new Date().toISOString(),
        postCount: 1,
        pdfSize: 1000,
        pdfBase64: "data:application/pdf;base64,test",
        consoleLogs: [],
      };

      const addResponse = await chrome.runtime.sendMessage({
        action: "addExportToHistory",
        exportData: dummyExport,
      });
      console.log("🔍 addExportToHistory response:", addResponse);

      // Check storage again
      const result2 = await chrome.storage.local.get(["exportHistory"]);
      console.log(
        "🔍 Storage after dummy export:",
        result2.exportHistory ? result2.exportHistory.length : 0
      );
    } catch (error) {
      console.error("❌ Error debugging storage:", error);
    }
  }

  // Toggle extension on/off
  async toggleExtension(enabled) {
    console.log("🔄 Toggling extension to:", enabled);
    this.extensionEnabled = enabled;

    // Save state
    await this.saveExtensionState();
    console.log("💾 Extension state saved:", enabled);

    // Send message to content script
    if (this.currentTab) {
      try {
        await chrome.tabs.sendMessage(this.currentTab.id, {
          action: "toggleExtension",
          enabled: enabled,
        });
        console.log("📤 Extension toggle message sent:", enabled);
      } catch (error) {
        console.error("❌ Error sending toggle message:", error);
      }
    }

    // Update UI
    this.updateUI();
  }

  // Show message to user
  showMessage(message, type = "info") {
    // Create temporary message element
    const messageEl = document.createElement("div");
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${
              type === "error"
                ? "#dc3545"
                : type === "success"
                ? "#28a745"
                : "#17a2b8"
            };
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

    document.body.appendChild(messageEl);

    // Remove after 3 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }

  // Update UI based on current state
  updateUI() {
    // Update toggle switch
    const toggle = document.getElementById("extensionToggle");
    toggle.checked = this.extensionEnabled;

    // Update toggle status display
    this.updateToggleStatus();

    // Update statistics
    this.updateStatistics();
  }

  // Update toggle status display
  updateToggleStatus() {
    const toggleStatusDot = document.getElementById("toggleStatusDot");
    const toggleStatusText = document.getElementById("toggleStatusText");

    if (this.extensionEnabled) {
      toggleStatusDot.classList.remove("inactive");
      toggleStatusText.textContent = "On";
    } else {
      toggleStatusDot.classList.add("inactive");
      toggleStatusText.textContent = "Off";
    }
  }

  // Update statistics display
  updateStatistics() {
    document.getElementById("totalExports").textContent =
      this.exportStats.totalExports;

    if (this.exportStats.lastExport) {
      const lastExportDate = new Date(this.exportStats.lastExport);
      const now = new Date();
      const diffMs = now - lastExportDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let lastExportText;
      if (diffMins < 1) {
        lastExportText = "Just now";
      } else if (diffMins < 60) {
        lastExportText = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        lastExportText = `${diffHours}h ago`;
      } else {
        lastExportText = `${diffDays}d ago`;
      }

      document.getElementById("lastExport").textContent = lastExportText;
    } else {
      document.getElementById("lastExport").textContent = "Never";
    }
  }

  // Render export history
  renderExportHistory() {
    const historyList = document.getElementById("exportHistoryList");

    if (!this.exportHistory || this.exportHistory.length === 0) {
      historyList.innerHTML = `
                <div class="no-exports">
                    <p>No exports yet</p>
                    <small>Export a thread to see it here</small>
                </div>
            `;
      return;
    }

    const historyHTML = this.exportHistory
      .map((exportItem) => {
        const date = new Date(exportItem.exportDate || exportItem.timestamp);
        const formattedDate =
          date.toLocaleDateString() +
          " " +
          date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const sizeKB = Math.round(exportItem.pdfSize / 1024);

        // All PDFs are downloaded immediately, not stored
        const hasPdf = false; // PDFs are never stored, only downloaded

        console.log("🔍 Rendering export item:", {
          id: exportItem.id,
          title: exportItem.threadTitle,
          pdfStored: exportItem.pdfStored,
          hasPdfBase64: !!exportItem.pdfBase64,
          hasPdf: hasPdf,
          pdfSize: exportItem.pdfSize,
        });

        // Create compact entry with download button only
        const downloadButton = `<button data-export-id="${exportItem.id}" class="icon-btn download-btn" title="Download PDF">📥</button>`;

        return `
                <div class="export-item-compact">
                    <div class="export-main">
                        <div class="export-title">${
                          exportItem.threadTitle
                        }</div>
                        <div class="export-meta">${formattedDate} • ${
          exportItem.postCount || exportItem.pageCount
        } posts • ${sizeKB}KB</div>
                    </div>
                    <div class="export-actions-compact">
                        ${downloadButton}
                    </div>
                </div>
            `;
      })
      .join("");

    historyList.innerHTML = historyHTML;

    // Add event listeners to the buttons
    this.setupHistoryEventListeners();
  }

  // Setup event listeners for history buttons
  setupHistoryEventListeners() {
    // Download PDF buttons
    document.querySelectorAll(".download-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const exportId = e.target.getAttribute("data-export-id");
        console.log("🔍 Download button clicked for export:", exportId);
        this.downloadPDF(exportId);
      });
    });
  }

  // Download PDF from background script
  async downloadPDF(exportId) {
    try {
      const exportItem = this.exportHistory.find((exp) => exp.id === exportId);

      if (!exportItem) {
        console.error("Export not found");
        return;
      }

      // Request PDF download from background script
      const response = await chrome.runtime.sendMessage({
        action: "downloadPDF",
        exportId: exportId,
      });

      if (!response || !response.success) {
        console.error("PDF download failed:", response?.error);
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  }

  // Listen for messages from content script
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case "exportComplete":
          this.handleExportComplete();
          break;
        case "exportError":
          this.handleExportError(request.error);
          break;
        case "updateStats":
          this.loadExportStats().then(() => this.updateStatistics());
          break;
      }
    });
  }

  // Handle export completion
  handleExportComplete() {
    console.log("🔍 Export completion detected, refreshing history...");
    // Update stats
    this.exportStats.totalExports++;
    this.exportStats.lastExport = new Date().toISOString();
    this.saveExportStats();
    this.updateStatistics();

    // Refresh export history
    this.loadExportHistory();
  }

  // Handle export error
  handleExportError(error) {
    // Just log the error, no UI changes needed
    console.error("Export error:", error);
  }

  // Save export statistics
  async saveExportStats() {
    try {
      await chrome.storage.local.set({ exportStats: this.exportStats });
    } catch (error) {
      console.error("Error saving export stats:", error);
    }
  }

  // Update storage display in UI
  updateStorageDisplay() {
    if (!this.storageStats) return;

    // Find or create storage info element
    let storageInfo = document.getElementById('storage-info');
    if (!storageInfo) {
      // Create storage info element
      storageInfo = document.createElement('div');
      storageInfo.id = 'storage-info';
      storageInfo.className = 'storage-info';
      
      // Insert after export history section
      const exportHistory = document.getElementById('export-history-list');
      if (exportHistory && exportHistory.parentNode) {
        exportHistory.parentNode.insertBefore(storageInfo, exportHistory.nextSibling);
      }
    }

    // Format storage usage
    const chromeUsed = this.storageStats.chromeStorage ? 
      (this.storageStats.chromeStorage.used / 1024 / 1024).toFixed(1) : 0;
    const chromeQuota = this.storageStats.chromeStorage ? 
      (this.storageStats.chromeStorage.quota / 1024 / 1024).toFixed(1) : 10;
    const chromePercent = this.storageStats.chromeStorage ? 
      this.storageStats.chromeStorage.percentage.toFixed(1) : 0;

    const idbUsed = this.storageStats.indexedDB ? 
      (this.storageStats.indexedDB.used / 1024 / 1024).toFixed(1) : 0;
    const idbQuota = this.storageStats.indexedDB ? 
      (this.storageStats.indexedDB.quota / 1024 / 1024).toFixed(1) : 500;

    const pdfCount = this.storageStats.indexedDB ? 
      this.storageStats.indexedDB.pdfCount : 0;

    // Update storage info display
    storageInfo.innerHTML = `
      <div class="storage-stats">
        <div class="storage-item">
          <span class="storage-label">Metadata:</span>
          <span class="storage-value">${chromeUsed}MB / ${chromeQuota}MB (${chromePercent}%)</span>
        </div>
        <div class="storage-item">
          <span class="storage-label">PDFs:</span>
          <span class="storage-value">${pdfCount} files, ${idbUsed}MB / ${idbQuota}MB</span>
        </div>
      </div>
    `;
  }

  // Clear export history
  async clearExportHistory() {
    try {
      // Clear from background script
      await chrome.runtime.sendMessage({
        action: "clearExportHistory",
      });

      // Clear local data
      this.exportHistory = [];
      this.exportStats = { totalExports: 0, lastExport: null };
      this.storageStats = null;

      // Update UI immediately
      this.renderExportHistory();
      this.updateStats();
      this.updateStorageDisplay();
    } catch (error) {
      console.error("Error clearing export history:", error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.popupManager = new PopupManager();
});
