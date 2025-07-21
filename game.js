// --- Canvas Setup ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;

// Simple responsive canvas - just scale the display, keep internal coordinates the same
function resizeCanvas() {
  // Set the internal resolution (always 900x600)
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  // Calculate scale to fit screen while maintaining aspect ratio
  const containerWidth = window.innerWidth * 0.95;
  const containerHeight = window.innerHeight * 0.7;
  const scale = Math.min(containerWidth / CANVAS_WIDTH, containerHeight / CANVAS_HEIGHT);
  
  // Set the display size (CSS scaling)
  canvas.style.width = (CANVAS_WIDTH * scale) + 'px';
  canvas.style.height = (CANVAS_HEIGHT * scale) + 'px';
}

// Initialize canvas
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- Assets ---
const bgImg = new Image();
bgImg.src = 'crowd_image.png';
const huggingImg = new Image();
huggingImg.src = 'hugging.png';
const talkingImg = new Image();
talkingImg.src = 'talking.png';

// --- Game State ---
let gameState = 'start'; // 'start' | 'playing' | 'flashing' | 'cooldown' | 'gameover'
let score = 0;
let highScore = 0;
let isSpaceDown = false;
let isMobileHugPressed = false; // Track mobile hug button state
let flashStart = 0;
const FLASH_DURATION = 0.3;
const FLASH_INTENSITY = 0.4;
const COOLDOWN_DURATION = 0.8; // Reduced from 2.0 to 0.8 seconds
let flashAlpha = 0;
let cooldownStart = 0;
let justCheckedCouple = false;
let gameStartTime = 0;
let isOnKissCam = false;
let frozenHuggingState = false;
let flashingSpotlight = 1; // Track which spotlight triggered the flash
let light1HasFlashed = false; // Prevent immediate re-flashing
let light2HasFlashed = false; // Prevent immediate re-flashing
let light3HasFlashed = false; // Prevent immediate re-flashing
let light4HasFlashed = false; // Prevent immediate re-flashing
let light5HasFlashed = false; // Prevent immediate re-flashing
let flashInProgress = false; // Global flash lock
let lastFlashTime = 0; // Track when last flash happened

// Game constants
const DETECTION_RADIUS = 35; // Reduced from 60 to 35 pixels - state freezes closer to flash
const SCORE_INCREASE_RATE = 1000; // Points per second when hugging
const SCORE_DECREASE_RATE = 300; // Points per second when not hugging

// Movement difficulty scaling
function getDifficultyMultiplier() {
  const timeElapsed = (Date.now() / 1000) - gameStartTime;
  return Math.min(3, 1 + timeElapsed / 30); // Max 3x speed after 60 seconds
}

// --- Couple Position ---
const COUPLE_SIZE = 56;
let coupleX = 0;
let coupleY = 0;
function randomCouplePosition() {
  let attempts = 0;
  do {
    // Keep couple within bounds and away from edges
    coupleX = Math.floor(100 + Math.random() * (CANVAS_WIDTH - 200));
    coupleY = Math.floor(200 + Math.random() * (CANVAS_HEIGHT - 300));
    attempts++;
    
    // If we can't find a good spot after many attempts, force a safe position
    if (attempts > 20) {
      coupleX = CANVAS_WIDTH / 2;
      coupleY = CANVAS_HEIGHT - 200;
      break;
    }
  } while (isInRestrictedArea(coupleX, coupleY));
}

function isInRestrictedArea(x, y) {
  // Check if position is in or near the Kiss Cam screen
  const inScreenArea = x >= SCREEN_AREA.x && 
                       x <= SCREEN_AREA.x + SCREEN_AREA.width &&
                       y >= SCREEN_AREA.y && 
                       y <= SCREEN_AREA.y + SCREEN_AREA.height;
  
  // Check if position is in or near the cameraman area
  const inCameramanArea = x >= CAMERAMAN_AREA.x && 
                          x <= CAMERAMAN_AREA.x + CAMERAMAN_AREA.width &&
                          y >= CAMERAMAN_AREA.y && 
                          y <= CAMERAMAN_AREA.y + CAMERAMAN_AREA.height;
  
  return inScreenArea || inCameramanArea;
}

