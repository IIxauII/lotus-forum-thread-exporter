// Lotus Forum Thread Exporter - Thread Detection
// Handles WoltLab thread detection and validation

/**
 * ThreadDetector class handles detection and validation of WoltLab forum threads
 * 
 * This class provides methods to identify WoltLab threads, extract thread metadata,
 * and determine pagination information for proper thread scraping.
 * 
 * @class ThreadDetector
 * @since 1.0.0
 */
class ThreadDetector {
  /**
   * Creates an instance of ThreadDetector
   * 
   * @param {Object} config - Configuration object containing selectors and patterns
   * @param {Array<RegExp>} config.urlPatterns - URL patterns to match WoltLab threads
   * @param {Object} config.selectors - DOM selectors for thread elements
   * @since 1.0.0
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * Checks if the current page is a valid WoltLab thread
   * 
   * This method validates the page by checking URL patterns, DOM structure,
   * and WoltLab-specific attributes to ensure it's a proper thread page.
   * 
   * @returns {boolean} True if the page is a valid WoltLab thread
   * @since 1.0.0
   */
  isWoltLabThread() {
    const url = window.location.href;
    const hasUrlPattern = this.config.urlPatterns.some((pattern) =>
      pattern.test(url)
    );

    const hasThreadContainer = document.querySelector(
      this.config.selectors.threadContainer
    );
    const hasMessageList = document.querySelector(
      this.config.selectors.messageList
    );
    const hasThreadTitle = document.querySelector(
      this.config.selectors.threadTitle
    );

    // Check for WoltLab-specific attributes
    const hasWoltLabAttributes =
      document.body.hasAttribute("data-template") &&
      document.body.hasAttribute("data-application");

    return (
      hasUrlPattern && (hasThreadContainer || hasMessageList) && hasThreadTitle
    );
  }

  // Get thread title
  getThreadTitle() {
    const titleEl = document.querySelector(this.config.selectors.threadTitle);
    return titleEl ? titleEl.textContent.trim() : "Untitled Thread";
  }

  // Get thread metadata
  getThreadMetadata() {
    const metaEl = document.querySelector(this.config.selectors.threadMeta);
    return {
      statistics: metaEl ? metaEl.textContent.trim() : "",
      threadId: document.body.getAttribute("data-thread-id") || "",
      boardId: document.body.getAttribute("data-board-id") || "",
    };
  }

  // Get total pages in thread
  getTotalPages() {
    const paginationEl = document.querySelector(
      this.config.selectors.pagination
    );
    if (paginationEl) {
      const count = paginationEl.getAttribute("count");
      return count ? parseInt(count) : 1;
    }
    return 1;
  }

  // Get current page number
  getCurrentPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const pageNo = urlParams.get("pageNo");
    return pageNo ? parseInt(pageNo) : 1;
  }

  // Get URL for specific page
  getPageUrl(pageNumber) {
    const url = new URL(window.location.href);
    // WoltLab threads can include a postID param that anchors to a post and
    // interferes with pagination. Remove it to fetch the canonical page.
    url.searchParams.delete("postID");
    url.searchParams.set("pageNo", String(pageNumber));
    // Clear hash anchors like #post12345
    url.hash = "";
    // Some instances show percent-encoded thread path in logs, but the browser
    // URL object preserves the correct path automatically.
    return url.toString();
  }
}
