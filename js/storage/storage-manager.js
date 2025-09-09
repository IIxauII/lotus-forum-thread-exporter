/**
 * @fileoverview Storage Manager - Central coordination for all storage operations
 * 
 * This module provides a unified API for storage operations across Chrome Storage API
 * and IndexedDB. It coordinates between different storage types and provides a clean
 * interface for the rest of the application.
 * 
 * @author Lotus Forum Community
 * @version 1.0.0
 * @since 1.0.0
 */

import { ChromeStorageManager } from './chrome-storage.js';
import { IndexedDBManager } from './indexeddb-manager.js';
import { CleanupManager } from './cleanup-manager.js';

export class StorageManager {
  constructor() {
    this.chromeStorage = null;
    this.indexedDB = null;
    this.cleanupManager = null;
    this.initialized = false;
  }

  /**
   * Initialize the storage manager and all sub-modules
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Initialize modules (static imports)
      this.chromeStorage = new ChromeStorageManager();
      this.indexedDB = new IndexedDBManager();
      this.cleanupManager = new CleanupManager(this.chromeStorage, this.indexedDB);

      // Initialize all modules
      await this.chromeStorage.initialize();
      await this.indexedDB.initialize();
      await this.cleanupManager.initialize();

      this.initialized = true;
      // Debug: combined storage snapshot
      try {
        const metadata = await this.chromeStorage.getExportHistory();
        const idbStats = await this.indexedDB.getStorageStats();
        console.log('Storage Manager: Initialized successfully', {
          metadataCount: Array.isArray(metadata) ? metadata.length : 0,
          firstItems: (metadata || []).slice(0, 3).map(e => ({ id: e.id, size: e.pdfSize, title: e.threadTitle })),
          idb: idbStats
        });
      } catch (_) {
        console.log('Storage Manager: Initialized successfully');
      }
      return true;
    } catch (error) {
      console.error('Storage Manager: Initialization failed', error);
      return false;
    }
  }

  /**
   * Store a complete export (metadata + PDF + logs)
   * @param {Object} exportData - Complete export data
   * @param {string} exportData.id - Export ID
   * @param {string} exportData.threadTitle - Thread title
   * @param {string} exportData.threadUrl - Thread URL
   * @param {string} exportData.exportDate - Export date
   * @param {number} exportData.pdfSize - PDF size in bytes
   * @param {number} exportData.postCount - Number of posts
   * @param {Blob} exportData.pdfBlob - PDF blob data
   * @param {Array} exportData.logs - Console logs
   * @returns {Promise<Object>} Storage result
   */
  async storeExport(exportData) {
    if (!this.initialized) {
      throw new Error('Storage Manager not initialized');
    }

    try {
      // Store metadata in Chrome Storage
      const metadataResult = await this.chromeStorage.storeExportMetadata(exportData);

      // Store PDF blob in IndexedDB only if provided
      let pdfResult = null;
      if (exportData && exportData.pdfBlob) {
        pdfResult = await this.indexedDB.storePdf(exportData.id, exportData.pdfBlob);
      }

      // Store logs in IndexedDB only if provided
      let logsResult = null;
      if (exportData && (Array.isArray(exportData.logs) || Array.isArray(exportData.consoleLogs))) {
        const logs = Array.isArray(exportData.logs) ? exportData.logs : (exportData.consoleLogs || []);
        logsResult = await this.indexedDB.storeLogs(exportData.id, logs);
      }

      // Update storage statistics if we know the PDF size
      if (typeof exportData.pdfSize === 'number') {
        await this.chromeStorage.updateStorageStats(exportData.pdfSize, 1);
      }

      // Trigger cleanup if needed
      await this.cleanupManager.checkAndCleanup();

      return {
        success: true,
        metadata: metadataResult,
        pdf: pdfResult,
        logs: logsResult
      };
    } catch (error) {
      console.error('Storage Manager: Failed to store export', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve a PDF for download
   * @param {string} exportId - Export ID
   * @returns {Promise<Object>} PDF data or error
   */
  async getPdf(exportId) {
    if (!this.initialized) {
      throw new Error('Storage Manager not initialized');
    }

    try {
      const pdfData = await this.indexedDB.getPdf(exportId);
      
      if (!pdfData) {
        return {
          success: false,
          error: 'PDF not found in storage'
        };
      }

      // Update access tracking
      await this.indexedDB.updateAccessTracking(exportId);

      return {
        success: true,
        pdfBlob: pdfData.pdfBlob,
        metadata: pdfData.metadata
      };
    } catch (error) {
      console.error('Storage Manager: Failed to get PDF', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get export history (metadata only)
   * @returns {Promise<Array>} Export history
   */
  async getExportHistory() {
    if (!this.initialized) {
      throw new Error('Storage Manager not initialized');
    }

    try {
      return await this.chromeStorage.getExportHistory();
    } catch (error) {
      console.error('Storage Manager: Failed to get export history', error);
      return [];
    }
  }

  /**
   * Clear all storage data
   * @returns {Promise<Object>} Clear result
   */
  async clearAllStorage() {
    if (!this.initialized) {
      throw new Error('Storage Manager not initialized');
    }

    try {
      // Clear Chrome Storage
      const chromeResult = await this.chromeStorage.clearAll();
      
      // Clear IndexedDB
      const indexedDBResult = await this.indexedDB.clearAll();

      return {
        success: true,
        chrome: chromeResult,
        indexedDB: indexedDBResult
      };
    } catch (error) {
      console.error('Storage Manager: Failed to clear storage', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    if (!this.initialized) {
      throw new Error('Storage Manager not initialized');
    }

    try {
      const chromeStats = await this.chromeStorage.getStorageStats();
      const indexedDBStats = await this.indexedDB.getStorageStats();

      return {
        chrome: chromeStats,
        indexedDB: indexedDBStats,
        total: {
          usage: chromeStats.usage + indexedDBStats.totalSize,
          quota: chromeStats.quota + indexedDBStats.estimatedQuota,
          percentage: ((chromeStats.usage + indexedDBStats.totalSize) / (chromeStats.quota + indexedDBStats.estimatedQuota)) * 100
        }
      };
    } catch (error) {
      console.error('Storage Manager: Failed to get storage stats', error);
      return null;
    }
  }

  /**
   * Check if storage is healthy
   * @returns {Promise<boolean>} Storage health status
   */
  async isStorageHealthy() {
    if (!this.initialized) {
      return false;
    }

    try {
      const stats = await this.getStorageStats();
      return stats && stats.total.percentage < 90; // Healthy if under 90% usage
    } catch (error) {
      console.error('Storage Manager: Failed to check storage health', error);
      return false;
    }
  }
}