// --- Red Light (Spotlight) ---
let lightX = CANVAS_WIDTH / 2;
let lightY = CANVAS_HEIGHT / 2;
let lightTargetX = lightX;
let lightTargetY = lightY;
// Device detection for different speeds
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                 (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
const LIGHT_SPEED = isMobile ? 330.0 : 280.0; // Pixels per second (mobile gets faster speed)
let lightPathTimer = 0;
let lightPathDuration = 0;

// Second spotlight (appears after 10 seconds)
let light2X = CANVAS_WIDTH / 3;
let light2Y = CANVAS_HEIGHT / 3;
let light2TargetX = light2X;
let light2TargetY = light2Y;
let light2Active = false;
let light2PathTimer = 0;
let light2PathDuration = 0;

// Third spotlight (appears after 30 seconds)
let light3X = CANVAS_WIDTH / 4;
let light3Y = CANVAS_HEIGHT / 4;
let light3TargetX = light3X;
let light3TargetY = light3Y;
let light3Active = false;
let light3PathTimer = 0;
let light3PathDuration = 0;

// Fourth spotlight (appears after 50 seconds)
let light4X = CANVAS_WIDTH * 0.75;
let light4Y = CANVAS_HEIGHT * 0.25;
let light4TargetX = light4X;
let light4TargetY = light4Y;
let light4Active = false;
let light4PathTimer = 0;
let light4PathDuration = 0;

// Fifth spotlight (appears after 70 seconds)
let light5X = CANVAS_WIDTH * 0.6;
let light5Y = CANVAS_HEIGHT * 0.8;
let light5TargetX = light5X;
let light5TargetY = light5Y;
let light5Active = false;
let light5PathTimer = 0;
let light5PathDuration = 0;

// Add movement pattern types
const PATTERNS = {
  DIRECT: 'direct',
  ZIGZAG: 'zigzag'
};

// Add movement state for first spotlight
let currentPattern = PATTERNS.DIRECT;
let patternProgress = 0;
let patternPoints = [];

// Add movement state for second spotlight
let current2Pattern = PATTERNS.DIRECT;
let pattern2Progress = 0;
let pattern2Points = [];

// Add movement state for third spotlight
let current3Pattern = PATTERNS.DIRECT;
let pattern3Progress = 0;
let pattern3Points = [];

// Add movement state for fourth spotlight
let current4Pattern = PATTERNS.DIRECT;
let pattern4Progress = 0;
let pattern4Points = [];

// Add movement state for fifth spotlight
let current5Pattern = PATTERNS.DIRECT;
let pattern5Progress = 0;
let pattern5Points = [];

function generatePatternPath() {
  patternProgress = 0;
  patternPoints = [];
  
  const dx = coupleX - lightX;
  const dy = coupleY - lightY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  switch(currentPattern) {
    case PATTERNS.DIRECT:
      // Simple direct path
      patternPoints = [{ x: coupleX, y: coupleY }];
      break;
      
    case PATTERNS.ZIGZAG:
      // Generate zigzag path
      const zigs = 3 + Math.floor(Math.random() * 3);
      const zigWidth = dist / 3;
      const angle = Math.atan2(dy, dx);
      const perpAngle = angle + Math.PI/2;
      
      for(let i = 0; i <= zigs; i++) {
        const progress = i / zigs;
        const forward = dist * progress;
        const side = (i % 2 ? 1 : -1) * zigWidth * (1 - progress);
        
        patternPoints.push({
          x: lightX + Math.cos(angle) * forward + Math.cos(perpAngle) * side,
          y: lightY + Math.sin(angle) * forward + Math.sin(perpAngle) * side
        });
      }
      // Add final point
      patternPoints.push({ x: coupleX, y: coupleY });
      break;
  }
}

function generatePatternPath2() {
  pattern2Progress = 0;
  pattern2Points = [];
  
  const dx = coupleX - light2X;
  const dy = coupleY - light2Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  switch(current2Pattern) {
    case PATTERNS.DIRECT:
      // Simple direct path
      pattern2Points = [{ x: coupleX, y: coupleY }];
      break;
      
    case PATTERNS.ZIGZAG:
      // Generate zigzag path
      const zigs = 3 + Math.floor(Math.random() * 3);
      const zigWidth = dist / 3;
      const angle = Math.atan2(dy, dx);
      const perpAngle = angle + Math.PI/2;
      
      for(let i = 0; i <= zigs; i++) {
        const progress = i / zigs;
        const forward = dist * progress;
        const side = (i % 2 ? 1 : -1) * zigWidth * (1 - progress);
        
        pattern2Points.push({
          x: light2X + Math.cos(angle) * forward + Math.cos(perpAngle) * side,
          y: light2Y + Math.sin(angle) * forward + Math.sin(perpAngle) * side
        });
      }
      // Add final point
      pattern2Points.push({ x: coupleX, y: coupleY });
      break;
  }
}

function generatePatternPath3() {
  pattern3Progress = 0;
  pattern3Points = [];
  
  const dx = coupleX - light3X;
  const dy = coupleY - light3Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  switch(current3Pattern) {
    case PATTERNS.DIRECT:
      pattern3Points = [{ x: coupleX, y: coupleY }];
      break;
      
    case PATTERNS.ZIGZAG:
      const zigs = 3 + Math.floor(Math.random() * 3);
      const zigWidth = dist / 3;
      const angle = Math.atan2(dy, dx);
      const perpAngle = angle + Math.PI/2;
      
      for(let i = 0; i <= zigs; i++) {
        const progress = i / zigs;
        const forward = dist * progress;
        const side = (i % 2 ? 1 : -1) * zigWidth * (1 - progress);
        
        pattern3Points.push({
          x: light3X + Math.cos(angle) * forward + Math.cos(perpAngle) * side,
          y: light3Y + Math.sin(angle) * forward + Math.sin(perpAngle) * side
        });
      }
      pattern3Points.push({ x: coupleX, y: coupleY });
      break;
  }
}

function generatePatternPath4() {
  pattern4Progress = 0;
  pattern4Points = [];
  
  const dx = coupleX - light4X;
  const dy = coupleY - light4Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  switch(current4Pattern) {
    case PATTERNS.DIRECT:
      pattern4Points = [{ x: coupleX, y: coupleY }];
      break;
      
    case PATTERNS.ZIGZAG:
      const zigs = 3 + Math.floor(Math.random() * 3);
      const zigWidth = dist / 3;
      const angle = Math.atan2(dy, dx);
      const perpAngle = angle + Math.PI/2;
      
      for(let i = 0; i <= zigs; i++) {
        const progress = i / zigs;
        const forward = dist * progress;
        const side = (i % 2 ? 1 : -1) * zigWidth * (1 - progress);
        
        pattern4Points.push({
          x: light4X + Math.cos(angle) * forward + Math.cos(perpAngle) * side,
          y: light4Y + Math.sin(angle) * forward + Math.sin(perpAngle) * side
        });
      }
      pattern4Points.push({ x: coupleX, y: coupleY });
      break;
  }
}

function generatePatternPath5() {
  pattern5Progress = 0;
  pattern5Points = [];
  
  const dx = coupleX - light5X;
  const dy = coupleY - light5Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  switch(current5Pattern) {
    case PATTERNS.DIRECT:
      pattern5Points = [{ x: coupleX, y: coupleY }];
      break;
      
    case PATTERNS.ZIGZAG:
      const zigs = 3 + Math.floor(Math.random() * 3);
      const zigWidth = dist / 3;
      const angle = Math.atan2(dy, dx);
      const perpAngle = angle + Math.PI/2;
      
      for(let i = 0; i <= zigs; i++) {
        const progress = i / zigs;
        const forward = dist * progress;
        const side = (i % 2 ? 1 : -1) * zigWidth * (1 - progress);
        
        pattern5Points.push({
          x: light5X + Math.cos(angle) * forward + Math.cos(perpAngle) * side,
          y: light5Y + Math.sin(angle) * forward + Math.sin(perpAngle) * side
        });
      }
      pattern5Points.push({ x: coupleX, y: coupleY });
      break;
  }
}

// --- Camera Overlay (delayed) ---
// Remove delay-related variables
// const CAMERA_DELAY = 0.03; // seconds
// let lightTrail = []; // {x, y, t}

// --- Kiss Cam Monitor ---
const MONITOR_W = 290; // Width of the screen in the background
const MONITOR_H = 206; // Height of the screen in the background
const MONITOR_X = 300; // Position of the screen
const MONITOR_Y = 30; // Position of the screen
const VIEW_SIZE = 50; // Size of the area to show in the monitor
const LIGHT_RADIUS = 70; // Radius of the red light

// Add constants for the restricted areas
const SCREEN_AREA = {
  x: MONITOR_X - 40,
  y: MONITOR_Y - 40,
  width: MONITOR_W + 80,
  height: MONITOR_H + 80
};

// Add cameraman restricted area - you can adjust these coordinates
const CAMERAMAN_AREA = {
  x: 600, // Adjust this X coordinate based on where the cameraman is
  y: 300, // Adjust this Y coordinate based on where the cameraman is  
  width: 200, // Adjust width to cover the cameraman figure
  height: 300 // Adjust height to cover the cameraman figure
};

// Update restricted areas when monitor scales
function updateRestrictedAreas() {
  SCREEN_AREA = {
    x: MONITOR_X - 40,
    y: MONITOR_Y - 40,
    width: MONITOR_W + 80,
    height: MONITOR_H + 80
  };
  
  // Scale cameraman area too
  const scaleX = CANVAS_WIDTH / 900;
  const scaleY = CANVAS_HEIGHT / 600;
  CAMERAMAN_AREA = {
    x: 600 * scaleX,
    y: 300 * scaleY,
    width: 200 * scaleX,
    height: 300 * scaleY
  };
}

// Add this helper function to check if a point is in or near the Kiss Cam screen
function isInKissCamArea(x, y) {
  // Add a small buffer around the screen area
  const buffer = 40;
  return x >= MONITOR_X - buffer &&
         x <= MONITOR_X + MONITOR_W + buffer &&
         y >= MONITOR_Y - buffer &&
         y <= MONITOR_Y + MONITOR_H + buffer;
}

// Add this helper function to check if a path crosses the Kiss Cam area
function pathCrossesKissCam(x1, y1, x2, y2) {
  // Check a few points along the path
  for (let t = 0; t <= 1; t += 0.2) {
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (isInKissCamArea(x, y)) {
      return true;
    }
  }
  return false;
}

// --- UI Elements ---
const scoreEl = document.getElementById('score');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const gameoverOverlay = document.getElementById('gameover-overlay');
const finalScoreEl = document.getElementById('final-score');
const retryBtn = document.getElementById('retry-btn');
const hugButton = document.getElementById('hug-button');
const cameraShutterSound = document.getElementById('camera-shutter');
const gameEndSound = document.getElementById('game-end-sound');

// --- Audio Management ---
let audioInitialized = false;

function initializeAudio() {
  if (audioInitialized) return;
  
  // Create a promise to initialize audio after user interaction
  const sounds = [cameraShutterSound, gameEndSound];
  
  sounds.forEach(sound => {
    if (sound) {
      // Set initial properties
      sound.volume = 0.01; // Very quiet
      sound.muted = false;
      
      // Try to load and play a tiny bit to unlock audio
      sound.play().then(() => {
        sound.pause();
        sound.currentTime = 0;
        console.log('Audio unlocked for', sound.id);
      }).catch(e => {
        console.log('Audio unlock failed for', sound.id, e);
      });
    }
  });
  
  audioInitialized = true;
  console.log('Audio system initialized');
}

// --- Audio Helper ---
function playShutterSound() {
  if (!audioInitialized) {
    initializeAudio();
  }
  
  if (cameraShutterSound && cameraShutterSound.readyState >= 2) {
    try {
      cameraShutterSound.currentTime = 2.0; // Start at 2.0 seconds where shutter sound begins
      cameraShutterSound.volume = 0.4; // Set volume to 40%
      cameraShutterSound.play().catch(e => {
        console.log('Shutter audio play failed:', e);
      });
    } catch (e) {
      console.log('Shutter audio error:', e);
    }
  }
}

function playGameEndSound() {
  if (!audioInitialized) {
    initializeAudio();
  }
  
  if (gameEndSound && gameEndSound.readyState >= 2) {
    try {
      gameEndSound.currentTime = 0; // Start from beginning
      gameEndSound.volume = 0.7; // Set volume to 70%
      gameEndSound.play().catch(e => {
        console.log('Game end audio play failed:', e);
      });
    } catch (e) {
      console.log('Game end audio error:', e);
    }
  }
}

// --- High Score ---
function loadHighScore() {
  highScore = Number(localStorage.getItem('kisscam-highscore') || '0');
}
function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('kisscam-highscore', String(highScore));
  }
}
function setScore(val) {
  score = Math.max(0, Math.floor(val)); // Ensure integer scores
  scoreEl.textContent = Math.floor(score);
  console.log('New score:', score); // Debug
}

