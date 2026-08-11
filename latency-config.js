// Latency Configuration for DistSim Framework
// Simulates various network conditions and latency patterns

const LATENCY_PROFILES = {
  // No latency (ideal network)
  none: { min: 0, max: 0, distribution: 'fixed' },
  
  // LAN conditions
  lan: { min: 1, max: 5, distribution: 'uniform' },
  
  // WAN conditions  
  wan: { min: 50, max: 150, distribution: 'normal', mean: 100, stddev: 25 },
  
  // High latency (satellite/poor connection)
  high: { min: 200, max: 800, distribution: 'normal', mean: 400, stddev: 100 },
  
  // Variable/unstable network
  unstable: { min: 10, max: 500, distribution: 'exponential', lambda: 0.01 },
  
  // Custom profiles for specific testing
  custom: { min: 0, max: 0, distribution: 'fixed' }
};

// Persistent state file
const fs = require('fs');
const path = require('path');
const STATE_FILE = path.join(__dirname, 'latency-state.json');

// Load persistent state
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('Failed to load latency state:', error.message);
  }
  return { currentProfile: 'none', customConfig: null };
}

// Save persistent state
function saveState(profile, customConfig) {
  try {
    const state = { currentProfile: profile, customConfig };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.warn('Failed to save latency state:', error.message);
  }
}

// Load initial state
const initialState = loadState();
let currentProfile = initialState.currentProfile;
let customConfig = initialState.customConfig;

// Node-specific latency (simulates geographic distribution)
const NODE_LATENCY_MATRIX = {
  // Example: A-B has different latency than A-C
  'A-B': { multiplier: 1.0 },
  'A-C': { multiplier: 1.2 },
  'A-D': { multiplier: 0.8 },
  // Add more pairs as needed
};

// Byzantine behavior can include network delays
const BYZANTINE_LATENCY = {
  delay: { min: 1000, max: 3000, distribution: 'uniform' }, // 1-3 second delays
  intermittent: { dropRate: 0.3, delayMultiplier: 2.0 }     // Drop 30% of messages, delay others
};

function setLatencyProfile(profile, customSettings = null) {
  if (profile === 'custom' && customSettings) {
    currentProfile = 'custom';
    customConfig = customSettings;
  } else if (LATENCY_PROFILES[profile]) {
    currentProfile = profile;
    customConfig = null;
  } else {
    throw new Error(`Unknown latency profile: ${profile}`);
  }
  
  // Save state persistently
  saveState(currentProfile, customConfig);
  console.log(`Latency profile set to: ${profile}`);
}

function getLatencyConfig() {
  return currentProfile === 'custom' ? customConfig : LATENCY_PROFILES[currentProfile];
}

function generateLatency(fromNode = null, toNode = null, byzantineBehavior = null) {
  let config = getLatencyConfig();
  
  // Apply Byzantine behavior latency
  if (byzantineBehavior === 'delay') {
    config = BYZANTINE_LATENCY.delay;
  } else if (byzantineBehavior === 'intermittent') {
    if (Math.random() < BYZANTINE_LATENCY.intermittent.dropRate) {
      return -1; // Signal to drop message
    }
    config = {
      ...config,
      min: config.min * BYZANTINE_LATENCY.intermittent.delayMultiplier,
      max: config.max * BYZANTINE_LATENCY.intermittent.delayMultiplier
    };
  }
  
  let latency = 0;
  
  switch (config.distribution) {
    case 'fixed':
      latency = config.min;
      break;
      
    case 'uniform':
      latency = config.min + Math.random() * (config.max - config.min);
      break;
      
    case 'normal':
      latency = generateNormalDistribution(config.mean || (config.min + config.max) / 2, 
                                         config.stddev || (config.max - config.min) / 4);
      latency = Math.max(config.min, Math.min(config.max, latency));
      break;
      
    case 'exponential':
      latency = -Math.log(1 - Math.random()) / config.lambda;
      latency = Math.max(config.min, Math.min(config.max, latency));
      break;
  }
  
  // Apply node-specific multiplier
  if (fromNode && toNode) {
    const pairKey = `${fromNode}-${toNode}`;
    const reversePairKey = `${toNode}-${fromNode}`;
    const multiplier = NODE_LATENCY_MATRIX[pairKey]?.multiplier || 
                      NODE_LATENCY_MATRIX[reversePairKey]?.multiplier || 1.0;
    latency *= multiplier;
  }
  
  return Math.round(latency);
}

// Box-Muller transform for normal distribution
function generateNormalDistribution(mean, stddev) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  return mean + stddev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Simulate network jitter (variation in latency)
function addJitter(baseLatency, jitterPercent = 10) {
  const jitter = baseLatency * (jitterPercent / 100) * (Math.random() - 0.5) * 2;
  return Math.max(0, Math.round(baseLatency + jitter));
}

// Get current latency statistics
function getLatencyStats() {
  return {
    profile: currentProfile,
    config: getLatencyConfig(),
    customConfig: customConfig
  };
}

module.exports = {
  LATENCY_PROFILES,
  setLatencyProfile,
  getLatencyConfig,
  generateLatency,
  addJitter,
  getLatencyStats,
  BYZANTINE_LATENCY
};