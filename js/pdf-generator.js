/**
 * @fileoverview Lotus Forum Thread Exporter - PDF Generator
 *
 * This module handles PDF generation using jsPDF directly with a British Racing Green theme.
 * It provides comprehensive functionality for converting forum thread data into well-formatted PDF documents.
 *
 * Features:
 * - Direct jsPDF usage for better control and performance
 * - Preserves clickable links as PDF annotations
 * - British Racing Green color scheme
 * - Proper text formatting and layout
 * - Memory efficient for large threads
 * - Emoji support with text conversion
 * - Alternating post backgrounds for better readability
 * - Comprehensive HTML processing
 *
 * @author Lotus Forum Community
 * @version 1.0.0
 * @since 1.0.0
 */

/**
 * Configuration constants for PDF generation
 * @readonly
 * @namespace PDF_CONSTANTS
 */
const PDF_CONSTANTS = {
  /** @type {number} Page margin in millimeters */
  MARGIN: 15,

  /** @type {number} Line height in millimeters */
  LINE_HEIGHT: 6,

  /** @type {number} Default font size in points */
  FONT_SIZE: 12,

  /** @type {number} Header font size in points */
  HEADER_FONT_SIZE: 18,

  /** @type {number} Post header font size in points */
  POST_HEADER_FONT_SIZE: 14,

  /** @type {Array<number>} Primary color (British Racing Green) as RGB array */
  PRIMARY_COLOR: [0, 51, 51],

  /** @type {Array<number>} Secondary color (Cream/Off-white) as RGB array */
  SECONDARY_COLOR: [250, 248, 245],

  /** @type {Array<number>} Border color (Light green) as RGB array */
  BORDER_COLOR: [200, 220, 200],

  /** @type {Array<number>} Text color (Dark green) as RGB array */
  TEXT_COLOR: [20, 40, 20],

  /** @type {Array<number>} Meta text color (Medium green) as RGB array */
  META_COLOR: [100, 120, 100],

  /** @type {Array<number>} First post background color (White) as RGB array */
  POST_BG_COLOR_1: [255, 255, 255],

  /** @type {Array<number>} Second post background color (Very light green) as RGB array */
  POST_BG_COLOR_2: [248, 252, 248],

  /** @type {Array<number>} Header background color (British Racing Green) as RGB array */
  HEADER_BG_COLOR: [0, 51, 51],

  /** @type {Array<number>} Header text color (Cream) as RGB array */
  HEADER_TEXT_COLOR: [250, 248, 245],

  /** @type {number} Post padding in millimeters */
  POST_PADDING: 6,

  /** @type {number} Bottom margin between posts in millimeters */
  POST_MARGIN_BOTTOM: 8,
};

/**
 * PDFGenerator class handles the generation of PDF documents from forum thread data
 * using jsPDF directly with a British Racing Green theme.
 *
 * This class provides a comprehensive solution for converting forum thread data into
 * well-formatted PDF documents with proper styling, clickable links, and emoji support.
 *
 * Features:
 * - Direct jsPDF usage for better control and performance
 * - Preserves clickable links as PDF annotations
 * - British Racing Green color scheme
 * - Proper text formatting and layout
 * - Memory efficient for large threads
 * - Alternating post backgrounds for better readability
 * - Comprehensive HTML processing and emoji support
 * - Responsive layout with automatic page breaks
 *
 * @class PDFGenerator
 * @example
 * // Basic usage
 * const pdfGenerator = new PDFGenerator();
 * const pdfBlob = await pdfGenerator.generatePDF(threadData);
 *
 * // With custom configuration
 * const config = {
 *   colors: {
 *     primary: '#003333',
 *     secondary: '#f0f8f8',
 *     border: '#c8c8c8'
 *   }
 * };
 * const pdfGenerator = new PDFGenerator(config);
 * const pdfBlob = await pdfGenerator.generatePDF(threadData);
 */
