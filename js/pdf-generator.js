// Lotus Forum Thread Exporter - PDF Generator
// Handles PDF generation using html2pdf.js with British Racing Green theme

class PDFGenerator {
  constructor(config) {
    this.config = config;
  }

  // Generate PDF using html2pdf.js
  async generatePDF(threadData) {
    // Create HTML content for PDF
    const htmlContent = this.createPDFHTML(threadData);

    // Create a temporary element for html2pdf
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = "fixed";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "-9999px";
    tempDiv.style.width = "800px";
    tempDiv.style.backgroundColor = "white";
    tempDiv.style.zIndex = "-9999";
    tempDiv.style.visibility = "hidden";
    tempDiv.style.pointerEvents = "none";
    document.body.appendChild(tempDiv);

    // Configure html2pdf options
    const options = {
      margin: [10, 10, 10, 10],
      filename: `${threadData.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        putOnlyUsedFonts: true,
        floatPrecision: 16,
      },
    };

    try {
      // Generate PDF from the HTML string directly and get blob
      const pdfBlob = await html2pdf()
        .set(options)
        .from(htmlContent)
        .outputPdf("blob");

      // Clean up
      document.body.removeChild(tempDiv);

      // Return the PDF blob
      return pdfBlob;
    } catch (error) {
      console.error("PDF generation failed:", error);
      document.body.removeChild(tempDiv);
      throw error;
    }
  }

  // Create HTML content for PDF
  createPDFHTML(threadData) {
    const postsHTML = threadData.posts
      .map(
        (post) => `
            <div class="post">
                <div class="post-header">
                    <span class="post-author">${post.author}</span>
                    <div class="post-meta">
                        <span class="post-date">${post.date}</span>
                        <a href="${post.postUrl}" class="post-number">${
          post.postNumber || ""
        }</a>
                    </div>
                </div>
                ${
                  post.quotes.length > 0
                    ? `
                    <div class="post-quotes">
                        ${post.quotes
                          .map(
                            (quote) => `
                            <div class="quote">
                                <div class="quote-header">
                                    <span class="quote-author">${quote.author}</span>
                                    <span class="quote-title">${quote.title}</span>
                                </div>
                                <div class="quote-content">${quote.content}</div>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                `
                    : ""
                }
                <div class="post-content">${post.content}</div>
                ${
                  post.attachments.length > 0
                    ? `
                    <div class="post-attachments">
                        <strong>Attachments:</strong>
                        ${post.attachments
                          .map(
                            (att) => `
                            <div class="attachment">
                                <a href="${att.url}" target="_blank">${att.filename}</a>
                                <span class="attachment-type">(${att.type})</span>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                `
                    : ""
                }
            </div>
        `
      )
      .join("");

    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${threadData.title}</title>
                <style>
                    ${this.getPDFStyles()}
                </style>
            </head>
            <body>
                <div class="pdf-container">
                    <header class="pdf-header">
                        <h1>${threadData.title}</h1>
                        <div class="pdf-meta">
                            <p><strong>Source:</strong> ${threadData.url}</p>
                            <p><strong>Exported:</strong> ${new Date(
                              threadData.scrapedAt
                            ).toLocaleString()}</p>
                            <p><strong>Posts:</strong> ${
                              threadData.posts.length
                            }</p>
                        </div>
                    </header>
                    <main class="pdf-content">
                        ${postsHTML}
                    </main>
                </div>
            </body>
            </html>
        `;
  }

  // Get PDF styles with British Racing Green theme
  getPDFStyles() {
    return `
            * { 
                box-sizing: border-box; 
                margin: 0;
                padding: 0;
            }
            html, body { 
                font-family: 'Segoe UI', system-ui, sans-serif; 
                line-height: 1.6; 
                color: #2c3e50;
                margin: 0;
                padding: 0;
                background: white;
                width: 100%;
                min-height: 100vh;
            }
            .pdf-container { 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 20px;
                background: white;
                min-height: 100vh;
            }
            .pdf-header { 
                border-bottom: 3px solid ${this.config.colors.primary}; 
                margin-bottom: 30px; 
                padding-bottom: 20px; 
                background: white;
            }
            .pdf-header h1 { 
                color: ${this.config.colors.primary}; 
                font-size: 24px; 
                margin: 0 0 15px 0; 
                font-weight: bold;
            }
            .pdf-meta { 
                background: ${this.config.colors.secondary}; 
                padding: 15px; 
                border-radius: 5px; 
                font-size: 14px; 
                margin-bottom: 20px;
            }
            .pdf-meta p { 
                margin: 5px 0; 
                color: #333;
            }
            .pdf-content {
                background: white;
                min-height: 200px;
            }
            .post { 
                margin-bottom: 25px; 
                padding: 15px; 
                border: 1px solid ${this.config.colors.border}; 
                border-radius: 5px; 
                background: #fafafa; 
                page-break-inside: auto;
                break-inside: auto;
            }
            .post-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center;
                margin-bottom: 10px; 
                padding-bottom: 8px; 
                border-bottom: 1px solid ${this.config.colors.border}; 
            }
            .post-author { 
                font-weight: bold; 
                color: ${this.config.colors.primary}; 
                font-size: 16px;
            }
            .post-meta {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .post-date { 
                color: #999; 
                font-size: 12px; 
                font-style: italic;
            }
            .post-number { 
                background: ${this.config.colors.primary}; 
                color: white; 
                padding: 2px 8px; 
                border-radius: 3px; 
                font-size: 12px; 
                font-weight: bold;
                text-decoration: none;
            }
            .post-number:hover {
                background: rgba(0, 41, 41, 1);
                color: white;
            }
            .post-content { 
                margin: 15px 0; 
                color: #333;
                line-height: 1.6;
            }
            .post-content p {
                margin: 10px 0;
            }
            .post-attachments { 
                margin-top: 15px; 
                padding-top: 10px; 
                border-top: 1px solid ${this.config.colors.border}; 
            }
            .attachment { 
                margin: 5px 0; 
                font-size: 14px; 
            }
            .attachment a { 
                color: ${this.config.colors.primary}; 
                text-decoration: none; 
            }
            .attachment-type { 
                color: #666; 
                font-style: italic; 
            }
            .post-quotes {
                margin-bottom: 15px;
            }
            .quote { 
                background: ${this.config.colors.secondary}; 
                border-left: 4px solid ${this.config.colors.primary}; 
                padding: 10px; 
                margin: 10px 0; 
                font-style: italic; 
                border-radius: 3px;
            }
            .quote-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding-bottom: 5px;
                border-bottom: 1px solid rgba(0, 51, 51, 0.2);
            }
            .quote-author {
                font-weight: bold;
                color: ${this.config.colors.primary};
                font-size: 14px;
            }
            .quote-title {
                color: #666;
                font-size: 12px;
            }
            .quote-content {
                color: #333;
                line-height: 1.5;
            }
        `;
  }
}
