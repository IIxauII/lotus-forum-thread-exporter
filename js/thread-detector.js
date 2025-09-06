// Lotus Forum Thread Exporter - Thread Detection
// Handles WoltLab thread detection and validation

class ThreadDetector {
  constructor(config) {
    this.config = config;
  }

  // Check if current page is a WoltLab thread
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

  // Get URL for specific page
  getPageUrl(pageNumber) {
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split("?")[0];
    const params = new URLSearchParams(window.location.search);
    params.set("pageNo", pageNumber);
    return `${baseUrl}?${params.toString()}`;
  }
}