function pickNewLightTarget() {
  const difficulty = getDifficultyMultiplier();
  
  if (justCheckedCouple) {
    // Move away after checking couple - ensure good distance
    let attempts = 0;
    do {
      lightTargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      lightTargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      attempts++;
      
      if (attempts > 20) {
        // Force a position far from couple
        lightTargetX = coupleX > CANVAS_WIDTH/2 ? 100 : CANVAS_WIDTH - 100;
        lightTargetY = coupleY > CANVAS_HEIGHT/2 ? 100 : CANVAS_HEIGHT - 100;
        break;
      }
    } while (
      isInRestrictedArea(lightTargetX, lightTargetY) ||
      Math.hypot(lightTargetX - coupleX, lightTargetY - coupleY) < 200
    );
    justCheckedCouple = false;
    currentPattern = PATTERNS.DIRECT;
    console.log('Light 1 moving away to:', lightTargetX, lightTargetY);
  } else {
    // Chance to target couple increases with difficulty
    const targetChance = 0.4 + (difficulty * 0.2);
    if (Math.random() < targetChance) {
      // Pick a random pattern
      const patterns = Object.values(PATTERNS);
      currentPattern = patterns[Math.floor(Math.random() * patterns.length)];
      generatePatternPath();
      if (patternPoints.length > 0) {
        const nextPoint = patternPoints[0];
        lightTargetX = nextPoint.x;
        lightTargetY = nextPoint.y;
      }
      justCheckedCouple = patternPoints.length <= 1;
    } else {
      // Random position
      lightTargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      lightTargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      currentPattern = PATTERNS.DIRECT;
    }
  }

  if (isInRestrictedArea(lightTargetX, lightTargetY)) {
    pickNewLightTarget();
    return;
  }

  lightPathTimer = 0;
  lightPathDuration = Math.max(0.3, 1.0 - (difficulty * 0.2));
}

function pickNewLightTarget2() {
  const difficulty = getDifficultyMultiplier();
  
  if (justCheckedCouple) {
    // Move away after checking couple - ensure good distance
    let attempts = 0;
    do {
      light2TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light2TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      attempts++;
      
      if (attempts > 20) {
        // Force a position far from couple
        light2TargetX = coupleX > CANVAS_WIDTH/2 ? 100 : CANVAS_WIDTH - 100;
        light2TargetY = coupleY > CANVAS_HEIGHT/2 ? 100 : CANVAS_HEIGHT - 100;
        break;
      }
    } while (
      isInRestrictedArea(light2TargetX, light2TargetY) ||
      Math.hypot(light2TargetX - coupleX, light2TargetY - coupleY) < 200
    );
    justCheckedCouple = false;
    current2Pattern = PATTERNS.DIRECT;
    console.log('Light 2 moving away to:', light2TargetX, light2TargetY);
  } else {
    // Chance to target couple increases with difficulty
    const targetChance = 0.4 + (difficulty * 0.2);
    if (Math.random() < targetChance) {
      // Pick a random pattern
      const patterns = Object.values(PATTERNS);
      current2Pattern = patterns[Math.floor(Math.random() * patterns.length)];
      generatePatternPath2();
      if (pattern2Points.length > 0) {
        const nextPoint = pattern2Points[0];
        light2TargetX = nextPoint.x;
        light2TargetY = nextPoint.y;
      }
      justCheckedCouple = pattern2Points.length <= 1;
    } else {
      // Random position
      light2TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light2TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      current2Pattern = PATTERNS.DIRECT;
    }
  }

  if (isInRestrictedArea(light2TargetX, light2TargetY)) {
    pickNewLightTarget2();
    return;
  }

  light2PathTimer = 0;
  light2PathDuration = Math.max(0.3, 1.0 - (difficulty * 0.2));
}

