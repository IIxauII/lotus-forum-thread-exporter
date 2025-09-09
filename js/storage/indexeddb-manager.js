/**
 * @fileoverview IndexedDB Manager - Handles IndexedDB operations for large data
 * 
 * This module manages all IndexedDB operations including PDF storage, log storage,
 * and detailed export metadata. It provides efficient storage for large binary data
 * and structured information that doesn't need fast synchronous access.
 * 
 * @author Lotus Forum Community
 * @version 1.0.0
 * @since 1.0.0
 */

export class IndexedDBManager {
  constructor() {
    this.db = null;
    this.dbName = 'lotusExporter';
    this.dbVersion = 1;
    this.initialized = false;
  }

  /**
   * Initialize IndexedDB database
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      this.db = await this.openDatabase();
      this.initialized = true;
      console.log('IndexedDB: Initialized successfully');

      // Debug: enumerate a small summary of current DB contents
      try {
        const pdfStats = await this.getObjectStoreStats('pdfs');
        const logsStats = await this.getObjectStoreStats('logs');
        const detailsStats = await this.getObjectStoreStats('exportDetails');
        console.log('IndexedDB: Snapshot', {
          pdfs: pdfStats,
          logs: logsStats,
          details: detailsStats
        });
      } catch (_) {}
      return true;
    } catch (error) {
      console.error('IndexedDB: Initialization failed', error);
      return false;
    }
  }

  /**
   * Open or create IndexedDB database
   * @returns {Promise<IDBDatabase>} Database instance
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create PDFs object store
        if (!db.objectStoreNames.contains('pdfs')) {
          const pdfStore = db.createObjectStore('pdfs', { keyPath: 'exportId' });
          pdfStore.createIndex('createdAt', 'createdAt', { unique: false });
          pdfStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          pdfStore.createIndex('accessCount', 'accessCount', { unique: false });
        }
        
        // Create logs object store
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'exportId' });
          logStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Create export details object store
        if (!db.objectStoreNames.contains('exportDetails')) {
          const detailsStore = db.createObjectStore('exportDetails', { keyPath: 'exportId' });
          detailsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store PDF blob
   * @param {string} exportId - Export ID
   * @param {Blob} pdfBlob - PDF blob data
   * @returns {Promise<boolean>} Success status
   */
  async storePdf(exportId, pdfBlob) {
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      if (!pdfBlob) {
        throw new TypeError('PDF blob is missing');
      }
      const transaction = this.db.transaction(['pdfs'], 'readwrite');
      const store = transaction.objectStore('pdfs');
      
      const record = {
        exportId,
        pdfBlob,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
      
      console.log('IndexedDB: PDF stored successfully', { exportId, size: pdfBlob && pdfBlob.size });
      return true;
    } catch (error) {
      console.error('IndexedDB: Failed to store PDF', error);
      throw error;
    }
  }

