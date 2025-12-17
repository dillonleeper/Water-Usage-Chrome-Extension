// Energy and water consumption data (kWh per action and gallons per kWh)
const WATER_PER_KWH = 2; // gallons of water per kWh

const ENERGY_DATA = {
  // AI Services
  'chatgpt.com': { energy: 0.00034, type: 'query', name: 'ChatGPT' },
  'openai.com': { energy: 0.00034, type: 'query', name: 'OpenAI' },
  'gemini.google.com': { energy: 0.00024, type: 'query', name: 'Google Gemini' },
  'bard.google.com': { energy: 0.00024, type: 'query', name: 'Google Bard' },
  'claude.ai': { energy: 0.0003, type: 'query', name: 'Claude AI' },
  'copilot.microsoft.com': { energy: 0.0003, type: 'query', name: 'Microsoft Copilot' },
  
  // Search Engines
  'google.com': { energy: 0.0003, type: 'search', name: 'Google Search' },
  'bing.com': { energy: 0.0003, type: 'search', name: 'Bing Search' },
  'yahoo.com': { energy: 0.0003, type: 'search', name: 'Yahoo Search' },
  'duckduckgo.com': { energy: 0.0003, type: 'search', name: 'DuckDuckGo' },
  
  // Video Streaming
  'youtube.com': { energy: 0.00013, type: 'minute', name: 'YouTube' }, // 0.08 kWh per hour
  'netflix.com': { energy: 0.0015, type: 'minute', name: 'Netflix' }, // 0.09 kWh per hour
  'twitch.tv': { energy: 0.0013, type: 'minute', name: 'Twitch' },
  'vimeo.com': { energy: 0.0013, type: 'minute', name: 'Vimeo' },
  'hulu.com': { energy: 0.0015, type: 'minute', name: 'Hulu' },
  'disneyplus.com': { energy: 0.0015, type: 'minute', name: 'Disney+' },
  'primevideo.com': { energy: 0.0015, type: 'minute', name: 'Prime Video' },
  
  // Social Media
  'facebook.com': { energy: 0.00005, type: 'minute', name: 'Facebook' },
  'instagram.com': { energy: 0.00004, type: 'minute', name: 'Instagram' },
  'twitter.com': { energy: 0.00004, type: 'minute', name: 'Twitter/X' },
  'x.com': { energy: 0.00004, type: 'minute', name: 'X' },
  'linkedin.com': { energy: 0.00004, type: 'minute', name: 'LinkedIn' },
  'tiktok.com': { energy: 0.00006, type: 'minute', name: 'TikTok' },
  'reddit.com': { energy: 0.00003, type: 'minute', name: 'Reddit' },
  'pinterest.com': { energy: 0.00004, type: 'minute', name: 'Pinterest' },
  
  // Email
  'gmail.com': { energy: 0.0001, type: 'action', name: 'Gmail' },
  'outlook.com': { energy: 0.0001, type: 'action', name: 'Outlook' },
  'mail.yahoo.com': { energy: 0.0001, type: 'action', name: 'Yahoo Mail' },
  
  // Default for unknown sites
  'default': { energy: 0.0003, type: 'visit', name: 'Website' }
};

// Storage keys
const STORAGE_KEYS = {
  TOTAL_ENERGY: 'totalEnergy',
  TOTAL_WATER: 'totalWater',
  SITE_DATA: 'siteData',
  SESSION_START: 'sessionStart',
  DAILY_DATA: 'dailyData'
};

// Track active tabs and their start times
let activeTabs = {};

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEYS.TOTAL_ENERGY, STORAGE_KEYS.TOTAL_WATER, STORAGE_KEYS.SITE_DATA], (result) => {
    if (!result[STORAGE_KEYS.TOTAL_ENERGY]) {
      chrome.storage.local.set({
        [STORAGE_KEYS.TOTAL_ENERGY]: 0,
        [STORAGE_KEYS.TOTAL_WATER]: 0,
        [STORAGE_KEYS.SITE_DATA]: {},
        [STORAGE_KEYS.SESSION_START]: Date.now(),
        [STORAGE_KEYS.DAILY_DATA]: []
      });
    }
  });
});