function pickNewLightTarget3() {
  const difficulty = getDifficultyMultiplier();
  
  if (justCheckedCouple) {
    // Move away after checking couple - ensure good distance
    let attempts = 0;
    do {
      light3TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light3TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      attempts++;
      
      if (attempts > 20) {
        // Force a position far from couple
        light3TargetX = coupleX > CANVAS_WIDTH/2 ? 100 : CANVAS_WIDTH - 100;
        light3TargetY = coupleY > CANVAS_HEIGHT/2 ? 100 : CANVAS_HEIGHT - 100;
        break;
      }
    } while (
      isInRestrictedArea(light3TargetX, light3TargetY) ||
      Math.hypot(light3TargetX - coupleX, light3TargetY - coupleY) < 200
    );
    justCheckedCouple = false;
    current3Pattern = PATTERNS.DIRECT;
    console.log('Light 3 moving away to:', light3TargetX, light3TargetY);
  } else {
    // Chance to target couple increases with difficulty
    const targetChance = 0.4 + (difficulty * 0.2);
    if (Math.random() < targetChance) {
      // Pick a random pattern
      const patterns = Object.values(PATTERNS);
      current3Pattern = patterns[Math.floor(Math.random() * patterns.length)];
      generatePatternPath3();
      if (pattern3Points.length > 0) {
        const nextPoint = pattern3Points[0];
        light3TargetX = nextPoint.x;
        light3TargetY = nextPoint.y;
      }
      justCheckedCouple = pattern3Points.length <= 1;
    } else {
      // Random position
      light3TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light3TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      current3Pattern = PATTERNS.DIRECT;
    }
  }

  if (isInRestrictedArea(light3TargetX, light3TargetY)) {
    pickNewLightTarget3();
    return;
  }

  light3PathTimer = 0;
  light3PathDuration = Math.max(0.3, 1.0 - (difficulty * 0.2));
}

function pickNewLightTarget4() {
  const difficulty = getDifficultyMultiplier();
  
  if (justCheckedCouple) {
    // Move away after checking couple - ensure good distance
    let attempts = 0;
    do {
      light4TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light4TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      attempts++;
      
      if (attempts > 20) {
        // Force a position far from couple
        light4TargetX = coupleX > CANVAS_WIDTH/2 ? 100 : CANVAS_WIDTH - 100;
        light4TargetY = coupleY > CANVAS_HEIGHT/2 ? 100 : CANVAS_HEIGHT - 100;
        break;
      }
    } while (
      isInRestrictedArea(light4TargetX, light4TargetY) ||
      Math.hypot(light4TargetX - coupleX, light4TargetY - coupleY) < 200
    );
    justCheckedCouple = false;
    current4Pattern = PATTERNS.DIRECT;
    console.log('Light 4 moving away to:', light4TargetX, light4TargetY);
  } else {
    // Chance to target couple increases with difficulty
    const targetChance = 0.4 + (difficulty * 0.2);
    if (Math.random() < targetChance) {
      // Pick a random pattern
      const patterns = Object.values(PATTERNS);
      current4Pattern = patterns[Math.floor(Math.random() * patterns.length)];
      generatePatternPath4();
      if (pattern4Points.length > 0) {
        const nextPoint = pattern4Points[0];
        light4TargetX = nextPoint.x;
        light4TargetY = nextPoint.y;
      }
      justCheckedCouple = pattern4Points.length <= 1;
    } else {
      // Random position
      light4TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light4TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      current4Pattern = PATTERNS.DIRECT;
    }
  }

  if (isInRestrictedArea(light4TargetX, light4TargetY)) {
    pickNewLightTarget4();
    return;
  }

  light4PathTimer = 0;
  light4PathDuration = Math.max(0.3, 1.0 - (difficulty * 0.2));
}

function pickNewLightTarget5() {
  const difficulty = getDifficultyMultiplier();
  
  if (justCheckedCouple) {
    // Move away after checking couple - ensure good distance
    let attempts = 0;
    do {
      light5TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light5TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      attempts++;
      
      if (attempts > 20) {
        // Force a position far from couple
        light5TargetX = coupleX > CANVAS_WIDTH/2 ? 100 : CANVAS_WIDTH - 100;
        light5TargetY = coupleY > CANVAS_HEIGHT/2 ? 100 : CANVAS_HEIGHT - 100;
        break;
      }
    } while (
      isInRestrictedArea(light5TargetX, light5TargetY) ||
      Math.hypot(light5TargetX - coupleX, light5TargetY - coupleY) < 200
    );
    justCheckedCouple = false;
    current5Pattern = PATTERNS.DIRECT;
    console.log('Light 5 moving away to:', light5TargetX, light5TargetY);
  } else {
    // Chance to target couple increases with difficulty
    const targetChance = 0.4 + (difficulty * 0.2);
    if (Math.random() < targetChance) {
      // Pick a random pattern
      const patterns = Object.values(PATTERNS);
      current5Pattern = patterns[Math.floor(Math.random() * patterns.length)];
      generatePatternPath5();
      if (pattern5Points.length > 0) {
        const nextPoint = pattern5Points[0];
        light5TargetX = nextPoint.x;
        light5TargetY = nextPoint.y;
      }
      justCheckedCouple = pattern5Points.length <= 1;
    } else {
      // Random position
      light5TargetX = 60 + Math.random() * (CANVAS_WIDTH - 120);
      light5TargetY = 80 + Math.random() * (CANVAS_HEIGHT - 160);
      current5Pattern = PATTERNS.DIRECT;
    }
  }

  if (isInRestrictedArea(light5TargetX, light5TargetY)) {
    pickNewLightTarget5();
    return;
  }

  light5PathTimer = 0;
  light5PathDuration = Math.max(0.3, 1.0 - (difficulty * 0.2));
}

// Update movement in gameLoop
function updateMovement(dt) {
  if (gameState !== 'playing') return;

  const dx = lightTargetX - lightX;
  const dy = lightTargetY - lightY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const frameSpeed = LIGHT_SPEED * dt;
  if (dist > frameSpeed) {
    lightX += (dx / dist) * frameSpeed;
    lightY += (dy / dist) * frameSpeed;
  } else {
    lightX = lightTargetX;
    lightY = lightTargetY;
    
    // If following a pattern, move to next point
    if (currentPattern !== PATTERNS.DIRECT && patternPoints.length > 1) {
      patternPoints.shift();
      const nextPoint = patternPoints[0];
      lightTargetX = nextPoint.x;
      lightTargetY = nextPoint.y;
      justCheckedCouple = patternPoints.length <= 1;
    } else if (dist < 5) {
      // Check if this spotlight can trigger a flash
      const distToCouple = Math.hypot(lightX - coupleX, lightY - coupleY);
      const allDists = [
        distToCouple,
        light2Active ? Math.hypot(light2X - coupleX, light2Y - coupleY) : Infinity,
        light3Active ? Math.hypot(light3X - coupleX, light3Y - coupleY) : Infinity,
        light4Active ? Math.hypot(light4X - coupleX, light4Y - coupleY) : Infinity,
        light5Active ? Math.hypot(light5X - coupleX, light5Y - coupleY) : Infinity
      ];
      const isClosest = distToCouple <= Math.min(...allDists);
      const timeSinceLastFlash = (Date.now() / 1000) - lastFlashTime;
      const minTimeBetweenFlashes = 2.0;
      
      if (isClosest && distToCouple < DETECTION_RADIUS && gameState === 'playing' && !light1HasFlashed && !flashInProgress && timeSinceLastFlash >= minTimeBetweenFlashes) {
        console.log('Light 1 triggering flash');
        playShutterSound();
        gameState = 'flashing';
        flashStart = Date.now() / 1000;
        flashAlpha = FLASH_INTENSITY;
        flashingSpotlight = 1;
        light1HasFlashed = true;
        flashInProgress = true;
        lastFlashTime = Date.now() / 1000;
        justCheckedCouple = true;
        pickNewLightTarget();
      } else {
        pickNewLightTarget();
      }
    }
  }
}

