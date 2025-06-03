// Continuous voice control for YouTube
const RinaVoiceControl = {
  isListening: false,
  recognition: null,
  micButton: null,
  feedback: null,
  lastCommandTime: 0,
  isInitialized: false, // Flag to prevent multiple initializations
  // wasListeningBeforeNavigation is removed as state will be persisted via chrome.storage.local

  init: async function () { // Made init async to await storage retrieval
    // If already initialized, just ensure recognition is active if it should be
    if (this.isInitialized) {
      if (this.isListening) {
        this.startListening();
      }
      return;
    }

    // Create UI elements (will remove existing ones if present)
    this.createUI();

    // Initialize speech recognition
    this.setupRecognition();

    // Retrieve listening state from storage
    const storedState = await chrome.storage.local.get('rinaIsListening');
    if (storedState.rinaIsListening) {
      this.startListening(); // Automatically restart listening if it was active
    }

    // Handle YouTube's dynamic navigation (SPA behavior)
    this.handleSPANavigation();

    // Auto-click first video on search results if applicable
    this.autoPlaySearchResults();

    this.isInitialized = true;
  },

  createUI: function () {
    // Remove existing button if any (important for SPA navigation to prevent duplicates)
    let existingButton = document.getElementById("rina-voice-control");
    if (existingButton) {
      existingButton.remove();
    }
    let existingFeedback = document.getElementById("rina-feedback");
    if (existingFeedback) {
      existingFeedback.remove();
    }

    // Create floating mic button
    this.micButton = document.createElement("button");
    this.micButton.id = "rina-voice-control";
    // Using a placeholder image URL as chrome.runtime.getURL is not available in this context
    // In a real Chrome extension, you would use chrome.runtime.getURL("icon.png")
    this.micButton.innerHTML =
      '<img src="https://placehold.co/24x24/FF0000/FFFFFF?text=MIC" width="24" height="24">';

    Object.assign(this.micButton.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "10000",
      backgroundColor: "#FF0000", // Red: Stopped
      borderRadius: "50%",
      width: "50px",
      height: "50px",
      border: "none",
      cursor: "pointer",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    document.body.appendChild(this.micButton);

    // Create visual feedback element
    this.feedback = document.createElement("div");
    this.feedback.id = "rina-feedback";
    Object.assign(this.feedback.style, {
      position: "fixed",
      bottom: "80px",
      right: "20px",
      backgroundColor: "rgba(0,0,0,0.7)",
      color: "white",
      padding: "10px 15px",
      borderRadius: "20px",
      zIndex: "10000",
      fontSize: "14px",
      maxWidth: "300px",
      textAlign: "center",
      display: "none", // Hidden by default
    });
    document.body.appendChild(this.feedback);

    // Add event listener to toggle listening
    this.micButton.addEventListener("click", this.toggleListening.bind(this));
  },

  setupRecognition: function () {
    // Check for webkitSpeechRecognition availability
    if (!('webkitSpeechRecognition' in window)) {
      this.showFeedback("Speech Recognition not supported in this browser.", true);
      console.error("webkitSpeechRecognition not found.");
      return;
    }

    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true; // Keep listening continuously
    this.recognition.interimResults = false; // Only return final results
    this.recognition.lang = "en-US"; // Set language

    // Event handler for speech recognition results
    this.recognition.onresult = (event) => {
      // Get the latest transcript
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      const now = Date.now();

      // Implement a simple debounce to avoid processing rapid-fire results
      if (now - this.lastCommandTime < 1000) {
        return;
      }
      this.lastCommandTime = now;

      this.showFeedback(`Heard: "${transcript}"`);
      this.processCommand(transcript);
      // IMPORTANT: DO NOT stop recognition here — keep it running for continuous listening
    };

    // Event handler for speech recognition errors
    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "audio-capture") {
        // These errors are often transient (e.g., user paused, microphone issue).
        // Attempt to restart recognition if we are supposed to be listening.
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn("Restart after 'no-speech' or 'audio-capture' error failed, retrying...", e);
              setTimeout(() => { if (this.isListening) this.recognition.start(); }, 1000);
            }
          }
        }, 300);
      } else if (event.error === "not-allowed") {
        // User denied microphone access or browser policy prevents it. This is a fatal error.
        this.showFeedback("Microphone access denied. Please allow in browser settings.", true);
        this.stopListening(); // Permanently stop as we cannot proceed without permission
      } else {
        // Other unexpected errors. Attempt to restart but show feedback.
        this.showFeedback(`Error: ${event.error}. Attempting restart.`, true);
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn("Restart after general error failed, retrying...", e);
              setTimeout(() => { if (this.isListening) this.recognition.start(); }, 1000);
            }
          }
        }, 500);
      }
    };

    // Event handler when speech recognition ends (e.g., due to browser timeout or explicit stop)
    this.recognition.onend = () => {
      // If we are still in the listening state, automatically restart recognition
      if (this.isListening) {
        setTimeout(() => {
          try {
            this.recognition.start(); // Attempt to restart
          } catch (e) {
            console.warn("Recognition restart failed in onend, retrying...", e);
            setTimeout(() => { if (this.isListening) this.recognition.start(); }, 1000);
          }
        }, 200); // Small delay before restarting
      }
    };

    // Optional: handle when user stops speaking (some browsers might stop recognition here)
    this.recognition.onspeechend = () => {
      // If recognition stops after speech, restart it to maintain continuity
      if (this.isListening) {
        this.recognition.stop(); // Stop the current session
        this.recognition.start(); // Immediately start a new one
      }
    };
  },

  toggleListening: function () {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  },

  startListening: function () {
    if (this.isListening) return; // Already listening, do nothing

    try {
      this.recognition.start(); // Start the speech recognition
      this.isListening = true; // Update internal state
      this.micButton.style.backgroundColor = "#4285F4"; // Change button color to blue
      this.showFeedback("Listening..."); // Provide visual feedback
      chrome.storage.local.set({ rinaIsListening: true }); // Persist state
    } catch (e) {
      this.showFeedback("Speech recognition failed to start. Please check microphone permissions.", true);
      console.error("Error starting recognition:", e);
      this.isListening = false; // Ensure state is consistent if start fails
      this.micButton.style.backgroundColor = "#FF0000"; // Revert button color to red
      chrome.storage.local.set({ rinaIsListening: false }); // Persist state
    }
  },

  stopListening: function () {
    if (!this.isListening) return; // Not listening, do nothing

    if (this.recognition) {
        this.recognition.stop(); // Stop the speech recognition
    }
    this.isListening = false; // Update internal state
    this.micButton.style.backgroundColor = "#FF0000"; // Change button color to red
    this.feedback.style.display = "none"; // Hide feedback message
    chrome.storage.local.set({ rinaIsListening: false }); // Persist state
  },

  showFeedback: function (message, isError = false) {
    this.feedback.textContent = message;
    this.feedback.style.backgroundColor = isError
      ? "#cc0000" // Red for errors
      : "rgba(0,0,0,0.7)"; // Dark semi-transparent for normal feedback
    this.feedback.style.display = "block"; // Show the feedback element

    // Auto-hide non-error messages after 2 seconds
    if (!isError) {
      clearTimeout(this.feedbackTimeout); // Clear any previous auto-hide timeout
      this.feedbackTimeout = setTimeout(() => {
        this.feedback.style.display = "none";
      }, 2000);
    }
  },

  processCommand: function (command) {
    // Handle search/play commands first
    if (command.includes("search") || command.includes("play")) {
      const match = command.match(/(?:search|play)\s+(.+)/);
      if (match && match[1]) {
        this.handleSearchCommand(match[1]);
        return; // Command handled, exit
      }
    }

    // If not a search/play command, try to handle as a player command
    this.handlePlayerCommands(command);
  },

  handleSearchCommand: function (query) {
    this.showFeedback(`Searching for: "${query}"`);

    // Send message to background script to perform the search and navigate
    // In a real Chrome extension, this would send a message to background.js
    // For this context, we'll simulate it or provide a direct navigation.
    // Assuming chrome.runtime.sendMessage is available as per original code.
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
            action: "searchAndPlay",
            query: query,
        });
    } else {
        // Fallback for non-extension environment or testing
        console.warn("chrome.runtime.sendMessage not available. Simulating search.");
        window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    }
  },

  handlePlayerCommands: function (command) {
    const video = document.querySelector("video");
    if (!video) {
      this.showFeedback("No video found on this page.", true);
      return;
    }

    // Player controls based on recognized command
    if (command.includes("play video") || (command === "play" && video.paused) || command.includes("play it")) {
      video.play();
      this.showFeedback("Playing video.");
    } else if (command.includes("pause video") || (command === "pause" && !video.paused)) {
      video.pause();
      this.showFeedback("Pausing video.");
    } else if (command.includes("mute")) {
      video.muted = true;
      this.showFeedback("Video muted.");
    } else if (command.includes("unmute")) {
      video.muted = false;
      this.showFeedback("Video unmuted.");
    } else if (command.includes("fullscreen")) {
      const player = document.querySelector(".html5-video-player");
      if (player) {
        if (!document.fullscreenElement) { // Enter fullscreen only if not already
          player.requestFullscreen();
          this.showFeedback("Entering fullscreen.");
        } else {
          this.showFeedback("Already in fullscreen.");
        }
      }
    } else if (command.includes("exit fullscreen")) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        this.showFeedback("Exiting fullscreen.");
      } else {
        this.showFeedback("Not in fullscreen mode.");
      }
    } else if (command.includes("volume up")) {
      video.volume = Math.min(1, video.volume + 0.1);
      this.showFeedback(`Volume: ${Math.round(video.volume * 100)}%`);
    } else if (command.includes("volume down")) {
      video.volume = Math.max(0, video.volume - 0.1);
      this.showFeedback(`Volume: ${Math.round(video.volume * 100)}%`);
    } else if (command.includes("skip") || command.includes("forward")) {
      video.currentTime += 10;
      this.showFeedback("Skipped forward 10 seconds.");
    } else if (command.includes("back") || command.includes("rewind")) {
      video.currentTime -= 10;
      this.showFeedback("Rewound 10 seconds.");
    } else if (command.includes("next")) {
      const nextButton = document.querySelector(".ytp-next-button");
      if (nextButton) {
        nextButton.click();
        this.showFeedback("Playing next video.");
      } else {
        this.showFeedback("Next button not found.", true);
      }
    } else if (command.includes("previous")) {
      const prevButton = document.querySelector(".ytp-prev-button");
      if (prevButton) {
        prevButton.click();
        this.showFeedback("Playing previous video.");
      } else {
        this.showFeedback("Previous button not found.", true);
      }
    } else if (command.includes("faster")) {
      video.playbackRate = Math.min(4, video.playbackRate + 0.25);
      this.showFeedback(`Speed: ${video.playbackRate}x`);
    } else if (command.includes("slower")) {
      video.playbackRate = Math.max(0.25, video.playbackRate - 0.25);
      this.showFeedback(`Speed: ${video.playbackRate}x`);
    } else if (command.includes("speed")) {
      const speedMatch = command.match(/speed\s+(\d+(\.\d+)?)/);
      if (speedMatch) {
        const speed = parseFloat(speedMatch[1]);
        if (!isNaN(speed)) {
          video.playbackRate = Math.min(4, Math.max(0.25, speed));
          this.showFeedback(`Speed set to: ${video.playbackRate}x`);
        } else {
          this.showFeedback("Invalid speed value.", true);
        }
      } else {
        this.showFeedback("Please specify a speed (e.g., 'speed 1.5').", true);
      }
    } else {
      this.showFeedback(`Command not recognized: "${command}"`, true);
    }
  },

  handleSPANavigation: function () {
    // Listen for YouTube's custom navigation event (used in SPAs)
    document.addEventListener("yt-navigate-finish", () => {
      // Explicitly stop the current recognition instance to avoid conflicts
      // with the new instance that will be created.
      if (this.recognition && this.isListening) {
        this.recognition.stop();
      }
      // No need to set this.isListening = false here, as init will handle it based on storage.

      // Allow a small delay for the new page content to render fully
      setTimeout(() => {
        this.isInitialized = false; // Reset flag to force a full re-initialization
        this.init(); // Re-initialize the voice control, which will read from storage
      }, 500);
    });
  },

  autoPlaySearchResults: function () {
    const urlParams = new URLSearchParams(window.location.search);
    // Check if it's a search results page and if we haven't already autoplayed
    if (urlParams.has("search_query") && !window.location.hash.includes("autoplayed")) {
      setTimeout(() => {
        // Find and click the first non-ad, non-playlist video
        const videoItems = document.querySelectorAll("ytd-video-renderer");
        for (const item of videoItems) {
          // Skip ads and mixes/playlists
          if (item.querySelector(".ytd-ad-slot-renderer") || item.querySelector("ytd-playlist-video-renderer")) {
            continue;
          }

          const link = item.querySelector("a#thumbnail");
          if (link) {
            link.click();
            // Add a hash to the URL to prevent re-autoplay if user navigates back within the same search
            window.location.hash = "autoplayed";
            break; // Clicked the first valid video, stop searching
          }
        }
      }, 2000); // Wait for search results to load dynamically
    }
  },
};

// Initialize the voice control when the DOM is fully loaded or interactive
if (document.readyState === "complete" || document.readyState === "interactive") {
  RinaVoiceControl.init();
} else {
  window.addEventListener("DOMContentLoaded", () => RinaVoiceControl.init());
}
