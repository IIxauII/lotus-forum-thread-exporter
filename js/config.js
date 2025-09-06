// Lotus Forum Thread Exporter - Configuration
// Centralized configuration for the extension

const CONFIG = {
  // British Racing Green color scheme
  colors: {
    primary: "rgba(0, 51, 51, 1)",
    secondary: "#f0f8f0",
    accent: "#c0d0c0",
    text: "#2c3e50",
    border: "#e0e0e0",
  },

  // WoltLab thread detection patterns
  urlPatterns: [
    /lotus-forum\.de\/WBB\/index\.php\?thread\//,
    /lotus-forum\.de\/WBB\/index\.php\?board\//,
  ],

  // DOM selectors for WoltLab threads
  selectors: {
    // Thread identification
    threadContainer: 'body[data-template="thread"][data-application="wbb"]',
    threadTitle: "h1.contentTitle",
    threadMeta: ".woltlab-core-statistics",

    // Posts - Updated based on example.html
    messageList: "ul.wbbThreadPostList",
    message: "article.wbbPost",
    messageText: ".messageText",
    messageAuthor: ".messageAuthor .username",
    messageDate: ".messagePublicationTime",

    // Pagination
    pagination: "woltlab-core-pagination",
    nextPage: 'link[rel="next"]',

    // Attachments
    attachment: ".attachmentThumbnail .attachmentFilename",
    attachmentLink: ".attachmentThumbnail a",

    // Quotes
    quote: "blockquote.quoteBox",
    quoteTitle: ".quoteBoxTitle",
    quoteContent: ".quoteBoxContent",
  },

  // Export settings
  export: {
    maxPages: 50,
    timeout: 30000,
    retryAttempts: 3,
  },
};