class PDFGenerator {
  /**
   * Creates an instance of PDFGenerator
   *
   * @param {Object} [config] - Configuration object containing color scheme and other settings
   * @param {Object} [config.colors] - Color configuration object
   * @param {string} [config.colors.primary] - Primary color (British Racing Green)
   * @param {string} [config.colors.secondary] - Secondary color
   * @param {string} [config.colors.border] - Border color
   *
   * @example
   * // Default configuration
   * const pdfGenerator = new PDFGenerator();
   *
   * // Custom configuration
   * const config = {
   *   colors: {
   *     primary: '#003333',
   *     secondary: '#f0f8f8',
   *     border: '#c8c8c8'
   *   }
   * };
   * const pdfGenerator = new PDFGenerator(config);
   */
  constructor(config = {}) {
    /** @type {Object} Configuration object */
    this.config = config;

    /** @type {jsPDF|null} The jsPDF document instance */
    this.doc = null;

    /** @type {number} Current Y position on the page in millimeters */
    this.currentY = PDF_CONSTANTS.MARGIN;

    /** @type {number} Page width in millimeters */
    this.pageWidth = 0;

    /** @type {number} Page height in millimeters */
    this.pageHeight = 0;

    /** @type {number} Content width in millimeters (page width minus margins) */
    this.contentWidth = 0;
  }

  /**
   * Generates a PDF document from forum thread data using jsPDF directly
   *
   * This method uses jsPDF directly to create a PDF with proper text formatting,
   * clickable links, and a clean layout. It processes posts sequentially to
   * avoid memory issues with large threads.
   *
   * The generated PDF includes:
   * - Thread header with title, source URL, and metadata
   * - Alternating post backgrounds for better readability
   * - Clickable links for posts and attachments
   * - Proper HTML processing with emoji support
   * - Responsive layout with automatic page breaks
   *
   * @param {Object} threadData - The forum thread data to convert to PDF
   * @param {string} threadData.title - Thread title
   * @param {string} threadData.url - Thread URL
   * @param {string} threadData.scrapedAt - Timestamp when thread was scraped
   * @param {Array<Object>} threadData.posts - Array of post objects
   * @param {string} threadData.posts[].author - Post author
   * @param {string} threadData.posts[].date - Post date
   * @param {string} threadData.posts[].content - Post content HTML
   * @param {string} threadData.posts[].postUrl - URL to the specific post
   * @param {string} threadData.posts[].postNumber - Post number
   * @param {Array<Object>} [threadData.posts[].quotes] - Array of quoted posts
   * @param {Array<Object>} [threadData.posts[].attachments] - Array of post attachments
   *
   * @returns {Promise<Blob>} A Promise that resolves to a PDF Blob
   *
   * @throws {Error} When PDF generation fails or jsPDF is not available
   *
   * @example
   * // Basic usage
   * const pdfGenerator = new PDFGenerator();
   * const pdfBlob = await pdfGenerator.generatePDF(threadData);
   * const url = URL.createObjectURL(pdfBlob);
   *
   * // Download the PDF
   * const link = document.createElement('a');
   * link.href = url;
   * link.download = 'thread-export.pdf';
   * link.click();
   */
  async generatePDF(threadData) {
    const startTime = Date.now();

    logger.log("PDF: generatePDF called", {
      title: threadData?.title,
      postCount: threadData?.posts?.length || 0,
    });

    try {
      // Initialize PDF document
      logger.log("PDF: initializing document");
      this.initializePDF();

      // Add header
      logger.log("PDF: adding thread header");
      this.addThreadHeader(threadData);

      // Add posts - this is now properly awaited
      logger.log("PDF: starting post processing", {
        totalPosts: threadData.posts.length,
      });
      await this.addPosts(threadData.posts);

      // Add footer to the last page
      this.addFooter();

      logger.log("PDF: all posts processed, generating final PDF blob");

      // Generate and return PDF blob
      const pdfBlob = this.doc.output("blob");

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.log("PDF: generation successful", {
        blobSize: pdfBlob?.size || 0,
        blobSizeKB: Math.round((pdfBlob?.size || 0) / 1024),
        postCount: threadData?.posts?.length || 0,
        durationMs: duration,
        durationSeconds: Math.round((duration / 1000) * 10) / 10,
      });

      return pdfBlob;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.error("PDF: generation failed", {
        message: error?.message,
        stack: error?.stack,
        postCount: threadData?.posts?.length || 0,
        durationMs: duration,
      });
      console.error("PDF generation failed:", error);
      throw error;
    }
  }

