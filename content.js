const RinaVoiceControl = {
  isListening: false,
  recognition: null,
  micButton: null,
  feedback: null,
  lastCommandTime: 0,
  isInitialized: false, 

  //──────────────── Initialization and Lifecycle
  init: async function () {
    if (this.isInitialized) {
      if (this.isListening) {
        this.startListening();
      }
      return;
    }

    this.createUI();
    this.setupRecognition();

    const storedState = await chrome.storage.local.get("rinaIsListening");
    if (storedState.rinaIsListening) {
      this.startListening();
    }

    this.handleSPANavigation();
    this.autoPlaySearchResults();
    this.isInitialized = true;
  },

  //──────────────── UI Creation and Management
  createUI: function () {
    let existingButton = document.getElementById("rina-voice-control");
    if (existingButton) {
      existingButton.remove();
    }
    let existingFeedback = document.getElementById("rina-feedback");
    if (existingFeedback) {
      existingFeedback.remove();
    }
    this.micButton = document.createElement("button");
    this.micButton.id = "rina-voice-control";
    this.micButton.innerHTML = `<img src="${chrome.runtime.getURL(
      "images/mic.png"
    )}" width="24" height="24">`;

    Object.assign(this.micButton.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "10000",
      backgroundColor: "#FF0000", 
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
      display: "none", 
    });
    document.body.appendChild(this.feedback);
    this.micButton.addEventListener("click", this.toggleListening.bind(this));
  },

  //──────────────── Speech Recognition Setup
  setupRecognition: function () {
    if (!("webkitSpeechRecognition" in window)) {
      this.showFeedback(
        "Speech Recognition not supported in this browser.",
        true
      );
      console.error("webkitSpeechRecognition not found.");
      return;
    }

    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true; 
    this.recognition.interimResults = false; 
    this.recognition.lang = "en-US"; 
    this.recognition.onresult = (event) => {
      const transcript =
        event.results[event.results.length - 1][0].transcript.toLowerCase();
      const now = Date.now();
      if (now - this.lastCommandTime < 1000) {
        return;
      }
      this.lastCommandTime = now;

      this.showFeedback(`Heard: "${transcript}"`);
      this.processCommand(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "audio-capture") {
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn(
                "Restart after 'no-speech' or 'audio-capture' error failed, retrying...",
                e
              );
              setTimeout(() => {
                if (this.isListening) this.recognition.start();
              }, 1000);
            }
          }
        }, 300);
      } else if (event.error === "not-allowed") {
        this.showFeedback(
          "Microphone access denied. Please allow in browser settings.",
          true
        );
        this.stopListening();
      } else {
        this.showFeedback(`Error: ${event.error}. Attempting restart.`, true);
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn(
                "Restart after general error failed, retrying...",
                e
              );
              setTimeout(() => {
                if (this.isListening) this.recognition.start();
              }, 1000);
            }
          }
        }, 500);
      }
    };
    this.recognition.onend = () => {
      if (this.isListening) {
        setTimeout(() => {
          try {
            this.recognition.start(); 
          } catch (e) {
            console.warn("Recognition restart failed in onend, retrying...", e);
            setTimeout(() => {
              if (this.isListening) this.recognition.start();
            }, 1000);
          }
        }, 200); 
      }
    };

    this.recognition.onspeechend = () => {
      if (this.isListening) {
        this.recognition.stop(); 
        this.recognition.start(); 
      }
    };
  },

  //──────────────── Listening Control
  toggleListening: function () {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  },

  startListening: function () {
    if (this.isListening) return; 

    try {
      this.recognition.start(); 
      this.isListening = true; 
      this.micButton.style.backgroundColor = "#4285F4"; 
      this.micButton.classList.add('listening');
      this.showFeedback("Listening..."); 
      chrome.storage.local.set({ rinaIsListening: true }); 
    } catch (e) {
      this.showFeedback(
        "Speech recognition failed to start. Please check microphone permissions.",
        true
      );
      console.error("Error starting recognition:", e);
      this.isListening = false; 
      this.micButton.style.backgroundColor = "#FF0000"; 
      chrome.storage.local.set({ rinaIsListening: false }); 
    }
  },

  stopListening: function () {
    if (!this.isListening) return; 

    if (this.recognition) {
      this.recognition.stop();
    }
    this.isListening = false; 
    this.micButton.style.backgroundColor = "#FF0000"; 
    this.micButton.classList.remove('listening');
    this.feedback.style.display = "none";
    chrome.storage.local.set({ rinaIsListening: false }); 
  },

  //──────────────── Feedback Display
  showFeedback: function (message, isError = false) {
    this.feedback.textContent = message;
    this.feedback.style.backgroundColor = isError
      ? "#cc0000" 
      : "rgba(0,0,0,0.7)"; 
    this.feedback.style.display = "block";
    if (!isError) {
      clearTimeout(this.feedbackTimeout);
      this.feedbackTimeout = setTimeout(() => {
        this.feedback.style.display = "none";
      }, 2000);
    }
  },

  //──────────────── Command Processing
  processCommand: function (command) {
    if (command.includes("search") || command.includes("play")) {
      const match = command.match(/(?:search|play)\s+(.+)/);
      if (match && match[1]) {
        this.handleSearchCommand(match[1]);
        return; 
      }
    }
    this.handlePlayerCommands(command);
  },

  //──────────────── Time Parsing Helpers
  parseTimeString: function (timeString) {
    const colonMatch = timeString.match(/(\d+):(\d+)/);
    if (colonMatch) {
      const minutes = parseInt(colonMatch[1]);
      const seconds = parseInt(colonMatch[2]);
      return minutes * 60 + seconds;
    }

    const wordMatch = timeString.match(
      /(\d+)\s*(minute|min|m)?\s*(\d+)?\s*(second|sec|s)?/i
    );
    if (wordMatch) {
      const minutes = wordMatch[1] ? parseInt(wordMatch[1]) : 0;
      const seconds = wordMatch[3] ? parseInt(wordMatch[3]) : 0;
      return minutes * 60 + seconds;
    }
    const secondsMatch = timeString.match(/(\d+)\s*(second|sec|s)/i);
    if (secondsMatch) {
      return parseInt(secondsMatch[1]);
    }
    const minutesMatch = timeString.match(/(\d+)\s*(minute|min|m)/i);
    if (minutesMatch) {
      return parseInt(minutesMatch[1]) * 60;
    }

    return null;
  },

  formatTime: function (seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  },

  //──────────────── YouTube Interaction Handlers
  handleSearchCommand: function (query) {
    this.showFeedback(`Searching for: "${query}"`);

    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.sendMessage
    ) {
      chrome.runtime.sendMessage({
        action: "searchAndPlay",
        query: query,
      });
    } else {
      window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;
    }
  },

  //──────────────── Player Commands
  handlePlayerCommands: function (command) {
    const video = document.querySelector("video");
    if (!video) {
      this.showFeedback("No video found on this page.", true);
      return;
    }
    if (
      command.includes("play video") ||
      (command.includes("play") && video.paused) ||
      command.includes("play it")
    ) {
      video.play();
      this.showFeedback("Playing video.");
    }
    else if (
      command.includes("pause video") ||
      (command.includes("pause") && !video.paused) ||
      command.includes("stop video")
    ) {
      video.pause();
      this.showFeedback("Pausing video.");
    }
    else if (
      command.includes("fullscreen") ||
      command.includes("full screen")
    ) {
      const player = document.querySelector(".html5-video-player");
      if (player) {
        if (!document.fullscreenElement) {
          player.requestFullscreen();
          this.showFeedback("Entering fullscreen.");
        } else {
          this.showFeedback("Already in fullscreen.");
        }
      }
    }
    else if (
      command.includes("unmute") ||
      command.includes("sound on") ||
      command.includes("turn on sound")
    ) {
      video.muted = false;
      this.showFeedback("Video unmuted.");
    } else if (command.includes("mute")) {
      video.muted = true;
      this.showFeedback("Video muted.");
    } else if (
      command.includes("exit fullscreen") ||
      command.includes("close fullscreen")
    ) {
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
    }
    else if (
      command.includes("go to ") ||
      command.includes("skip to ") ||
      command.includes("jump to ")
    ) {
      const timeMatch = command.match(/(?:go to|skip to|jump to)\s+(.+)/);
      if (timeMatch && timeMatch[1]) {
        const timeString = timeMatch[1];
        const seconds = this.parseTimeString(timeString);

        if (seconds !== null) {
          video.currentTime = seconds;
          this.showFeedback(`Skipped to ${this.formatTime(seconds)}.`);
        } else {
          this.showFeedback(`Could not understand time: ${timeString}`, true);
        }
      } else {
        this.showFeedback("Please specify a time to skip to.", true);
      }
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

  //──────────────── SPA Navigation Handling
  handleSPANavigation: function () {
    document.addEventListener("yt-navigate-finish", () => {
      if (this.recognition && this.isListening) {
        this.recognition.stop();
      }
      setTimeout(() => {
        this.isInitialized = false; 
        this.init(); 
      }, 500);
    });
  },

  //──────────────── Search Results Autoplay
  autoPlaySearchResults: function () {
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.has("search_query") &&
      !window.location.hash.includes("autoplayed")
    ) {
      setTimeout(() => {
        const videoItems = document.querySelectorAll("ytd-video-renderer");
        for (const item of videoItems) {
          if (
            item.querySelector(".ytd-ad-slot-renderer") ||
            item.querySelector("ytd-playlist-video-renderer")
          ) {
            continue;
          }

          const link = item.querySelector("a#thumbnail");
          if (link) {
            link.click();
            window.location.hash = "autoplayed";
            break; 
          }
        }
      }, 2000); 
    }
  },
};

//──────────────── Initialize the voice control when the DOM is fully loaded or interactive
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  RinaVoiceControl.init();
} else {
  window.addEventListener("DOMContentLoaded", () => RinaVoiceControl.init());
}
