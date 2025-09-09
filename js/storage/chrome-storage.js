/**
 * @fileoverview Chrome Storage Manager - Handles Chrome Storage API operations
 * 
 * This module manages all Chrome Storage API operations including metadata storage,
 * settings, and storage statistics. It provides a clean interface for storing
 * lightweight data that needs fast access.
 * 
 * @author Lotus Forum Community
 * @version 1.0.0
 * @since 1.0.0
 */

export class ChromeStorageManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize Chrome Storage with default values
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Initialize with default data structure
      const defaultData = {
        exportHistory: [],
        exportStats: {
          totalExports: 0,
          lastExport: null
        },
        storageStats: {
          totalPdfSize: 0,
          pdfCount: 0,
          lastCleanup: null
        }
      };

      // Check if storage is already initialized
      const existing = await chrome.storage.local.get(['exportHistory']);
      if (!existing.exportHistory) {
        await chrome.storage.local.set(defaultData);
      }

      this.initialized = true;
      console.log('Chrome Storage: Initialized successfully');

      // Debug: log current stored metadata snapshot
      try {
        const { exportHistory = [], exportStats = {} } = await chrome.storage.local.get([
          'exportHistory',
          'exportStats'
        ]);
        console.log('Chrome Storage: Snapshot', {
          exportHistoryCount: exportHistory.length,
          firstItems: exportHistory.slice(0, 3).map(e => ({ id: e.id, size: e.pdfSize, title: e.threadTitle })),
          exportStats
        });
      } catch (_) {}
      return true;
    } catch (error) {
      console.error('Chrome Storage: Initialization failed', error);
      return false;
    }
  }

  /**
   * Store export metadata
   * @param {Object} exportData - Export data
   * @returns {Promise<Object>} Stored metadata
   */
  async storeExportMetadata(exportData) {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      const { exportHistory = [] } = await chrome.storage.local.get(['exportHistory']);
      
      // Create lightweight metadata entry
      const metadataEntry = {
        id: exportData.id,
        threadTitle: exportData.threadTitle,
        threadUrl: exportData.threadUrl,
        exportDate: exportData.exportDate,
        pdfSize: exportData.pdfSize,
        postCount: exportData.postCount,
        pageCount: exportData.pageCount,
        pdfStored: true,
        hasLogs: true,
        storageStatus: 'complete'
      };

      // Add to beginning of array (no artificial cap; quota-based cleanup will manage size)
      exportHistory.unshift(metadataEntry);

      await chrome.storage.local.set({ exportHistory });
      
      console.log('Chrome Storage: Metadata stored successfully', { id: exportData.id });
      return metadataEntry;
    } catch (error) {
      console.error('Chrome Storage: Failed to store metadata', error);
      throw error;
    }
  }

  /**
   * Get export history
   * @returns {Promise<Array>} Export history
   */
  async getExportHistory() {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      const { exportHistory = [] } = await chrome.storage.local.get(['exportHistory']);
      return exportHistory;
    } catch (error) {
      console.error('Chrome Storage: Failed to get export history', error);
      return [];
    }
  }

  /**
   * Update storage statistics
   * @param {number} pdfSize - PDF size in bytes
   * @param {number} countChange - Change in count (usually 1 or -1)
   * @returns {Promise<boolean>} Success status
   */
  async updateStorageStats(pdfSize, countChange) {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      const { storageStats = { totalPdfSize: 0, pdfCount: 0 } } = await chrome.storage.local.get(['storageStats']);
      
      storageStats.totalPdfSize += pdfSize;
      storageStats.pdfCount += countChange;
      storageStats.lastCleanup = new Date().toISOString();

      await chrome.storage.local.set({ storageStats });
      return true;
    } catch (error) {
      console.error('Chrome Storage: Failed to update storage stats', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return {
        usage,
        quota,
        percentage: (usage / quota) * 100,
        available: quota - usage
      };
    } catch (error) {
      console.error('Chrome Storage: Failed to get storage stats', error);
      return {
        usage: 0,
        quota: 0,
        percentage: 0,
        available: 0
      };
    }
  }

  /**
   * Update export statistics
   * @param {Object} stats - Export statistics
   * @returns {Promise<boolean>} Success status
   */
  async updateExportStats(stats) {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      await chrome.storage.local.set({ exportStats: stats });
      return true;
    } catch (error) {
      console.error('Chrome Storage: Failed to update export stats', error);
      return false;
    }
  }

  /**
   * Get export statistics
   * @returns {Promise<Object>} Export statistics
   */
  async getExportStats() {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      const { exportStats = { totalExports: 0, lastExport: null } } = await chrome.storage.local.get(['exportStats']);
      return exportStats;
    } catch (error) {
      console.error('Chrome Storage: Failed to get export stats', error);
      return { totalExports: 0, lastExport: null };
    }
  }

  /**
   * Clear all Chrome Storage data
   * @returns {Promise<boolean>} Success status
   */
  async clearAll() {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({});
      
      // Reinitialize with defaults
      await this.initialize();
      
      console.log('Chrome Storage: All data cleared successfully');
      return true;
    } catch (error) {
      console.error('Chrome Storage: Failed to clear data', error);
      return false;
    }
  }

  /**
   * Clean up old metadata entries
   * @param {number} maxEntries - Maximum number of entries to keep
   * @returns {Promise<boolean>} Success status
   */
  async cleanupOldMetadata(maxEntries = 50) {
    if (!this.initialized) {
      throw new Error('Chrome Storage not initialized');
    }

    try {
      const { exportHistory = [] } = await chrome.storage.local.get(['exportHistory']);
      
      if (exportHistory.length > maxEntries) {
        const cleaned = exportHistory.slice(0, maxEntries);
        await chrome.storage.local.set({ exportHistory: cleaned });
        
        // Update storage stats
        const removedCount = exportHistory.length - maxEntries;
        const removedSize = exportHistory.slice(maxEntries).reduce((sum, entry) => sum + (entry.pdfSize || 0), 0);
        await this.updateStorageStats(-removedSize, -removedCount);
        
        console.log('Chrome Storage: Cleaned up old metadata', { removed: removedCount });
      }
      
      return true;
    } catch (error) {
      console.error('Chrome Storage: Failed to cleanup old metadata', error);
      return false;
    }
  }
}