function updateMovement2(dt) {
  if (!light2Active || gameState !== 'playing') return;

  const dx = light2TargetX - light2X;
  const dy = light2TargetY - light2Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const frameSpeed = LIGHT_SPEED * dt;
  if (dist > frameSpeed) {
    light2X += (dx / dist) * frameSpeed;
    light2Y += (dy / dist) * frameSpeed;
  } else {
    light2X = light2TargetX;
    light2Y = light2TargetY;
    
    if (current2Pattern !== PATTERNS.DIRECT && pattern2Points.length > 1) {
      pattern2Points.shift();
      const nextPoint = pattern2Points[0];
      light2TargetX = nextPoint.x;
      light2TargetY = nextPoint.y;
      justCheckedCouple = pattern2Points.length <= 1;
    } else if (dist < 5) {
      const distToCouple = Math.hypot(light2X - coupleX, light2Y - coupleY);
      const allDists = [
        Math.hypot(lightX - coupleX, lightY - coupleY),
        distToCouple,
        light3Active ? Math.hypot(light3X - coupleX, light3Y - coupleY) : Infinity,
        light4Active ? Math.hypot(light4X - coupleX, light4Y - coupleY) : Infinity,
        light5Active ? Math.hypot(light5X - coupleX, light5Y - coupleY) : Infinity
      ];
      const isClosest = distToCouple <= Math.min(...allDists);
      const timeSinceLastFlash = (Date.now() / 1000) - lastFlashTime;
      const minTimeBetweenFlashes = 2.0;
      
      if (isClosest && distToCouple < DETECTION_RADIUS && gameState === 'playing' && !light2HasFlashed && !flashInProgress && timeSinceLastFlash >= minTimeBetweenFlashes) {
        console.log('Light 2 triggering flash');
        playShutterSound();
        gameState = 'flashing';
        flashStart = Date.now() / 1000;
        flashAlpha = FLASH_INTENSITY;
        flashingSpotlight = 2;
        light2HasFlashed = true;
        flashInProgress = true;
        lastFlashTime = Date.now() / 1000;
        justCheckedCouple = true;
        pickNewLightTarget2();
      } else {
        pickNewLightTarget2();
      }
    }
  }
}

function updateMovement3(dt) {
  if (!light3Active || gameState !== 'playing') return;

  const dx = light3TargetX - light3X;
  const dy = light3TargetY - light3Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const frameSpeed = LIGHT_SPEED * dt;
  if (dist > frameSpeed) {
    light3X += (dx / dist) * frameSpeed;
    light3Y += (dy / dist) * frameSpeed;
  } else {
    light3X = light3TargetX;
    light3Y = light3TargetY;
    
    if (current3Pattern !== PATTERNS.DIRECT && pattern3Points.length > 1) {
      pattern3Points.shift();
      const nextPoint = pattern3Points[0];
      light3TargetX = nextPoint.x;
      light3TargetY = nextPoint.y;
      justCheckedCouple = pattern3Points.length <= 1;
    } else if (dist < 5) {
      const distToCouple = Math.hypot(light3X - coupleX, light3Y - coupleY);
      const allDists = [
        Math.hypot(lightX - coupleX, lightY - coupleY),
        light2Active ? Math.hypot(light2X - coupleX, light2Y - coupleY) : Infinity,
        distToCouple,
        light4Active ? Math.hypot(light4X - coupleX, light4Y - coupleY) : Infinity,
        light5Active ? Math.hypot(light5X - coupleX, light5Y - coupleY) : Infinity
      ];
      const isClosest = distToCouple <= Math.min(...allDists);
      const timeSinceLastFlash = (Date.now() / 1000) - lastFlashTime;
      const minTimeBetweenFlashes = 2.0;
      
      if (isClosest && distToCouple < DETECTION_RADIUS && gameState === 'playing' && !light3HasFlashed && !flashInProgress && timeSinceLastFlash >= minTimeBetweenFlashes) {
        console.log('Light 3 triggering flash');
        playShutterSound();
        gameState = 'flashing';
        flashStart = Date.now() / 1000;
        flashAlpha = FLASH_INTENSITY;
        flashingSpotlight = 3;
        light3HasFlashed = true;
        flashInProgress = true;
        lastFlashTime = Date.now() / 1000;
        justCheckedCouple = true;
        pickNewLightTarget3();
      } else {
        pickNewLightTarget3();
      }
    }
  }
}

function updateMovement4(dt) {
  if (!light4Active || gameState !== 'playing') return;

  const dx = light4TargetX - light4X;
  const dy = light4TargetY - light4Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const frameSpeed = LIGHT_SPEED * dt;
  if (dist > frameSpeed) {
    light4X += (dx / dist) * frameSpeed;
    light4Y += (dy / dist) * frameSpeed;
  } else {
    light4X = light4TargetX;
    light4Y = light4TargetY;
    
    if (current4Pattern !== PATTERNS.DIRECT && pattern4Points.length > 1) {
      pattern4Points.shift();
      const nextPoint = pattern4Points[0];
      light4TargetX = nextPoint.x;
      light4TargetY = nextPoint.y;
      justCheckedCouple = pattern4Points.length <= 1;
    } else if (dist < 5) {
      const distToCouple = Math.hypot(light4X - coupleX, light4Y - coupleY);
      const allDists = [
        Math.hypot(lightX - coupleX, lightY - coupleY),
        light2Active ? Math.hypot(light2X - coupleX, light2Y - coupleY) : Infinity,
        light3Active ? Math.hypot(light3X - coupleX, light3Y - coupleY) : Infinity,
        distToCouple,
        light5Active ? Math.hypot(light5X - coupleX, light5Y - coupleY) : Infinity
      ];
      const isClosest = distToCouple <= Math.min(...allDists);
      const timeSinceLastFlash = (Date.now() / 1000) - lastFlashTime;
      const minTimeBetweenFlashes = 2.0;
      
      if (isClosest && distToCouple < DETECTION_RADIUS && gameState === 'playing' && !light4HasFlashed && !flashInProgress && timeSinceLastFlash >= minTimeBetweenFlashes) {
        console.log('Light 4 triggering flash');
        playShutterSound();
        gameState = 'flashing';
        flashStart = Date.now() / 1000;
        flashAlpha = FLASH_INTENSITY;
        flashingSpotlight = 4;
        light4HasFlashed = true;
        flashInProgress = true;
        lastFlashTime = Date.now() / 1000;
        justCheckedCouple = true;
        pickNewLightTarget4();
      } else {
        pickNewLightTarget4();
      }
    }
  }
}