  /**
   * Initializes the jsPDF document with proper settings
   *
   * This method sets up the PDF document with A4 format, portrait orientation,
   * and calculates page dimensions. It also handles jsPDF library detection
   * for both UMD and global versions.
   *
   * @private
   * @throws {Error} When jsPDF library is not available
   *
   * @example
   * // Called internally during PDF generation
   * this.initializePDF();
   */
  initializePDF() {
    // jsPDF is exposed as window.jspdf.jsPDF in the UMD version
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;

    if (!jsPDF) {
      throw new Error(
        "jsPDF library not found. Make sure jspdf.umd.js is loaded."
      );
    }

    this.doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    // Get page dimensions
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - PDF_CONSTANTS.MARGIN * 2;

    // Reset current Y position
    this.currentY = PDF_CONSTANTS.MARGIN;

    logger.log("PDF: initialized", {
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      contentWidth: this.contentWidth,
    });
  }

  /**
   * Adds the thread header to the PDF
   * @private
   * @param {Object} threadData - The thread data
   */
  addThreadHeader(threadData) {
    // Title with modern styling
    this.doc.setFontSize(PDF_CONSTANTS.HEADER_FONT_SIZE + 2);
    this.doc.setTextColor(...PDF_CONSTANTS.PRIMARY_COLOR);
    this.doc.setFont(undefined, "bold");

    const titleLines = this.doc.splitTextToSize(
      this.escapeText(threadData.title),
      this.contentWidth
    );

    this.addTextLines(titleLines, PDF_CONSTANTS.HEADER_FONT_SIZE + 2);
    this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.5);

