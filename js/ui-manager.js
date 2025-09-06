// Lotus Forum Thread Exporter - UI Manager
// Handles UI elements and user interactions

class UIManager {
  constructor(config) {
    this.config = config;
    this.exportButton = null;
    this.isExtensionEnabled = true;
  }

  // Check if extension is enabled
  async checkExtensionStatus() {
    try {
      const result = await chrome.storage.sync.get(["extensionEnabled"]);
      this.isExtensionEnabled = result.extensionEnabled;
      return this.isExtensionEnabled;
    } catch (error) {
      console.error("Error checking extension status:", error);
      this.isExtensionEnabled = undefined;
      return undefined;
    }
  }

  // Toggle extension status
  toggleExtension(enabled) {
    this.isExtensionEnabled = enabled;
  }

  // Check if extension is currently enabled
  isEnabled() {
    return this.isExtensionEnabled;
  }

  // Add export button to the page
  addExportButton() {
    if (this.exportButton) return; // Already added

    // Find the best place to add the button - look for the share button area
    const actionButtons =
      document.querySelector(".contentInteractionButtons") ||
      document.querySelector(".woltlab-core-pagination") ||
      document.querySelector(".messageList");

    if (!actionButtons) {
      return;
    }

    // Create export button - icon only to match forum design
    this.exportButton = document.createElement("button");
    this.exportButton.id = "lotus-export-button";
    this.exportButton.className = "lotus-export-button";

    // Create icon element directly
    const iconSpan = document.createElement("span");
    iconSpan.className = "export-icon";
    iconSpan.textContent = "📥";

    // Append only the icon, no other elements
    this.exportButton.appendChild(iconSpan);

    // Ensure no other content can be added
    this.exportButton.innerHTML = iconSpan.outerHTML;

    // Insert button in the action buttons area
    if (actionButtons.classList.contains("contentInteractionButtons")) {
      actionButtons.appendChild(this.exportButton);
    } else {
      // Create a container for the button
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "lotus-export-container";
      buttonContainer.appendChild(this.exportButton);
      actionButtons.parentNode.insertBefore(buttonContainer, actionButtons);
    }
  }

  // Remove export button from the page
  removeExportButton() {
    if (this.exportButton) {
      // Remove the button from DOM
      if (this.exportButton.parentNode) {
        this.exportButton.parentNode.removeChild(this.exportButton);
      }

      // Also remove any container we might have created
      const container = document.querySelector(".lotus-export-container");
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }

      this.exportButton = null;
    }
  }

  // Update button state with proper animations and timing
  updateButtonState(state) {
    if (!this.exportButton) return;

    const icon = this.exportButton.querySelector(".export-icon");
    if (!icon) {
      return;
    }

    // Remove any existing state classes
    this.exportButton.classList.remove("exporting", "success", "error");

    switch (state) {
      case "ready":
        icon.textContent = "📥";
        this.exportButton.disabled = false;
        break;

      case "exporting":
        icon.textContent = "⏳";
        this.exportButton.disabled = true;
        this.exportButton.classList.add("exporting");
        break;

      case "success":
        icon.textContent = "📥";
        this.exportButton.disabled = false;

        // Reset to ready state after 1 second
        setTimeout(() => {
          this.updateButtonState("ready");
        }, 1000);
        break;

      case "error":
        icon.textContent = "❌";
        this.exportButton.disabled = false;

        // Reset to ready state after 2 seconds
        setTimeout(() => {
          this.updateButtonState("ready");
        }, 2000);
        break;
    }
  }

  // Set export button click handler
  setExportHandler(handler) {
    if (this.exportButton) {
      this.exportButton.addEventListener("click", handler);
    }
  }

  // Check extension status
  async checkExtensionStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSettings",
      });
      this.isExtensionEnabled = response.extensionEnabled;

      if (!this.isExtensionEnabled && this.exportButton) {
        this.exportButton.style.display = "none";
      }
    } catch (error) {
      // Extension status check failed
    }
  }

  // Handle extension toggle
  toggleExtension(enabled) {
    this.isExtensionEnabled = enabled;
    if (this.exportButton) {
      this.exportButton.style.display = enabled ? "block" : "none";
    }
  }

  // Get extension enabled state
  isEnabled() {
    return this.isExtensionEnabled;
  }
}
