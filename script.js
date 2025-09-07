// script.js

// Constants
const DURATION = 60; // 60 seconds
const TICK_INTERVAL = 250; // 250ms for smooth display

// State variables (declare but don't initialize DOM elements yet)
let timerElement = null;
let toggleBtn = null;
let restartBtn = null;
let muteBtn = null;
let sessionBadge = null;

let endTimeMs = 0;
let intervalId = null;
let pausedRemainingMs = DURATION * 1000;
let running = false;
let muted = false;
let sessionCount = 0;
let audioContext = null;
let bgMusic = null;

// Initialize Web Audio for chime
function initAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn('Web Audio not supported');
  }
}

// Play a soft chime sound
function playChime() {
  if (muted || !audioContext) return;
  
  try {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch (e) {
    console.warn('Failed to play chime:', e);
  }
}

// Trigger vibration if supported and not muted
function triggerVibration() {
  if (muted || !navigator.vibrate) return;
  navigator.vibrate([50, 30, 50]);
}

// Convert milliseconds to MM:SS format
function msToMMSS(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Called when timer reaches 0
function onFinish() {
  if (!timerElement) return;
  
  timerElement.textContent = '00:00';
  timerElement.classList.add('finish');
  
  // Announce completion to screen readers
  const announcement = document.createElement('div');
  announcement.className = 'sr-only';
  announcement.setAttribute('aria-live', 'polite');
  announcement.textContent = 'Minute complete';
  document.body.appendChild(announcement);
  
  // Remove announcement after it's been read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
  
  // Play chime and vibrate
  playChime();
  triggerVibration();
  
  // Increment session counter
  sessionCount++;
  if (sessionBadge) {
    sessionBadge.textContent = `Cycles: ${sessionCount}`;
  }
  
  // Save to localStorage
  localStorage.setItem('shanti_session_count', sessionCount.toString());
  
  // Remove finish animation class after animation completes
  setTimeout(() => {
    if (timerElement) {
      timerElement.classList.remove('finish');
    }
  }, 600);
  
  // Start next cycle
  setEndFromNow();
}

// Set end time from current time
function setEndFromNow() {
  endTimeMs = Date.now() + DURATION * 1000;
}

// Update timer display
function tick() {
  const now = Date.now();
  const remainingMs = endTimeMs - now;
  
  if (remainingMs <= 0) {
    onFinish();
    return;
  }
  
  if (timerElement) {
    timerElement.textContent = msToMMSS(remainingMs);
  }
}

// Start the timer
function startTimer() {
  if (running) return;
  
  running = true;
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.textContent = 'Pause';
  }
  
  // If we have paused time, use it; otherwise start fresh
  if (pausedRemainingMs > 0 && pausedRemainingMs < DURATION * 1000) {
    endTimeMs = Date.now() + pausedRemainingMs;
  } else {
    setEndFromNow();
  }
  
  // Clear any existing interval
  if (intervalId) {
    clearInterval(intervalId);
  }
  
  // Start ticking
  intervalId = setInterval(tick, TICK_INTERVAL);
  
  // Save state
  localStorage.setItem('shanti_running', '1');
  localStorage.removeItem('shanti_paused_remaining');
}

// Pause the timer
function pauseTimer() {
  if (!running) return;
  
  running = false;
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtn.textContent = 'Resume';
  }
  
  // Clear interval
  clearInterval(intervalId);
  intervalId = null;
  
  // Calculate remaining time
  pausedRemainingMs = Math.max(0, endTimeMs - Date.now());
  
  // Save state
  localStorage.setItem('shanti_running', '0');
  localStorage.setItem('shanti_paused_remaining', pausedRemainingMs.toString());
}