function updateMovement5(dt) {
  if (!light5Active || gameState !== 'playing') return;

  const dx = light5TargetX - light5X;
  const dy = light5TargetY - light5Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const frameSpeed = LIGHT_SPEED * dt;
  if (dist > frameSpeed) {
    light5X += (dx / dist) * frameSpeed;
    light5Y += (dy / dist) * frameSpeed;
  } else {
    light5X = light5TargetX;
    light5Y = light5TargetY;
    
    if (current5Pattern !== PATTERNS.DIRECT && pattern5Points.length > 1) {
      pattern5Points.shift();
      const nextPoint = pattern5Points[0];
      light5TargetX = nextPoint.x;
      light5TargetY = nextPoint.y;
      justCheckedCouple = pattern5Points.length <= 1;
    } else if (dist < 5) {
      const distToCouple = Math.hypot(light5X - coupleX, light5Y - coupleY);
      const allDists = [
        Math.hypot(lightX - coupleX, lightY - coupleY),
        light2Active ? Math.hypot(light2X - coupleX, light2Y - coupleY) : Infinity,
        light3Active ? Math.hypot(light3X - coupleX, light3Y - coupleY) : Infinity,
        light4Active ? Math.hypot(light4X - coupleX, light4Y - coupleY) : Infinity,
        distToCouple
      ];
      const isClosest = distToCouple <= Math.min(...allDists);
      const timeSinceLastFlash = (Date.now() / 1000) - lastFlashTime;
      const minTimeBetweenFlashes = 2.0;
      
      if (isClosest && distToCouple < DETECTION_RADIUS && gameState === 'playing' && !light5HasFlashed && !flashInProgress && timeSinceLastFlash >= minTimeBetweenFlashes) {
        console.log('Light 5 triggering flash');
        playShutterSound();
        gameState = 'flashing';
        flashStart = Date.now() / 1000;
        flashAlpha = FLASH_INTENSITY;
        flashingSpotlight = 5;
        light5HasFlashed = true;
        flashInProgress = true;
        lastFlashTime = Date.now() / 1000;
        justCheckedCouple = true;
        pickNewLightTarget5();
      } else {
        pickNewLightTarget5();
      }
    }
  }
}

