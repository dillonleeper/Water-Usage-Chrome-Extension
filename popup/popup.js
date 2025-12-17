// Format numbers with appropriate precision
function formatNumber(num, decimals = 2) {
  return num.toFixed(decimals);
}

// Format water comparison text
function getWaterComparison(gallons) {
  if (gallons < 0.01) {
    return "Less than a teaspoon of water";
  } else if (gallons < 0.1) {
    return `${Math.round(gallons * 768)} teaspoons of water`;
  } else if (gallons < 1) {
    return `${Math.round(gallons * 16)} tablespoons of water`;
  } else if (gallons < 8) {
    return `${formatNumber(gallons * 16, 1)} cups of water`;
  } else if (gallons < 128) {
    return `${Math.round(gallons)} water bottles (16.9 oz)`;
  } else if (gallons < 500) {
    return `${formatNumber(gallons / 128, 1)} bathtubs of water`;
  } else {
    return `${formatNumber(gallons / 660, 1)} swimming pools of water`;
  }
}

// Format time ago
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Update the display
function updateDisplay(data) {
  const totalWater = data.totalWater || 0;
  const totalEnergy = data.totalEnergy || 0;
  const siteData = data.siteData || {};
  const sessionStart = data.sessionStart || Date.now();
  
  // Update main stats
  document.getElementById('totalWater').textContent = formatNumber(totalWater, 3);
  document.getElementById('totalEnergy').textContent = formatNumber(totalEnergy, 4);
  
  // Update comparison
  document.getElementById('comparisonText').textContent = getWaterComparison(totalWater);
  
  // Update session start
  document.getElementById('sessionStart').textContent = formatTimeAgo(sessionStart);
  
  // Update activity list
  const activityList = document.getElementById('activityList');
  
  // Convert site data to array and sort by water usage
  const sites = Object.entries(siteData)
    .map(([domain, data]) => ({
      domain,
      ...data
    }))
    .sort((a, b) => b.water - a.water);
  
  if (sites.length === 0) {
    activityList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Start browsing to see your water usage!</p>
      </div>
    `;
  } else {
    activityList.innerHTML = sites.map(site => `
      <div class="activity-item">
        <div class="activity-info">
          <div class="activity-name">${site.name}</div>
          <div class="activity-stats">${site.visits} visit${site.visits > 1 ? 's' : ''} • ${formatNumber(site.energy, 4)} kWh</div>
        </div>
        <div class="activity-water">
          ${formatNumber(site.water, 3)}
          <div class="activity-water-label">gallons</div>
        </div>
      </div>
    `).join('');
  }
}

// Load and display data
function loadData() {
  chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
    updateDisplay(response);
  });
}

// Export data as JSON
function exportData() {
  chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
    const dataStr = JSON.stringify(response, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `water-usage-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
}

// Reset data
function resetData() {
  if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
    chrome.runtime.sendMessage({ action: 'resetData' }, (response) => {
      if (response.success) {
        loadData();
      }
    });
  }
}

// Event listeners
document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('resetBtn').addEventListener('click', resetData);

// Load data on popup open
loadData();

// Refresh data every 5 seconds
setInterval(loadData, 5000);