  /**
   * Retrieve PDF blob
   * @param {string} exportId - Export ID
   * @returns {Promise<Object|null>} PDF data or null
   */
  async getPdf(exportId) {
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      const transaction = this.db.transaction(['pdfs'], 'readwrite');
      const store = transaction.objectStore('pdfs');
      
      const result = await new Promise((resolve, reject) => {
        const request = store.get(exportId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (result) {
        // Update access tracking
        result.lastAccessed = Date.now();
        result.accessCount++;
        
        // Update the record
        const updateTransaction = this.db.transaction(['pdfs'], 'readwrite');
        const updateStore = updateTransaction.objectStore('pdfs');
        updateStore.put(result);
      }
      
      return result;
    } catch (error) {
      console.error('IndexedDB: Failed to get PDF', error);
      return null;
    }
  }

  /**
   * Store console logs
   * @param {string} exportId - Export ID
   * @param {Array} logs - Console logs array
   * @returns {Promise<boolean>} Success status
   */
  async storeLogs(exportId, logs) {
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      const transaction = this.db.transaction(['logs'], 'readwrite');
      const store = transaction.objectStore('logs');
      
      const record = {
        exportId,
        logs,
        createdAt: Date.now()
      };
      
      await new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
      
      console.log('IndexedDB: Logs stored successfully', { exportId, logCount: logs.length });
      return true;
    } catch (error) {
      console.error('IndexedDB: Failed to store logs', error);
      throw error;
    }
  }

  /**
   * Retrieve console logs
   * @param {string} exportId - Export ID
   * @returns {Promise<Array>} Console logs
   */
  async getLogs(exportId) {
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      const transaction = this.db.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      
      const result = await new Promise((resolve, reject) => {
        const request = store.get(exportId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return result ? result.logs : [];
    } catch (error) {
      console.error('IndexedDB: Failed to get logs', error);
      return [];
    }
  }

  /**
   * Update access tracking for a PDF
   * @param {string} exportId - Export ID
   * @returns {Promise<boolean>} Success status
   */
  async updateAccessTracking(exportId) {
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      const transaction = this.db.transaction(['pdfs'], 'readwrite');
      const store = transaction.objectStore('pdfs');
      
      const result = await new Promise((resolve, reject) => {
        const request = store.get(exportId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (result) {
        result.lastAccessed = Date.now();
        result.accessCount++;
        
        await new Promise((resolve, reject) => {
          const updateRequest = store.put(result);
          updateRequest.onsuccess = () => resolve(true);
          updateRequest.onerror = () => reject(updateRequest.error);
        });
      }
      
      return true;
    } catch (error) {
      console.error('IndexedDB: Failed to update access tracking', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      const pdfStats = await this.getObjectStoreStats('pdfs');
      const logStats = await this.getObjectStoreStats('logs');
      const detailsStats = await this.getObjectStoreStats('exportDetails');
      
      return {
        pdfs: pdfStats,
        logs: logStats,
        details: detailsStats,
        totalSize: pdfStats.totalSize + logStats.totalSize + detailsStats.totalSize,
        totalCount: pdfStats.count + logStats.count + detailsStats.count,
        estimatedQuota: 500 * 1024 * 1024 // 500MB estimated quota
      };
    } catch (error) {
      console.error('IndexedDB: Failed to get storage stats', error);
      return {
        pdfs: { count: 0, totalSize: 0 },
        logs: { count: 0, totalSize: 0 },
        details: { count: 0, totalSize: 0 },
        totalSize: 0,
        totalCount: 0,
        estimatedQuota: 500 * 1024 * 1024
      };
    }
  }

  /**
   * Get statistics for a specific object store
   * @param {string} storeName - Object store name
   * @returns {Promise<Object>} Store statistics
   */
  async getObjectStoreStats(storeName) {
    try {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const records = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const totalSize = records.reduce((sum, record) => {
        if (record.pdfBlob) return sum + record.pdfBlob.size;
        if (record.logs) return sum + JSON.stringify(record.logs).length;
        if (record.detailedMetadata) return sum + JSON.stringify(record.detailedMetadata).length;
        return sum;
      }, 0);
      
      return {
        count: records.length,
        totalSize,
        averageSize: records.length > 0 ? totalSize / records.length : 0
      };
    } catch (error) {
      console.error('IndexedDB: Failed to get object store stats', error);
      return { count: 0, totalSize: 0, averageSize: 0 };
    }
  }

  /**
   * Clear all IndexedDB data
   * @returns {Promise<boolean>} Success status
   */
  async clearAll() {
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      const objectStores = ['pdfs', 'logs', 'exportDetails'];
      
      for (const storeName of objectStores) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve(true);
          request.onerror = () => reject(request.error);
        });
      }
      
      console.log('IndexedDB: All data cleared successfully');
      return true;
    } catch (error) {
      console.error('IndexedDB: Failed to clear data', error);
      return false;
    }
  }

  /**
   * Clean up old data based on age
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldData(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days default
    if (!this.initialized) {
      throw new Error('IndexedDB not initialized');
    }

    try {
      const cutoffTime = Date.now() - maxAge;
      const objectStores = ['pdfs', 'logs', 'exportDetails'];
      let totalRemoved = 0;
      
      for (const storeName of objectStores) {
        const removed = await this.cleanupObjectStore(storeName, 'createdAt', cutoffTime);
        totalRemoved += removed;
      }
      
      console.log('IndexedDB: Cleanup completed', { removed: totalRemoved });
      return { success: true, removed: totalRemoved };
    } catch (error) {
      console.error('IndexedDB: Cleanup failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up specific object store
   * @param {string} storeName - Object store name
   * @param {string} indexName - Index name
   * @param {number} cutoffTime - Cutoff timestamp
   * @returns {Promise<number>} Number of records removed
   */
  async cleanupObjectStore(storeName, indexName, cutoffTime) {
    try {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const range = IDBKeyRange.upperBound(cutoffTime);
      
      let removedCount = 0;
      
      await new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            removedCount++;
            cursor.continue();
          } else {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });
      
      return removedCount;
    } catch (error) {
      console.error('IndexedDB: Failed to cleanup object store', error);
      return 0;
    }
  }
}