// --- Animation Loop ---
let lastTimestamp = 0;
function gameLoop(ts) {
  if (!lastTimestamp) lastTimestamp = ts;
  const dt = (ts - lastTimestamp) / 1000;
  lastTimestamp = ts;

  // If in start state, just show start screen
  if (gameState === 'start') {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (bgImg.complete) {
      ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    requestAnimationFrame(gameLoop);
    return;
  }

  // Update isSpaceDown based on current input states (keyboard or mobile)
  // Only update when not frozen on camera, otherwise maintain frozen state
  if (!isOnKissCam) {
    isSpaceDown = isKeyboardSpaceDown || isMobileHugPressed;
  }

  // Update score based on hugging state - ONLY ONCE
  if (gameState === 'playing' && !isOnKissCam) {
    if (isSpaceDown) {
      setScore(score + Math.floor(SCORE_INCREASE_RATE * dt));
    } else {
      setScore(score - Math.floor(SCORE_DECREASE_RATE * dt));
    }
  }

  // Clear and draw background
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (bgImg.complete) {
    ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  }

  // Draw couple - use frozen state if on camera
  if (huggingImg.complete && talkingImg.complete) {
    ctx.save();
    // Only use frozen state when actually on camera, not when light is approaching
    const img = isOnKissCam ? (frozenHuggingState ? huggingImg : talkingImg) : (isSpaceDown ? huggingImg : talkingImg);
    ctx.drawImage(img, coupleX - COUPLE_SIZE/2, coupleY - COUPLE_SIZE/2, COUPLE_SIZE, COUPLE_SIZE);
    ctx.restore();
  }

  // Update movement
  updateMovement(dt);
  updateMovement2(dt);
  updateMovement3(dt);
  updateMovement4(dt);
  updateMovement5(dt);

  // Activate spotlights at different times
  const timeElapsed = (Date.now() / 1000) - gameStartTime;
  
  // Second spotlight after 10 seconds
  if (!light2Active && timeElapsed >= 10) {
    light2Active = true;
    pickNewLightTarget2();
  }
  
  // Third spotlight after 30 seconds
  if (!light3Active && timeElapsed >= 30) {
    light3Active = true;
    pickNewLightTarget3();
  }
  
  // Fourth spotlight after 50 seconds
  if (!light4Active && timeElapsed >= 50) {
    light4Active = true;
    pickNewLightTarget4();
  }
  
  // Fifth spotlight after 70 seconds
  if (!light5Active && timeElapsed >= 70) {
    light5Active = true;
    pickNewLightTarget5();
  }

  // Draw red light
  ctx.save();
  ctx.globalAlpha = 0.7;
  const grad = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 70);
  grad.addColorStop(0, 'rgba(255,0,64,0.7)');
  grad.addColorStop(0.6, 'rgba(255,0,64,0.2)');
  grad.addColorStop(1, 'rgba(255,0,64,0)');
  ctx.beginPath();
  ctx.arc(lightX, lightY, 70, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Draw red light 2
  if (light2Active) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    const grad2 = ctx.createRadialGradient(light2X, light2Y, 0, light2X, light2Y, 70);
    grad2.addColorStop(0, 'rgba(255,0,64,0.7)');
    grad2.addColorStop(0.6, 'rgba(255,0,64,0.2)');
    grad2.addColorStop(1, 'rgba(255,0,64,0)');
    ctx.beginPath();
    ctx.arc(light2X, light2Y, 70, 0, 2 * Math.PI);
    ctx.fillStyle = grad2;
    ctx.fill();
    ctx.restore();
  }

  // Draw red light 3
  if (light3Active) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    const grad3 = ctx.createRadialGradient(light3X, light3Y, 0, light3X, light3Y, 70);
    grad3.addColorStop(0, 'rgba(255,0,64,0.7)');
    grad3.addColorStop(0.6, 'rgba(255,0,64,0.2)');
    grad3.addColorStop(1, 'rgba(255,0,64,0)');
    ctx.beginPath();
    ctx.arc(light3X, light3Y, 70, 0, 2 * Math.PI);
    ctx.fillStyle = grad3;
    ctx.fill();
    ctx.restore();
  }

  // Draw red light 4
  if (light4Active) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    const grad4 = ctx.createRadialGradient(light4X, light4Y, 0, light4X, light4Y, 70);
    grad4.addColorStop(0, 'rgba(255,0,64,0.7)');
    grad4.addColorStop(0.6, 'rgba(255,0,64,0.2)');
    grad4.addColorStop(1, 'rgba(255,0,64,0)');
    ctx.beginPath();
    ctx.arc(light4X, light4Y, 70, 0, 2 * Math.PI);
    ctx.fillStyle = grad4;
    ctx.fill();
    ctx.restore();
  }

  // Draw red light 5
  if (light5Active) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    const grad5 = ctx.createRadialGradient(light5X, light5Y, 0, light5X, light5Y, 70);
    grad5.addColorStop(0, 'rgba(255,0,64,0.7)');
    grad5.addColorStop(0.6, 'rgba(255,0,64,0.2)');
    grad5.addColorStop(1, 'rgba(255,0,64,0)');
    ctx.beginPath();
    ctx.arc(light5X, light5Y, 70, 0, 2 * Math.PI);
    ctx.fillStyle = grad5;
    ctx.fill();
    ctx.restore();
  }

  // Draw Kiss Cam view
  if (bgImg.complete) {
    // Determine which spotlight is closest to the couple
    const dist1 = Math.sqrt((lightX - coupleX) ** 2 + (lightY - coupleY) ** 2);
    const dist2 = light2Active ? Math.sqrt((light2X - coupleX) ** 2 + (light2Y - coupleY) ** 2) : Infinity;
    const dist3 = light3Active ? Math.sqrt((light3X - coupleX) ** 2 + (light3Y - coupleY) ** 2) : Infinity;
    const dist4 = light4Active ? Math.sqrt((light4X - coupleX) ** 2 + (light4Y - coupleY) ** 2) : Infinity;
    const dist5 = light5Active ? Math.sqrt((light5X - coupleX) ** 2 + (light5Y - coupleY) ** 2) : Infinity;
    
    // Find the closest spotlight
    const minDist = Math.min(dist1, dist2, dist3, dist4, dist5);
    let trackingLightX, trackingLightY;
    
    if (minDist === dist1) {
      trackingLightX = lightX;
      trackingLightY = lightY;
    } else if (minDist === dist2) {
      trackingLightX = light2X;
      trackingLightY = light2Y;
    } else if (minDist === dist3) {
      trackingLightX = light3X;
      trackingLightY = light3Y;
    } else if (minDist === dist4) {
      trackingLightX = light4X;
      trackingLightY = light4Y;
    } else {
      trackingLightX = light5X;
      trackingLightY = light5Y;
    }
    
    // Calculate if couple is in range of the closest camera
    const inRange = minDist < DETECTION_RADIUS;

    // Update isOnKissCam and freeze state ONLY when actually in range
    if (inRange && !isOnKissCam) {
      isOnKissCam = true;
      frozenHuggingState = isSpaceDown;
    } else if (!inRange) {
      isOnKissCam = false;
      frozenHuggingState = false; // Reset frozen state when out of range
    }

    // Save the entire canvas state
    const snapshot = ctx.getImageData(
      // Always center on couple when in range, otherwise track the closest spotlight
      inRange ? 
        Math.round(coupleX - VIEW_SIZE/2) :
        Math.round(trackingLightX - VIEW_SIZE/2),
      inRange ?
        Math.round(coupleY - VIEW_SIZE/2) :
        Math.round(trackingLightY - VIEW_SIZE/2),
      VIEW_SIZE,
      VIEW_SIZE
    );

    // Draw the Kiss Cam monitor
    ctx.save();
    // Clear the monitor area first with dark background
    ctx.fillStyle = '#220033';
    ctx.fillRect(MONITOR_X, MONITOR_Y, MONITOR_W, MONITOR_H);

    // Create a temporary canvas for scaling
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = VIEW_SIZE;
    tempCanvas.height = VIEW_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(snapshot, 0, 0);

    // Draw the scaled snapshot into the monitor
    ctx.drawImage(
      tempCanvas,
      0, 0, VIEW_SIZE, VIEW_SIZE,
      MONITOR_X, MONITOR_Y, MONITOR_W, MONITOR_H
    );

    // If in range, draw "LIVE" text
    if (inRange) {
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = 'red';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('LIVE', MONITOR_X + 10, MONITOR_Y + 10);
    }

    ctx.restore();
  }

  // Handle flash state - only in Kiss Cam
  if (gameState === 'flashing') {
    // Draw flash only in Kiss Cam area
    ctx.save();
    ctx.beginPath();
    ctx.rect(MONITOR_X, MONITOR_Y, MONITOR_W, MONITOR_H);
    ctx.clip();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = 'white';
    ctx.fillRect(MONITOR_X, MONITOR_Y, MONITOR_W, MONITOR_H);
    ctx.restore();

    const flashElapsed = (Date.now() / 1000) - flashStart;
    flashAlpha = FLASH_INTENSITY * (1.0 - (flashElapsed / FLASH_DURATION));

    if (flashElapsed >= FLASH_DURATION) {
      console.log('Flash completed, checking result');
      // Check the spotlight that triggered the flash
      let triggeringDist;
      if (flashingSpotlight === 1) {
        triggeringDist = Math.sqrt((lightX - coupleX) ** 2 + (lightY - coupleY) ** 2);
      } else if (flashingSpotlight === 2) {
        triggeringDist = Math.sqrt((light2X - coupleX) ** 2 + (light2Y - coupleY) ** 2);
      } else if (flashingSpotlight === 3) {
        triggeringDist = Math.sqrt((light3X - coupleX) ** 2 + (light3Y - coupleY) ** 2);
      } else if (flashingSpotlight === 4) {
        triggeringDist = Math.sqrt((light4X - coupleX) ** 2 + (light4Y - coupleY) ** 2);
      } else { // flashingSpotlight === 5
        triggeringDist = Math.sqrt((light5X - coupleX) ** 2 + (light5Y - coupleY) ** 2);
      }
      
      // Check what image is actually being displayed
      const isDisplayingHugging = isOnKissCam ? frozenHuggingState : isSpaceDown;
      
      if (triggeringDist < DETECTION_RADIUS && isDisplayingHugging) {
        console.log('Game over!');
        endGame();
      } else {
        console.log('Flash missed, entering cooldown');
        gameState = 'cooldown';
        cooldownStart = Date.now() / 1000;
        flashInProgress = false; // Reset flash lock when entering cooldown
      }
    }
  }

  // Handle cooldown state
  if (gameState === 'cooldown') {
    const cooldownElapsed = (Date.now() / 1000) - cooldownStart;
    if (cooldownElapsed >= COOLDOWN_DURATION) {
      // Back to playing, pick new targets for all active spotlights and reset flash flags
      gameState = 'playing';
      light1HasFlashed = false;
      light2HasFlashed = false;
      light3HasFlashed = false;
      light4HasFlashed = false;
      light5HasFlashed = false;
      flashInProgress = false; // Reset global flash lock
      pickNewLightTarget();
      if (light2Active) {
        pickNewLightTarget2();
      }
      if (light3Active) {
        pickNewLightTarget3();
      }
      if (light4Active) {
        pickNewLightTarget4();
      }
      if (light5Active) {
        pickNewLightTarget5();
      }
    }
  }

  // Draw camera overlay (delayed)
  // Remove the old camera overlay drawing (the white rectangle and label that follows the red light)
  // --- Remove this block ---
  // let camX = lightX, camY = lightY;
  // for (let i = lightTrail.length - 1; i >= 0; i--) {
  //   if (now - lightTrail[i].t >= CAMERA_DELAY) {
  //     camX = lightTrail[i].x;
  //     camY = lightTrail[i].y;
  //     break;
  //   }
  // }
  // ctx.save();
  // ctx.globalAlpha = 0.95;
  // ctx.strokeStyle = '#fff';
  // ctx.lineWidth = 4;
  // ctx.beginPath();
  // ctx.rect(camX - 60, camY - 60, 120, 120);
  // ctx.stroke();
  // ctx.font = 'bold 22px sans-serif';
  // ctx.textAlign = 'center';
  // ctx.textBaseline = 'top';
  // ctx.fillStyle = '#fff';
  // ctx.fillText('KISS CAM', camX, camY + 62);
  // ctx.restore();
  // --- End remove ---

  // No need to draw frame, heart icon, or label since they're in the background image

  // If gameover, flash red light over couple
  if (gameState === 'gameover') {
    ctx.save();
    ctx.globalAlpha = 0.7;
    const grad2 = ctx.createRadialGradient(coupleX, coupleY, 0, coupleX, coupleY, 80);
    grad2.addColorStop(0, 'rgba(255,0,64,0.7)');
    grad2.addColorStop(0.6, 'rgba(255,0,64,0.2)');
    grad2.addColorStop(1, 'rgba(255,0,64,0)');
    ctx.beginPath();
    ctx.arc(coupleX, coupleY, 80, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = grad2;
    ctx.fill();
    ctx.restore();
  }

  requestAnimationFrame(gameLoop);
}

