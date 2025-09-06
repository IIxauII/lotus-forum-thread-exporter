// Lotus Forum Thread Exporter - Thread Scraper
// Handles scraping of thread content from current and additional pages

class ThreadScraper {
  constructor(config, detector) {
    this.config = config;
    this.detector = detector;
  }

  // Scrape thread data from current page and all pages
  async scrapeThreadData() {
    const threadData = {
      title: this.detector.getThreadTitle(),
      url: window.location.href,
      posts: [],
      metadata: this.detector.getThreadMetadata(),
      scrapedAt: new Date().toISOString(),
    };

    // Scrape current page
    const currentPagePosts = this.scrapeCurrentPage();
    threadData.posts.push(...currentPagePosts);

    // Check for pagination and scrape additional pages
    const totalPages = this.detector.getTotalPages();
    if (totalPages > 1) {
      for (
        let page = 2;
        page <= Math.min(totalPages, this.config.export.maxPages);
        page++
      ) {
        try {
          const pagePosts = await this.scrapePage(page);
          threadData.posts.push(...pagePosts);
        } catch (error) {
          console.warn(`Failed to scrape page ${page}:`, error);
        }
      }
    }
    return threadData;
  }

  // Scrape posts from current page - Updated for actual WoltLab structure
  scrapeCurrentPage() {
    const posts = [];

    // Use the correct selector from config
    const messageElements = document.querySelectorAll(
      this.config.selectors.message
    );

    if (messageElements.length === 0) {
      // Fallback: look for any element that might contain post content
      const fallbackElements = document.querySelectorAll(
        'div[class*="message"], article[class*="message"]'
      );
      return posts; // Return empty if no elements found
    }

    messageElements.forEach((messageEl, index) => {
      const post = {
        id: `post-${Date.now()}-${index}`,
        postNumber: this.getPostNumber(messageEl),
        postUrl: this.getPostUrl(messageEl),
        author: this.getPostAuthor(messageEl),
        date: this.getPostDate(messageEl),
        content: this.getPostContent(messageEl),
        attachments: this.getPostAttachments(messageEl),
        quotes: this.getPostQuotes(messageEl),
        page: 1,
      };

      // Only add posts that have some content
      if (post.content.length > 0 || post.author !== "Unknown Author") {
        posts.push(post);
      }
    });

    return posts;
  }

  // Scrape a specific page
  async scrapePage(pageNumber) {
    const pageUrl = this.detector.getPageUrl(pageNumber);
    if (!pageUrl) throw new Error(`No URL found for page ${pageNumber}`);

    try {
      const response = await fetch(pageUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const posts = [];
      const messageElements = doc.querySelectorAll(
        this.config.selectors.message
      );

      messageElements.forEach((messageEl, index) => {
        const post = {
          id: `post-${Date.now()}-${pageNumber}-${index}`,
          postNumber: this.getPostNumber(messageEl),
          postUrl: this.getPostUrl(messageEl),
          author: this.getPostAuthor(messageEl),
          date: this.getPostDate(messageEl),
          content: this.getPostContent(messageEl),
          attachments: this.getPostAttachments(messageEl),
          quotes: this.getPostQuotes(messageEl),
          page: pageNumber,
        };
        posts.push(post);
      });

      return posts;
    } catch (error) {
      throw new Error(`Failed to scrape page ${pageNumber}: ${error.message}`);
    }
  }

  // Helper functions for data extraction - Updated for actual structure
  getPostNumber(messageEl) {
    // Look for the post number link with class wsShareButton (e.g., #1, #2, etc.)
    const postNumberEl = messageEl.querySelector(
      'a.wsShareButton[href*="postID"]'
    );
    if (postNumberEl) {
      const text = postNumberEl.textContent.trim();
      // Check if it's just a number (like #1, #2, etc.)
      if (text.match(/^#\d+$/)) {
        return text;
      }
    }

    return "";
  }

  getPostUrl(messageEl) {
    // Look for the post number link to get the URL
    const postNumberEl = messageEl.querySelector(
      'a.wsShareButton[href*="postID"]'
    );
    if (postNumberEl && postNumberEl.href) {
      return postNumberEl.href;
    }

    return "";
  }

  getPostAuthor(messageEl) {
    const authorEl = messageEl.querySelector(
      this.config.selectors.messageAuthor
    );
    if (authorEl && authorEl.textContent.trim()) {
      return authorEl.textContent.trim();
    }

    return "Unknown Author";
  }

  getPostDate(messageEl) {
    const dateEl = messageEl.querySelector(this.config.selectors.messageDate);
    if (dateEl && dateEl.textContent.trim()) {
      return dateEl.textContent.trim();
    }

    return "";
  }

  getPostContent(messageEl) {
    const contentEl = messageEl.querySelector(
      this.config.selectors.messageText
    );
    if (contentEl && contentEl.textContent.trim()) {
      // Clean up the content
      const content = contentEl.cloneNode(true);

      // Remove unwanted elements
      const unwantedSelectors = [
        ".quoteBox",
        ".attachmentThumbnail",
        ".messageFooter",
      ];
      unwantedSelectors.forEach((sel) => {
        const elements = content.querySelectorAll(sel);
        elements.forEach((el) => el.remove());
      });

      return content.innerHTML;
    }

    // Fallback: get all text content
    return messageEl.textContent.trim();
  }

  getPostAttachments(messageEl) {
    const attachments = [];
    const attachmentEls = messageEl.querySelectorAll(
      this.config.selectors.attachmentLink
    );

    attachmentEls.forEach((attachmentEl) => {
      const filenameEl = attachmentEl.querySelector(
        this.config.selectors.attachment
      );
      if (attachmentEl.href) {
        attachments.push({
          filename: filenameEl ? filenameEl.textContent.trim() : "Attachment",
          url: attachmentEl.href,
          type: this.getAttachmentType(attachmentEl.href),
        });
      }
    });

    return attachments;
  }

  getPostQuotes(messageEl) {
    const quotes = [];
    const quoteEls = messageEl.querySelectorAll("blockquote.quoteBox");

    quoteEls.forEach((quoteEl) => {
      const titleEl = quoteEl.querySelector(".quoteBoxTitle a");
      const contentEl = quoteEl.querySelector(".quoteBoxContent");

      quotes.push({
        title: titleEl ? titleEl.textContent.trim() : "",
        content: contentEl ? contentEl.innerHTML : "",
        author: this.extractQuoteAuthor(titleEl),
      });
    });

    return quotes;
  }

  extractQuoteAuthor(titleEl) {
    if (!titleEl) return "";
    const text = titleEl.textContent.trim();
    // Extract author from "Quote from rasehase" -> "rasehase"
    const match = text.match(/Quote from (.+)/);
    return match ? match[1] : "";
  }

  getAttachmentType(url) {
    const extension = url.split(".").pop().toLowerCase();
    const imageTypes = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const videoTypes = ["mp4", "avi", "mov", "wmv"];
    const audioTypes = ["mp3", "wav", "ogg", "m4a"];

    if (imageTypes.includes(extension)) return "image";
    if (videoTypes.includes(extension)) return "video";
    if (audioTypes.includes(extension)) return "audio";
    return "file";
  }
}
