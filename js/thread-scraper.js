// Lotus Forum Thread Exporter - Thread Scraper
// Handles scraping of thread content from current and additional pages

class ThreadScraper {
  constructor(config, detector) {
    this.config = config;
    this.detector = detector;
  }

  // Scrape thread data from current page and all pages
  async scrapeThreadData() {
    logger.log("Scraper: scrapeThreadData start");
    const threadData = {
      title: this.detector.getThreadTitle(),
      url: window.location.href,
      posts: [],
      metadata: this.detector.getThreadMetadata(),
      scrapedAt: new Date().toISOString(),
    };

    // Determine pagination and scrape pages strictly via HTTP in order
    const totalPages = this.detector.getTotalPages();
    const currentPage = this.detector.getCurrentPage();
    logger.log("Scraper: detected pagination", {
      totalPages,
      currentPage,
      maxPages: this.config.export && this.config.export.maxPages,
    });
    logger.log("Scraper: scraping all pages via HTTP", { totalPages });
    for (let page = 1; page <= totalPages; page++) {
      try {
        logger.log("Scraper: fetching page", { page });
        const pagePosts = await this.scrapePage(page);
        logger.log("Scraper: page scraped", {
          page,
          posts: pagePosts.length,
          firstPostNumber: pagePosts[0]?.postNumber,
          lastPostNumber: pagePosts[pagePosts.length - 1]?.postNumber,
        });
        threadData.posts.push(...pagePosts);
      } catch (error) {
        console.warn(`Failed to scrape page ${page}:`, error);
        logger.warn("Scraper: page scrape failed", {
          page,
          message: error && error.message,
        });
      }
    }
    logger.log("Scraper: scrapeThreadData complete", {
      totalPosts: threadData.posts.length,
      firstPostNumber: threadData.posts[0]?.postNumber,
      lastPostNumber: threadData.posts[threadData.posts.length - 1]?.postNumber
    });
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
      logger.warn("Scraper: no message elements on current page");
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
      logger.log("Scraper: requesting page", { pageNumber, pageUrl });
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

      logger.log("Scraper: parsed page", {
        pageNumber,
        posts: posts.length,
      });
      return posts;
    } catch (error) {
      logger.error("Scraper: failed to scrape page", {
        pageNumber,
        message: error && error.message,
      });
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
      // Check if it's a post number (like #1, #2, ##1, etc.) and clean it up
      if (text.match(/^#+\d+$/)) {
        // Clean up multiple # symbols to just one
        return text.replace(/^#+/, '#');
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
    if (!contentEl) return '';

    // Clean up the content by removing unwanted elements
    const cleanedContent = this.cleanContentElement(contentEl);
    
    // Parse and format content directly to final text
    return this.parseAndFormatContent(cleanedContent);
  }

  // Clean content element by removing unwanted elements
  cleanContentElement(element) {
    const cleaned = element.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      ".quoteBox",
      ".attachmentThumbnail", 
      ".messageFooter",
    ];
    
    unwantedSelectors.forEach((sel) => {
      const elements = cleaned.querySelectorAll(sel);
      elements.forEach((el) => el.remove());
    });

    return cleaned;
  }

  // Parse and format content directly to final text
  parseAndFormatContent(element) {
    let result = '';
    
    // Process each child node and format directly
    Array.from(element.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          result += text;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        result += this.formatElement(node);
      }
    });
    
    return this.cleanupWhitespace(result);
  }

  // Format individual HTML element to text
  formatElement(element) {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'p':
        return '\n\n' + this.extractTextContent(element);
      case 'br':
        return '\n';
      case 'strong':
      case 'b':
        return '**' + this.extractTextContent(element) + '**';
      case 'em':
      case 'i':
        return '*' + this.extractTextContent(element) + '*';
      case 'a':
        const text = this.extractTextContent(element);
        const url = element.href;
        return text + ' (' + url + ')';
      case 'blockquote':
        return '\n> ' + this.extractTextContent(element) + '\n';
      case 'ul':
        return '\n' + Array.from(element.querySelectorAll('li'))
          .map(li => '• ' + this.extractTextContent(li))
          .join('\n') + '\n';
      case 'ol':
        return '\n' + Array.from(element.querySelectorAll('li'))
          .map((li, index) => (index + 1) + '. ' + this.extractTextContent(li))
          .join('\n') + '\n';
      case 'div':
        // For divs, process children and combine
        const children = Array.from(element.childNodes)
          .map(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              return node.textContent.trim();
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              return this.formatElement(node);
            }
            return '';
          })
          .filter(text => text);
        
        return children.join('');
      default:
        // For unknown elements, just extract text
        return this.extractTextContent(element);
    }
  }

  // Extract text content from element
  extractTextContent(element) {
    return element.textContent || element.innerText || '';
  }

  // Clean up whitespace in processed text
  cleanupWhitespace(text) {
    return text
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Replace 3+ line breaks with 2
      .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
      .replace(/\n /g, "\n") // Remove spaces at start of lines
      .replace(/ \n/g, "\n") // Remove spaces at end of lines
      .replace(/\n{3,}/g, "\n\n") // Replace 3+ consecutive newlines with 2
      .trim();
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
        content: contentEl ? this.parseAndFormatContent(contentEl) : "",
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