// --- Game Logic ---
function startGame() {
  gameState = 'playing';
  startOverlay.classList.add('hidden');
  gameStartTime = Date.now() / 1000;
  pickNewLightTarget();
}

function startRound() {
  gameState = 'playing';
  // Uncrouch couple is handled by the gameLoop drawing
  // pickNewLightTarget(); // This is now handled by gameLoop
  // Activate second spotlight after 10 seconds
  gameStartTime = Date.now() / 1000; // Set gameStartTime here
  pickNewLightTarget();
}

// Remove the old triggerKissCam function since we're handling detection in gameLoop
function triggerKissCam() {
  // Just set the target to the couple
  lightTargetX = coupleX;
  lightTargetY = coupleY;
}

// Remove any remaining references to ducking/crouching in the code
function onReact() {
  // This function is no longer needed
}

function endGame() {
  gameState = 'gameover';
  playGameEndSound();
  saveHighScore();
  finalScoreEl.innerHTML = `BUSTED!<br> Final Score: <b>${score}</b><br>High Score: <b>${highScore}</b><br>`;
  gameoverOverlay.classList.remove('hidden');
}

function resetGame() {
  if (!audioInitialized) {
    initializeAudio();
  }
  setScore(0);
  gameoverOverlay.classList.add('hidden');
  startOverlay.classList.remove('hidden');
  randomCouplePosition();
  gameState = 'start';
  lightX = CANVAS_WIDTH / 2;
  lightY = CANVAS_HEIGHT / 2;
  flashAlpha = 0;
  justCheckedCouple = false;
  isOnKissCam = false;
  isSpaceDown = false; // Reset space state
  isKeyboardSpaceDown = false; // Reset keyboard state
  isMobileHugPressed = false; // Reset mobile button state
  frozenHuggingState = false; // Reset frozen state
  flashingSpotlight = 1; // Reset to first spotlight
  light1HasFlashed = false; // Reset flash flags
  light2HasFlashed = false; // Reset flash flags
  light3HasFlashed = false; // Reset flash flags
  light4HasFlashed = false; // Reset flash flags
  light5HasFlashed = false; // Reset flash flags
  flashInProgress = false; // Reset global flash lock
  lastFlashTime = 0; // Reset last flash time
  gameStartTime = Date.now() / 1000;
  pickNewLightTarget();
  
  // Reset second spotlight
  light2Active = false;
  light2X = CANVAS_WIDTH / 3;
  light2Y = CANVAS_HEIGHT / 3;
  light2TargetX = light2X;
  light2TargetY = light2Y;
  current2Pattern = PATTERNS.DIRECT;
  pattern2Points = [];
  
  // Reset third spotlight
  light3Active = false;
  light3X = CANVAS_WIDTH / 4;
  light3Y = CANVAS_HEIGHT / 4;
  light3TargetX = light3X;
  light3TargetY = light3Y;
  current3Pattern = PATTERNS.DIRECT;
  pattern3Points = [];
  
  // Reset fourth spotlight
  light4Active = false;
  light4X = CANVAS_WIDTH * 0.75;
  light4Y = CANVAS_HEIGHT * 0.25;
  light4TargetX = light4X;
  light4TargetY = light4Y;
  current4Pattern = PATTERNS.DIRECT;
  pattern4Points = [];
  
  // Reset fifth spotlight
  light5Active = false;
  light5X = CANVAS_WIDTH * 0.6;
  light5Y = CANVAS_HEIGHT * 0.8;
  light5TargetX = light5X;
  light5TargetY = light5Y;
  current5Pattern = PATTERNS.DIRECT;
  pattern5Points = [];
}

// Remove any remaining references to ducking/crouching in the code
function crouchCouple() {
  // This function is no longer needed
}

function uncrouchCouple() {
  // This function is no longer needed
}

// Optional: Draw debug visualization of restricted areas
// Debug functions removed for production

// Input handlers
// Track keyboard space state separately
let isKeyboardSpaceDown = false;

function handleKey(e) {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!audioInitialized) {
      initializeAudio();
    }
    if (gameState === 'start') {
      startGame();
    } else {
      isKeyboardSpaceDown = true;
    }
  } else if (e.key === 'Enter' && gameState === 'gameover') {
    e.preventDefault();
    if (!audioInitialized) {
      initializeAudio();
    }
    resetGame();
  }
}

function handleKeyUp(e) {
  if (e.code === 'Space') {
    e.preventDefault();
    isKeyboardSpaceDown = false;
  }
}

// Mobile touch handlers
function handleHugStart(e) {
  e.preventDefault();
  if (!audioInitialized) {
    initializeAudio();
  }
  isMobileHugPressed = true;
  hugButton.classList.add('pressed');
}

function handleHugEnd(e) {
  e.preventDefault();
  isMobileHugPressed = false;
  hugButton.classList.remove('pressed');
}

// Prevent context menu on mobile
function preventContextMenu(e) {
  e.preventDefault();
  return false;
}

startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', resetGame);
document.addEventListener('keydown', handleKey);
document.addEventListener('keyup', handleKeyUp);

// Mobile button events
hugButton.addEventListener('touchstart', handleHugStart, { passive: false });
hugButton.addEventListener('touchend', handleHugEnd, { passive: false });
hugButton.addEventListener('touchcancel', handleHugEnd, { passive: false });

// Also support mouse events for desktop testing
hugButton.addEventListener('mousedown', handleHugStart);
hugButton.addEventListener('mouseup', handleHugEnd);
hugButton.addEventListener('mouseleave', handleHugEnd);

// Prevent context menu
hugButton.addEventListener('contextmenu', preventContextMenu);

// Prevent double-tap zoom on mobile
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Universal audio initialization fallback
function universalAudioInit() {
  if (!audioInitialized) {
    initializeAudio();
    // Remove the event listeners after first use
    document.removeEventListener('touchstart', universalAudioInit);
    document.removeEventListener('touchend', universalAudioInit);
    document.removeEventListener('click', universalAudioInit);
  }
}

// Add universal event listeners for mobile audio unlock
document.addEventListener('touchstart', universalAudioInit, { passive: true });
document.addEventListener('touchend', universalAudioInit, { passive: true });
document.addEventListener('click', universalAudioInit);

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadHighScore();
  setScore(0);
  randomCouplePosition();
  pickNewLightTarget();
  requestAnimationFrame(gameLoop);
  // Game starts on start screen instead of immediately playing
}); 