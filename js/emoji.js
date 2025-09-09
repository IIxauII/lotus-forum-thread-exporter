// Emoji mapping utility for PDF generation
// Converts emojis to text descriptions for better PDF compatibility

/**
 * Emoji mapping utility that converts emojis to text descriptions
 * Uses the emoji data from emojis.json for comprehensive coverage
 */
class EmojiMapper {
  constructor() {
    this.emojiMap = null;
    this.loadEmojiData();
  }

  /**
   * Load emoji data from the JSON file
   * @private
   */
  async loadEmojiData() {
    try {
      // Use chrome.runtime.getURL to get the correct extension resource URL
      const emojiUrl = chrome.runtime.getURL('libs/emojis.json');
      const response = await fetch(emojiUrl);
      const data = await response.json();
      
      // Create reverse mapping: emoji -> description
      this.emojiMap = new Map();
      for (const [description, emoji] of Object.entries(data)) {
        this.emojiMap.set(emoji, description);
      }
    } catch (error) {
      console.warn('EmojiMapper: failed to load emoji data, using fallback', error);
      this.emojiMap = new Map();
    }
  }

  /**
   * Convert emoji to text description
   * @param {string} emoji - The emoji character
   * @returns {string} Text description or original emoji if not found
   */
  emojiToText(emoji) {
    if (!this.emojiMap) {
      return emoji;
    }

    const description = this.emojiMap.get(emoji);
    if (description) {
      return `[${description}]`;
    }

    // Return original emoji if not found in map
    return emoji;
  }

  /**
   * Process text and replace emojis with text descriptions
   * @param {string} text - Text that may contain emojis
   * @returns {string} Text with emojis replaced by descriptions
   */
  processText(text) {
    if (typeof text !== 'string') {
      return '';
    }

    // If emoji data isn't loaded yet, return original text
    if (!this.emojiMap || this.emojiMap.size === 0) {
      console.warn('EmojiMapper: emoji data not loaded yet, returning original text');
      return text;
    }

    // Regex to match emojis and Unicode symbols
    // Comprehensive emoji ranges without duplicates
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F0FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2B00}-\u{2BFF}]|[\u{2F00}-\u{2FDF}]|[\u{31F0}-\u{31FF}]|[\u{32FF}]|[\u{3300}-\u{33FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]/gu;

    return text.replace(emojiRegex, (emoji) => {
      return this.emojiToText(emoji);
    });
  }
}

// Create a global instance
window.emojiMapper = new EmojiMapper();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmojiMapper;
}