// Get domain from URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Get energy data for a domain
function getEnergyData(domain) {
  // Check for exact match
  if (ENERGY_DATA[domain]) {
    return ENERGY_DATA[domain];
  }
  
  // Check for partial match (e.g., mail.google.com -> google.com)
  for (let key in ENERGY_DATA) {
    if (domain.includes(key) || key.includes(domain)) {
      return ENERGY_DATA[key];
    }
  }
  
  return ENERGY_DATA['default'];
}

// Calculate and update usage
function updateUsage(domain, duration = 1) {
  const energyData = getEnergyData(domain);
  let energyUsed = 0;
  
  // Calculate energy based on type
  if (energyData.type === 'minute') {
    energyUsed = energyData.energy * duration;
  } else {
    energyUsed = energyData.energy;
  }
  
  const waterUsed = energyUsed * WATER_PER_KWH;
  
  // Update storage
  chrome.storage.local.get([STORAGE_KEYS.TOTAL_ENERGY, STORAGE_KEYS.TOTAL_WATER, STORAGE_KEYS.SITE_DATA], (result) => {
    const newTotalEnergy = (result[STORAGE_KEYS.TOTAL_ENERGY] || 0) + energyUsed;
    const newTotalWater = (result[STORAGE_KEYS.TOTAL_WATER] || 0) + waterUsed;
    const siteData = result[STORAGE_KEYS.SITE_DATA] || {};
    
    // Update site-specific data
    if (!siteData[domain]) {
      siteData[domain] = {
        name: energyData.name,
        energy: 0,
        water: 0,
        visits: 0,
        duration: 0
      };
    }
    
    siteData[domain].energy += energyUsed;
    siteData[domain].water += waterUsed;
    siteData[domain].visits += 1;
    siteData[domain].duration += duration;
    
    chrome.storage.local.set({
      [STORAGE_KEYS.TOTAL_ENERGY]: newTotalEnergy,
      [STORAGE_KEYS.TOTAL_WATER]: newTotalWater,
      [STORAGE_KEYS.SITE_DATA]: siteData
    });
  });
}

// Track tab navigation
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    const domain = getDomain(details.url);
    if (domain) {
      activeTabs[details.tabId] = {
        domain: domain,
        startTime: Date.now()
      };
      
      // Record initial visit
      updateUsage(domain, 0);
    }
  }
});

// Track tab activation (switching between tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      const domain = getDomain(tab.url);
      if (domain) {
        activeTabs[activeInfo.tabId] = {
          domain: domain,
          startTime: Date.now()
        };
      }
    }
  });
});

// Track time spent on tabs (update every minute)
setInterval(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const tab = tabs[0];
      const tabData = activeTabs[tab.id];
      
      if (tabData) {
        const now = Date.now();
        const duration = (now - tabData.startTime) / 60000; // Convert to minutes
        
        if (duration >= 1) {
          updateUsage(tabData.domain, 1);
          activeTabs[tab.id].startTime = now;
        }
      }
    }
  });
}, 60000); // Check every minute

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  delete activeTabs[tabId];
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getData') {
    chrome.storage.local.get([
      STORAGE_KEYS.TOTAL_ENERGY,
      STORAGE_KEYS.TOTAL_WATER,
      STORAGE_KEYS.SITE_DATA,
      STORAGE_KEYS.SESSION_START
    ], (result) => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'resetData') {
    chrome.storage.local.set({
      [STORAGE_KEYS.TOTAL_ENERGY]: 0,
      [STORAGE_KEYS.TOTAL_WATER]: 0,
      [STORAGE_KEYS.SITE_DATA]: {},
      [STORAGE_KEYS.SESSION_START]: Date.now()
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
