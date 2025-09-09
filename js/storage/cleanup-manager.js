/**
 * @fileoverview Cleanup Manager - Automatic storage cleanup and retention policies
 *
 * Coordinates quota-based, age-based, and access-based cleanup across
 * Chrome Storage (metadata) and IndexedDB (PDFs, logs, details).
 *
 * No artificial limits are applied. Cleanup is driven strictly by:
 * - Quota thresholds
 * - Max age policies (PDFs, logs)
 * - Inactivity/access patterns
 */

export class CleanupManager {
  constructor(chromeStorageManager, indexedDBManager) {
    this.chromeStorage = chromeStorageManager;
    this.indexedDB = indexedDBManager;
    this.initialized = false;

    // Defaults (milliseconds)
    this.options = {
      quotaThresholdPercent: 80, // trigger cleanup when above this percent
      pdfMaxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      logMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxInactiveMs: 60 * 24 * 60 * 60 * 1000, // 60 days since last access
      minRecentKeep: 20 // do not remove newest this many metadata entries when cleaning metadata
    };

    this._periodicTimerId = null;
  }

  async initialize(customOptions = {}) {
    Object.assign(this.options, customOptions);
    this.initialized = true;
    return true;
  }

  /**
   * Public entrypoint to assess storage and perform cleanup if needed.
   */
  async checkAndCleanup() {
    if (!this.initialized) return false;

    try {
      // Quota-driven cleanup
      await this.cleanupByQuota();

      // Opportunistic age/inactivity cleanup (non-blocking best-effort)
      await this.cleanupByAge();
      await this.cleanupByInactivity();

      return true;
    } catch (err) {
      console.error('CleanupManager: checkAndCleanup failed', err);
      return false;
    }
  }

  /**
   * Cleanup when storage is approaching quota thresholds (Chrome + IndexedDB)
   */
  async cleanupByQuota() {
    // Chrome storage (metadata)
    const chromeStats = await this.chromeStorage.getStorageStats();
    if (chromeStats.percentage >= this.options.quotaThresholdPercent) {
      await this._cleanupChromeMetadataByQuota();
    }

    // IndexedDB (PDFs/logs/details)
    const idbStats = await this.indexedDB.getStorageStats();
    const idbPercent = (idbStats.totalSize / idbStats.estimatedQuota) * 100;
    if (idbPercent >= this.options.quotaThresholdPercent) {
      await this._cleanupIndexedDbByQuota();
    }
  }

  /**
   * Remove oldest metadata beyond minRecentKeep until under threshold.
   * Never applies arbitrary caps; purely quota-driven.
   */
  async _cleanupChromeMetadataByQuota() {
    try {
      const history = await this.chromeStorage.getExportHistory();
      if (!Array.isArray(history) || history.length <= this.options.minRecentKeep) {
        return;
      }

      // Compute current usage and quota directly for precision
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 10 * 1024 * 1024;

      // Remove oldest entries (beyond minRecentKeep) until back under threshold
      let index = history.length - 1; // start from oldest
      const keepUntil = this.options.minRecentKeep;
      while (index >= keepUntil && (usage / quota) * 100 >= this.options.quotaThresholdPercent) {
        const removed = history.splice(index, 1);
        index--;
        await chrome.storage.local.set({ exportHistory: history });
        // Re-read usage after each removal to decide further trimming
        const updatedUsage = await chrome.storage.local.getBytesInUse();
        if (updatedUsage === usage) break; // safeguard if usage cannot be reduced further
      }
    } catch (err) {
      console.warn('CleanupManager: Chrome metadata quota cleanup failed', err);
    }
  }

  /**
   * Remove least-recently-accessed PDFs first until under threshold.
   */
  async _cleanupIndexedDbByQuota() {
    try {
      const db = this.indexedDB.db;
      if (!db) return;

      const stats = await this.indexedDB.getStorageStats();
      const quota = stats.estimatedQuota || 500 * 1024 * 1024;
      let percent = (stats.totalSize / quota) * 100;
      if (percent < this.options.quotaThresholdPercent) return;

      // Iterate PDFs by lastAccessed ascending (oldest accessed first)
      const tx = db.transaction(['pdfs'], 'readwrite');
      const store = tx.objectStore('pdfs');
      const index = store.index('lastAccessed');

      await new Promise((resolve, reject) => {
        const cursorReq = index.openCursor();
        cursorReq.onsuccess = async (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return resolve(true);

          // Delete this least-recently-accessed PDF and re-evaluate quota
          await new Promise((res, rej) => {
            const delReq = cursor.delete();
            delReq.onsuccess = () => res(true);
            delReq.onerror = () => rej(delReq.error);
          });

          // Recompute size; if under threshold, stop
          const newStats = await this.indexedDB.getStorageStats();
          percent = (newStats.totalSize / quota) * 100;
          if (percent < this.options.quotaThresholdPercent) return resolve(true);

          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch (err) {
      console.warn('CleanupManager: IndexedDB quota cleanup failed', err);
    }
  }

  /**
   * Age-based cleanup for PDFs, logs, and export details
   */
  async cleanupByAge() {
    try {
      const now = Date.now();
      const pdfCutoff = now - this.options.pdfMaxAgeMs;
      const logCutoff = now - this.options.logMaxAgeMs;

      // Clean PDFs older than pdfMaxAgeMs
      await this.indexedDB.cleanupObjectStore('pdfs', 'createdAt', pdfCutoff);
      // Clean logs older than logMaxAgeMs
      await this.indexedDB.cleanupObjectStore('logs', 'createdAt', logCutoff);
      // Optionally clean exportDetails on same cadence as PDFs
      await this.indexedDB.cleanupObjectStore('exportDetails', 'createdAt', pdfCutoff);
    } catch (err) {
      console.warn('CleanupManager: Age-based cleanup failed', err);
    }
  }

  /**
   * Inactivity cleanup: remove PDFs not accessed for a while
   */
  async cleanupByInactivity() {
    try {
      const db = this.indexedDB.db;
      if (!db) return;
      const cutoff = Date.now() - this.options.maxInactiveMs;

      const tx = db.transaction(['pdfs'], 'readwrite');
      const store = tx.objectStore('pdfs');
      const index = store.index('lastAccessed');

      await new Promise((resolve, reject) => {
        const range = IDBKeyRange.upperBound(cutoff);
        const cursorReq = index.openCursor(range);
        cursorReq.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return resolve(true);
          cursor.delete();
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch (err) {
      console.warn('CleanupManager: Inactivity cleanup failed', err);
    }
  }

  /**
   * Start background periodic cleanup (best-effort; timers may be throttled in SW)
   */
  startPeriodicCleanup(intervalMs = 24 * 60 * 60 * 1000) {
    this.stopPeriodicCleanup();
    this._periodicTimerId = setInterval(() => {
      this.checkAndCleanup();
    }, intervalMs);
  }

  stopPeriodicCleanup() {
    if (this._periodicTimerId) {
      clearInterval(this._periodicTimerId);
      this._periodicTimerId = null;
    }
  }
}