// Toggle pause/resume
function toggleTimer() {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

// Restart timer
function restartTimer() {
  pausedRemainingMs = DURATION * 1000;
  if (running) {
    setEndFromNow();
    tick(); // Update display immediately
  } else {
    if (timerElement) {
      timerElement.textContent = '01:00';
    }
  }
  
  // Save state
  localStorage.setItem('shanti_paused_remaining', pausedRemainingMs.toString());
}

// Toggle mute
function toggleMute() {
  muted = !muted;
  if (muteBtn) {
    muteBtn.setAttribute('aria-pressed', muted.toString());
    muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  }
  
  // Handle background music muting
  if (bgMusic) {
    if (muted) {
      bgMusic.pause();
    } else {
      // Only attempt to play if we have user interaction
      bgMusic.play().catch(e => {
        console.log("Cannot autoplay music without user interaction:", e);
        // Set up event listener for first user interaction
        const playOnInteraction = () => {
          bgMusic.play().catch(err => console.log("Still cannot play:", err));
          document.removeEventListener('click', playOnInteraction);
          document.removeEventListener('touchstart', playOnInteraction);
          document.removeEventListener('keydown', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction);
        document.addEventListener('touchstart', playOnInteraction);
        document.addEventListener('keydown', playOnInteraction);
      });
    }
  }
  
  // Save to localStorage
  localStorage.setItem('shanti_muted', muted.toString());
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // Ignore if typing in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  switch (e.key.toLowerCase()) {
    case ' ':
      e.preventDefault();
      toggleTimer();
      break;
    case 'r':
      e.preventDefault();
      restartTimer();
      break;
    case 'm':
      e.preventDefault();
      toggleMute();
      break;
  }
}

// Initialize the application
function initApp() {
  // Get DOM elements
  timerElement = document.getElementById('timer');
  toggleBtn = document.getElementById('toggleBtn');
  restartBtn = document.getElementById('restartBtn');
  muteBtn = document.getElementById('muteBtn');
  sessionBadge = document.getElementById('sessionBadge');
  bgMusic = document.getElementById('bgMusic');
  
  // Initialize audio
  initAudio();
  
  // Setup background music
  if (bgMusic) {
    bgMusic.volume = 0.5;
    bgMusic.loop = true;
    
    // Check if previously muted
    const savedMuted = localStorage.getItem('shanti_muted') === 'true';
    muted = savedMuted;
    if (muted && muteBtn) {
      muteBtn.setAttribute('aria-pressed', 'true');
      muteBtn.textContent = 'Unmute';
      bgMusic.muted = true;
    }
    
    // Try to play background music
    const playPromise = bgMusic.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Autoplay prevented:', error);
        // Setup event listeners to play on first user interaction
        const unlockAudio = () => {
          if (!muted) {
            bgMusic.play().catch(e => console.log('Playback failed after interaction:', e));
          }
          document.removeEventListener('click', unlockAudio);
          document.removeEventListener('touchstart', unlockAudio);
          document.removeEventListener('keydown', unlockAudio);
        };
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('touchstart', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });
      });
    }
  }
  
  // Load saved state
  const savedMuted = localStorage.getItem('shanti_muted');
  const savedRunning = localStorage.getItem('shanti_running');
  const savedPausedRemaining = localStorage.getItem('shanti_paused_remaining');
  const savedSessionCount = localStorage.getItem('shanti_session_count');
  
  // Restore mute state
  if (savedMuted === 'true') {
    muted = true;
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', 'true');
      muteBtn.textContent = 'Unmute';
    }
  }
  
  // Restore session count
  if (savedSessionCount) {
    sessionCount = parseInt(savedSessionCount, 10);
    if (sessionBadge) {
      sessionBadge.textContent = `Cycles: ${sessionCount}`;
    }
  }
  
  // Restore timer state
  if (savedPausedRemaining) {
    pausedRemainingMs = parseInt(savedPausedRemaining, 10);
    if (timerElement) {
      timerElement.textContent = msToMMSS(pausedRemainingMs);
    }
  }
  
  // Add event listeners (safely check if elements exist)
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTimer);
  }
  if (restartBtn) {
    restartBtn.addEventListener('click', restartTimer);
  }
  if (muteBtn) {
    muteBtn.addEventListener('click', toggleMute);
  }
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Start timer automatically
  // If previously running, resume; otherwise start fresh
  if (savedRunning === '1') {
    startTimer();
  } else {
    // Start fresh timer
    running = false;
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.textContent = 'Pause';
    }
    startTimer(); // Start the timer automatically
  }
}

// Wait for DOM to be fully loaded, then initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM is already loaded
  setTimeout(initApp, 0);
}