    // Meta information with subtle styling
    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 1);
    this.doc.setTextColor(...PDF_CONSTANTS.META_COLOR);
    this.doc.setFont(undefined, "normal");

    // Source URL (clickable)
    const sourceText = `Source: ${this.getCanonicalThreadUrl(threadData.url)}`;
    this.addTextWithLink(
      sourceText,
      threadData.url,
      PDF_CONSTANTS.MARGIN,
      this.currentY
    );
    this.currentY += PDF_CONSTANTS.LINE_HEIGHT * 0.8;

    // Export date and post count on same line
    const exportDate = new Date(threadData.scrapedAt).toLocaleString();
    const postCount = `${threadData.posts.length} posts`;
    const metaText = `Exported: ${exportDate} • ${postCount}`;
    this.addText(metaText);

    // Add separator
    this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.5);
    this.addSeparator();
    this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.5);
  }

  /**
   * Adds all posts to the PDF with sequential processing
   * 
   * This method processes posts one by one to avoid memory issues with large threads.
   * Each post is added with proper page breaking and background colors.
   * 
   * @private
   * @param {Array<Object>} posts - Array of post objects to add
   * @param {string} posts[].author - Post author name
   * @param {string} posts[].date - Post date string
   * @param {string} posts[].content - Post content HTML
   * @param {string} posts[].postUrl - URL to the specific post
   * @param {string} posts[].postNumber - Post number (e.g., "#1", "#2")
   * @param {Array<Object>} [posts[].quotes] - Array of quoted posts
   * @param {Array<Object>} [posts[].attachments] - Array of post attachments
   * @throws {Error} When post processing fails
   * @since 1.0.0
   */
  async addPosts(posts) {
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];

      logger.log("PDF: adding post", {
        postIndex: i + 1,
        totalPosts: posts.length,
        postNumber: post.postNumber,
        author: post.author,
      });

      // Check if we need a new page
      if (this.currentY > this.pageHeight - 50) {
        this.doc.addPage();
        this.currentY = PDF_CONSTANTS.MARGIN;
      }

      // Wait for this post to be completely processed before moving to the next
      await this.addSinglePost(post, i);

      logger.log("PDF: post completed", {
        postIndex: i + 1,
        totalPosts: posts.length,
        postNumber: post.postNumber,
      });
    }
  }

  /**
   * Adds a single post to the PDF with automatic page breaking
   * 
   * This method renders a complete post including header, content, quotes,
   * and attachments with proper background colors and page breaking.
   * 
   * @private
   * @param {Object} post - Post object to render
   * @param {string} post.author - Post author name
   * @param {string} post.date - Post date string
   * @param {string} post.content - Post content HTML
   * @param {string} post.postUrl - URL to the specific post
   * @param {string} post.postNumber - Post number (e.g., "#1", "#2")
   * @param {Array<Object>} [post.quotes] - Array of quoted posts
   * @param {Array<Object>} [post.attachments] - Array of post attachments
   * @param {number} [postIndex=0] - Index of the post (0-based) for background color
   * @throws {Error} When post rendering fails
   * @since 1.0.0
   */
  async addSinglePost(post, postIndex = 0) {
    const isEvenPost = postIndex % 2 === 0;
    const backgroundColor = isEvenPost
      ? PDF_CONSTANTS.POST_BG_COLOR_1
      : PDF_CONSTANTS.POST_BG_COLOR_2;

    logger.log("PDF: processing post content", {
      postIndex: postIndex + 1,
      postNumber: post.postNumber,
      author: post.author,
      hasContent: !!post.content,
      contentLength: post.content?.length || 0,
    });

    // Check if we need a new page before starting the post
    this.checkAndAddPageBreak();

    // Start rendering the post
    const postStartPosition = this.currentY;

    // Add padding
    this.currentY += PDF_CONSTANTS.POST_PADDING;

    // Post header with background
    this.addPostHeader(post, backgroundColor, postStartPosition);

    // Post quotes
    if (post.quotes && post.quotes.length > 0) {
      await this.addPostQuotesWithPageBreaks(post.quotes);
    }

    // Post content with automatic page breaks
    if (post.content) {
      await this.addPostContentWithPageBreaks(post.content);
    }

    // Post attachments
    if (post.attachments && post.attachments.length > 0) {
      await this.addPostAttachmentsWithPageBreaks(post.attachments);
    }

    // Add bottom padding
    this.currentY += PDF_CONSTANTS.POST_PADDING;

    // Add space between posts
    this.currentY += PDF_CONSTANTS.POST_MARGIN_BOTTOM;

    logger.log("PDF: post processing completed", {
      postIndex: postIndex + 1,
      postNumber: post.postNumber,
      finalY: this.currentY,
    });
  }

  /**
   * Checks if a page break is needed and adds one if necessary
   * @private
   */
  checkAndAddPageBreak() {
    if (this.currentY > this.pageHeight - 50) {
      this.doc.addPage();
      this.currentY = PDF_CONSTANTS.MARGIN;
      logger.log("PDF: added page break", { newY: this.currentY });
    }
  }

  /**
   * Adds post content with automatic page breaks
   * @private
   * @param {string} content - Post content (pre-formatted text)
   */
  async addPostContentWithPageBreaks(content) {
    if (!content || content.trim() === "") {
      return;
    }

    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE);
    this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);
    this.doc.setFont(undefined, "normal");

    // Content is already formatted text - use it directly
    const contentLines = this.doc.splitTextToSize(
      content,
      this.contentWidth
    );

    // Add lines with page break detection
    for (const line of contentLines) {
      // Check if we need a page break before adding this line
      const lineHeight = PDF_CONSTANTS.FONT_SIZE * 0.35; // Convert pt to mm

      if (this.currentY + lineHeight > this.pageHeight - PDF_CONSTANTS.MARGIN) {
        // Add page break
        this.doc.addPage();
        this.currentY = PDF_CONSTANTS.MARGIN;

        // Add continuation indicator
        this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 2);
        this.doc.setTextColor(...PDF_CONSTANTS.META_COLOR);
        this.doc.setFont(undefined, "italic");
        this.doc.text("(continued...)", PDF_CONSTANTS.MARGIN, this.currentY);
        this.currentY += PDF_CONSTANTS.LINE_HEIGHT;

        // Reset font for content
        this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE);
        this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);
        this.doc.setFont(undefined, "normal");
      }

      // Add the line
      this.doc.text(line, PDF_CONSTANTS.MARGIN, this.currentY);
      this.currentY += lineHeight;
    }
  }

  /**
   * Adds post quotes with automatic page breaks
   * @private
   * @param {Array<Object>} quotes - Array of quoted posts
   */
  async addPostQuotesWithPageBreaks(quotes) {
    for (const quote of quotes) {
      // Check if we need a page break before adding this quote
      const quoteHeight = PDF_CONSTANTS.LINE_HEIGHT * 2; // Rough estimate for quote

      if (
        this.currentY + quoteHeight >
        this.pageHeight - PDF_CONSTANTS.MARGIN
      ) {
        this.doc.addPage();
        this.currentY = PDF_CONSTANTS.MARGIN;
      }

      // Quote header
      this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 1);
      this.doc.setTextColor(...PDF_CONSTANTS.PRIMARY_COLOR);
      this.doc.setFont(undefined, "bold");

      const quoteHeader = `${this.escapeText(quote.author)} wrote:`;
      this.addText(quoteHeader);

      // Quote content - already formatted text
      this.doc.setFont(undefined, "italic");
      this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);

      const quoteContent = this.escapeText(quote.content);
      const quoteLines = this.doc.splitTextToSize(
        quoteContent,
        this.contentWidth - 10
      );

      this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.3);
      this.addIndentedTextLines(quoteLines, 5);
      this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.5);
    }
  }

  /**
   * Adds post attachments with automatic page breaks
   * @private
   * @param {Array<Object>} attachments - Array of post attachments
   */
  async addPostAttachmentsWithPageBreaks(attachments) {
    // Check if we need a page break before adding attachments
    const attachmentHeight =
      PDF_CONSTANTS.LINE_HEIGHT * (attachments.length + 2);

    if (
      this.currentY + attachmentHeight >
      this.pageHeight - PDF_CONSTANTS.MARGIN
    ) {
      this.doc.addPage();
      this.currentY = PDF_CONSTANTS.MARGIN;
    }

    this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.5);

    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 1);
    this.doc.setTextColor(...PDF_CONSTANTS.PRIMARY_COLOR);
    this.doc.setFont(undefined, "bold");

    this.addText("Attachments:");

    this.doc.setFont(undefined, "normal");
    this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);

    for (const attachment of attachments) {
      this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.3);

      if (attachment.url) {
        const attachmentText = `• ${this.escapeText(
          attachment.filename
        )} (${this.escapeText(attachment.type)})`;
        this.addTextWithLink(
          attachmentText,
          attachment.url,
          PDF_CONSTANTS.MARGIN,
          this.currentY
        );
        this.currentY += PDF_CONSTANTS.LINE_HEIGHT;
      } else {
        this.addText(
          `• ${this.escapeText(attachment.filename)} (${this.escapeText(
            attachment.type
          )})`
        );
      }
    }
  }

  /**
   * Adds post header (author, date, post number) with background
   * @private
   * @param {Object} post - Post object
   * @param {Array<number>} backgroundColor - Background color array
   * @param {number} postStartPosition - Starting Y position of the post
   */
  addPostHeader(post, backgroundColor, postStartPosition) {
    const headerStartY = this.currentY;

    // Calculate exact header height based on font size for perfect centering
    const headerHeight = PDF_CONSTANTS.LINE_HEIGHT * 0.7;

    // Draw rounded background for the header section FIRST
    this.addRoundedHeaderBackground(
      postStartPosition,
      postStartPosition + PDF_CONSTANTS.POST_PADDING + headerHeight
    );

    // Left side: Author name and timestamp
    this.doc.setFontSize(PDF_CONSTANTS.POST_HEADER_FONT_SIZE - 2);
    this.doc.setTextColor(...PDF_CONSTANTS.HEADER_TEXT_COLOR);
    this.doc.setFont(undefined, "bold");

    // Author name
    this.doc.text(
      this.escapeText(post.author),
      PDF_CONSTANTS.MARGIN + 2,
      this.currentY
    );

    // Timestamp next to author name
    if (post.date) {
      // Calculate author width with the same font settings as used for author
      const authorWidth = this.doc.getTextWidth(this.escapeText(post.author));

      // Switch to timestamp font settings
      this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 3);
      this.doc.setTextColor(...PDF_CONSTANTS.HEADER_TEXT_COLOR);
      this.doc.setFont(undefined, "normal");

      const timestampText = ` • ${this.escapeText(post.date)}`;
      this.doc.text(
        timestampText,
        PDF_CONSTANTS.MARGIN + 2 + authorWidth,
        this.currentY
      );
    }

    // Right side: Post number (prominent)
    if (post.postNumber) {
      this.doc.setFontSize(PDF_CONSTANTS.POST_HEADER_FONT_SIZE - 1);
      this.doc.setTextColor(...PDF_CONSTANTS.HEADER_TEXT_COLOR);
      this.doc.setFont(undefined, "bold");

      const postNumberText = this.escapeText(post.postNumber);
      const textWidth = this.doc.getTextWidth(postNumberText);
      const rightX = this.pageWidth - PDF_CONSTANTS.MARGIN - textWidth - 2;

      // Add post number as clickable link if URL exists
      if (post.postUrl) {
        this.addTextWithLink(
          postNumberText,
          post.postUrl,
          rightX,
          this.currentY
        );
      } else {
        this.doc.text(postNumberText, rightX, this.currentY);
      }
    }

    this.currentY = this.currentY + PDF_CONSTANTS.LINE_HEIGHT * 0.7;

    // Add spacing below header so content doesn't get pushed into it
    this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.8);
  }

  /**
   * Adds post quotes
   * @private
   * @param {Array<Object>} quotes - Array of quoted posts
   */
  addPostQuotes(quotes) {
    for (const quote of quotes) {
      // Quote header
      this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 1);
      this.doc.setTextColor(...PDF_CONSTANTS.PRIMARY_COLOR);
      this.doc.setFont(undefined, "bold");

      const quoteHeader = `${this.escapeText(quote.author)} wrote:`;
      this.addText(quoteHeader);

      // Quote content
      this.doc.setFont(undefined, "italic");
      this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);

      const quoteContent = this.escapeText(this.stripHtml(quote.content));
      const quoteLines = this.doc.splitTextToSize(
        quoteContent,
        this.contentWidth - 10
      );

      this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.3);
      this.addIndentedTextLines(quoteLines, 5);
      this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.5);
    }
  }

  /**
   * Adds post content using jsPDF's built-in text rendering
   * @private
   * @param {string} content - Post content HTML
   */
  async addPostContent(content) {
    if (!content || content.trim() === "") {
      logger.log("PDF: skipping empty content");
      return;
    }

    logger.log("PDF: starting text content rendering", {
      contentLength: content.length,
    });

    // Use jsPDF's text rendering with enhanced HTML processing
    this.addPostContentAsText(content);
  }

  /**
   * Adds post content as plain text with enhanced HTML processing
   * @private
   * @param {string} content - Post content HTML
   */
  addPostContentAsText(content) {
    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE);
    this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);
    this.doc.setFont(undefined, "normal");

    // Process HTML content to preserve formatting
    const processedContent = this.processHtml(content);
    const contentLines = this.doc.splitTextToSize(
      processedContent,
      this.contentWidth
    );

    this.addTextLines(contentLines, PDF_CONSTANTS.FONT_SIZE);
  }

  /**
   * Adds post content as basic text (minimal processing fallback)
   * @private
   * @param {string} content - Post content HTML
   */
  addPostContentAsBasicText(content) {
    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE);
    this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);
    this.doc.setFont(undefined, "normal");

    // Basic HTML stripping - just remove tags
    const basicContent = content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const contentLines = this.doc.splitTextToSize(
      basicContent,
      this.contentWidth
    );

    this.addTextLines(contentLines, PDF_CONSTANTS.FONT_SIZE);
  }

  /**
   * Adds post attachments
   * @private
   * @param {Array<Object>} attachments - Array of post attachments
   */
  addPostAttachments(attachments) {
    this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.5);

    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 1);
    this.doc.setTextColor(...PDF_CONSTANTS.PRIMARY_COLOR);
    this.doc.setFont(undefined, "bold");

    this.addText("Attachments:");

    this.doc.setFont(undefined, "normal");
    this.doc.setTextColor(...PDF_CONSTANTS.TEXT_COLOR);

    for (const attachment of attachments) {
      this.addSpace(PDF_CONSTANTS.LINE_HEIGHT * 0.3);

      if (attachment.url) {
        const attachmentText = `• ${this.escapeText(
          attachment.filename
        )} (${this.escapeText(attachment.type)})`;
        this.addTextWithLink(
          attachmentText,
          attachment.url,
          PDF_CONSTANTS.MARGIN,
          this.currentY
        );
        this.currentY += PDF_CONSTANTS.LINE_HEIGHT;
      } else {
        this.addText(
          `• ${this.escapeText(attachment.filename)} (${this.escapeText(
            attachment.type
          )})`
        );
      }
    }
  }

  /**
   * Adds text with a clickable link
   * @private
   * @param {string} text - Text to display
   * @param {string} url - URL for the link
   * @param {number} x - X position for the text (optional, defaults to margin)
   * @param {number} y - Y position for the text (optional, defaults to currentY)
   */
  addTextWithLink(text, url, x = PDF_CONSTANTS.MARGIN, y = this.currentY) {
    // Add the text
    this.doc.text(text, x, y);

    // Add link annotation
    try {
      const textWidth = this.doc.getTextWidth(text);
      const linkHeight = this.doc.getFontSize() * 0.35; // Convert pt to mm

      this.doc.link(x, y - linkHeight, textWidth, linkHeight, {
        url: url,
      });

      logger.log("PDF: added link", { text, url, x, y, textWidth, linkHeight });
    } catch (error) {
      logger.warn("PDF: failed to add link", {
        url: url,
        error: error.message,
      });
    }
  }

  /**
   * Adds text at current position
   * @private
   * @param {string} text - Text to add
   */
  addText(text) {
    this.doc.text(text, PDF_CONSTANTS.MARGIN, this.currentY);
    this.currentY += PDF_CONSTANTS.LINE_HEIGHT;
  }

  /**
   * Adds multiple text lines
   * @private
   * @param {Array<string>} lines - Array of text lines
   * @param {number} fontSize - Font size for line height calculation
   */
  addTextLines(lines, fontSize = PDF_CONSTANTS.FONT_SIZE) {
    for (const line of lines) {
      this.doc.text(line, PDF_CONSTANTS.MARGIN, this.currentY);
      this.currentY += fontSize * 0.35; // Convert pt to mm
    }
  }

  /**
   * Adds indented text lines
   * @private
   * @param {Array<string>} lines - Array of text lines
   * @param {number} indent - Indentation in mm
   */
  addIndentedTextLines(lines, indent) {
    for (const line of lines) {
      this.doc.text(line, PDF_CONSTANTS.MARGIN + indent, this.currentY);
      this.currentY += PDF_CONSTANTS.LINE_HEIGHT;
    }
  }

  /**
   * Adds vertical space
   * @private
   * @param {number} space - Space in mm
   */
  addSpace(space) {
    this.currentY += space;
  }

  /**
   * Adds a separator line
   * @private
   */
  addSeparatorLine() {
    this.doc.setDrawColor(...PDF_CONSTANTS.PRIMARY_COLOR);
    this.doc.setLineWidth(0.5);
    this.doc.line(
      PDF_CONSTANTS.MARGIN,
      this.currentY,
      this.pageWidth - PDF_CONSTANTS.MARGIN,
      this.currentY
    );
    this.currentY += 2;
  }

  /**
   * Adds a separator with dots
   * @private
   */
  addSeparator() {
    this.doc.setDrawColor(...PDF_CONSTANTS.BORDER_COLOR);
    this.doc.setLineWidth(0.3);

    // Draw a line with dots
    const startX = PDF_CONSTANTS.MARGIN;
    const endX = this.pageWidth - PDF_CONSTANTS.MARGIN;
    const y = this.currentY;

    // Draw dotted line
    const dotSpacing = 2;
    for (let x = startX; x < endX; x += dotSpacing * 2) {
      this.doc.circle(x, y, 0.3, "F");
    }

    this.currentY += 1;
  }

  /**
   * Adds a footer to the PDF with Lotus-themed content
   * @private
   */
  addFooter() {
    // Move to bottom of current page with some margin
    const footerY = this.pageHeight - PDF_CONSTANTS.MARGIN - 10;
    this.currentY = footerY;

    // Set footer styling
    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 2);
    this.doc.setTextColor(...PDF_CONSTANTS.META_COLOR);
    this.doc.setFont(undefined, "normal");

    // Center the footer text
    const footerText = "Created by Lotus Forum Thread Exporter";
    const textWidth = this.doc.getTextWidth(footerText);
    const centerX = (this.pageWidth - textWidth) / 2;

    this.doc.text(footerText, centerX, this.currentY);
    this.currentY += PDF_CONSTANTS.LINE_HEIGHT * 0.8;

    // Add a fun Lotus joke
    const jokes = [
      "Remember: It's not a bug, it's a feature - just like the Elise's 'character'!",
      "Exporting threads faster than an Exige accelerates from 0-60!",
      "Because even digital threads deserve the Lotus treatment.",
      "Making forum exports as smooth as an S1 gear change.",
      "From forum to PDF in less time than it takes to explain why you need another Lotus.",
      "Adding lightness to your digital document collection.",
      "Built for the driver who appreciates both performance and reliability.",
      "Because every great thread deserves a proper send-off.",
      "Exporting with the precision of a Lotus suspension setup.",
      "Making PDFs as engaging as a spirited drive through the Alps.",
      "Because sometimes you need to archive more than just memories.",
      "Built by enthusiasts, for enthusiasts - just like Colin Chapman intended.",
      "Adding a touch of British engineering to your digital archives.",
      "Because the best threads are worth preserving in style.",
      "Exporting with the reliability of a K-series engine.",
      "Making forum history as accessible as your garage.",
      "Because every Lotus owner knows: details matter.",
      "Adding the 'Lotus touch' to your digital documentation.",
      "Built to last longer than a typical Elise ownership experience.",
      "Because even digital threads need proper craftsmanship.",
    ];

    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

    // Set font settings BEFORE calculating width
    this.doc.setFontSize(PDF_CONSTANTS.FONT_SIZE - 3);
    this.doc.setFont(undefined, "italic");

    const jokeWidth = this.doc.getTextWidth(randomJoke);
    const jokeCenterX = (this.pageWidth - jokeWidth) / 2;

    this.doc.setTextColor(...PDF_CONSTANTS.META_COLOR);

    this.doc.text(randomJoke, jokeCenterX, this.currentY);
  }

  /**
   * Adds rounded background for post header
   * @private
   * @param {number} startY - Starting Y position
   * @param {number} endY - Ending Y position
   */
  addRoundedHeaderBackground(startY, endY) {
    const postHeight = endY - startY;
    const radius = 3; // Rounded corner radius

    // Add rounded background rectangle (filled)
    this.doc.setFillColor(...PDF_CONSTANTS.HEADER_BG_COLOR);
    this.doc.roundedRect(
      PDF_CONSTANTS.MARGIN,
      startY,
      this.contentWidth,
      postHeight,
      radius,
      radius,
      "F"
    );
  }

  /**
   * Adds background color for a post (no border)
   * @private
   * @param {Array<number>} bgColor - RGB color array
   * @param {number} startY - Starting Y position
   * @param {number} endY - Ending Y position
   */
  addPostBackgroundAndBorder(bgColor, startY, endY) {
    const postHeight = endY - startY;

    // Add background rectangle (filled) - no border
    this.doc.setFillColor(...bgColor);
    this.doc.rect(
      PDF_CONSTANTS.MARGIN,
      startY,
      this.contentWidth,
      postHeight,
      "F"
    );
  }

  /**
   * Escapes text for safe display
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeText(text) {
    if (typeof text !== "string") {
      return "";
    }

    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }


  /**
   * Replaces emojis with text equivalents for PDF compatibility
   *
   * This method converts Unicode emojis to their text descriptions to ensure
   * PDF compatibility. It uses the global emoji mapper if available.
   *
   * Examples:
   * - 👍 → [thumbs up]
   * - 😀 → [grinning face]
   * - ❤️ → [red heart]
   *
   * @private
   * @param {string} text - Text that may contain emojis
   * @returns {string} Text with emojis replaced by text equivalents
   *
   * @example
   * const text = 'Hello 👍 world!';
   * const processed = this.replaceEmojis(text);
   * // Result: 'Hello [thumbs up] world!'
   */
  replaceEmojis(text) {
    if (typeof text !== "string") {
      return "";
    }

    // Use the emoji mapper
    if (window.emojiMapper) {
      return window.emojiMapper.processText(text);
    }

    // Return original text if emoji mapper is not available
    return text;
  }



  /**
   * Returns canonical thread URL by removing postID, pageNo and hash parameters
   *
   * This method cleans up thread URLs by removing pagination and post-specific
   * parameters to create a canonical URL that points to the main thread page.
   *
   * @private
   * @param {string} originalUrl - The original thread URL
   * @returns {string} The canonical URL without pagination parameters
   *
   * @example
   * const url = 'https://forum.com/thread/123?postID=456&pageNo=2#post456';
   * const canonical = this.getCanonicalThreadUrl(url);
   * // Result: 'https://forum.com/thread/123'
   */
  getCanonicalThreadUrl(originalUrl) {
    try {
      const url = new URL(originalUrl);
      url.searchParams.delete("postID");
      url.searchParams.delete("pageNo");
      url.hash = "";
      return url.toString();
    } catch (error) {
      logger.warn("PDF: URL canonicalization failed", {
        originalUrl,
        error: error.message,
      });
      return originalUrl;
    }
  }
}
