// Brick Kilns Monitoring Dashboard - J&K PCB
// Fetches data from GitHub-hosted JSON file (Recommended for hosting)

// GitHub raw JSON file URL
// const DATA_URL = 'https://raw.githubusercontent.com/geoin-git/brick-kilns-dashboard/main/data/kilns.json';
   const DATA_URL = 'https://raw.githubusercontent.com/geoin-git/brick-kilns-dashboard/main/kilns.json';
let map;
let markersLayer;
let allData = [];

// Map tile layers
const tileLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'),
    esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}')
};

// Initialize map
function init() {
    map = L.map('map').setView([33.8, 74.8], 8);
    tileLayers.osm.addTo(map);
    
    markersLayer = L.layerGroup().addTo(map);

    // Map type change handler
    document.getElementById('mapType').addEventListener('change', function(e) {
        map.eachLayer(function(layer) {
            if (layer !== markersLayer && layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        tileLayers[e.target.value].addTo(map);
    });

    // Search input handler
    document.getElementById('searchInput').addEventListener('input', debounce(filterData, 300));

    // Load data
    loadData();
}

// Fetch and load data from GitHub
async function loadData() {
    const btn = document.getElementById('refreshBtn');
    const origText = btn.innerHTML;
    btn.innerHTML = 'Loading...';
    btn.disabled = true;
    updateStatus('Fetching data...');

    try {
        // Add cache-busting parameter
        const url = DATA_URL + '?t=' + Date.now();
        
        console.log('Fetching from GitHub:', url);
        
        // Use mode: 'cors' explicitly and remove custom headers that might cause preflight
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('File not found. Please check if kilns.json exists in the data folder.');
            }
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format - expected array. Got: ' + typeof data);
        }

        allData = data;
        console.log('Loaded ' + allData.length + ' kilns');

        if (allData.length === 0) {
            updateStatus('No data found');
        } else {
            displayData(allData);
            updateStatus('LIVE: ' + allData.length + ' kilns loaded');
        }

    } catch (error) {
        console.error('Error loading data:', error);
        console.error('URL attempted:', DATA_URL);
        updateStatus('Failed to load data: ' + error.message);
        
        // Show helpful error message
        if (error.message.includes('404') || error.message.includes('not found')) {
            alert('Error: JSON file not found.\n\nPlease verify:\n1. File exists at: ' + DATA_URL + '\n2. File is named: kilns.json\n3. File is in the data/ folder\n4. Repository is public');
        }
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

// Get status from validity field
function getStatus(validity) {
    if (!validity || validity.trim() === '') {
        return 'processing';
    }

    const v = validity.toLowerCase().trim();

    if (v === 'valid') {
        return 'valid';
    }
    if (v === 'not valid' || v === 'notvalid' || v === 'not_valid') {
        return 'expired';
    }
    if (v === 'under process' || v === 'underprocess' || v === 'under_process') {
        return 'processing';
    }

    // Try to parse as date
    const date = new Date(validity);
    if (!isNaN(date.getTime())) {
        const today = new Date('2025-11-09');
        return date >= today ? 'valid' : 'expired';
    }

    return 'processing';
}

// Display data on map
function displayData(data) {
    markersLayer.clearLayers();

    let validCount = 0;
    let expiredCount = 0;
    let processingCount = 0;
    const markerArray = [];

    for (let i = 0; i < data.length; i++) {
        const kiln = data[i];
        const status = getStatus(kiln.validity);
        
        // Update counters
        if (status === 'valid') {
            validCount++;
        } else if (status === 'expired') {
            expiredCount++;
        } else {
            processingCount++;
        }

        // Color based on status
        const color = status === 'valid' ? '#10b981' : 
                     status === 'expired' ? '#ef4444' : '#f59e0b';

        // Create marker
        const marker = L.circleMarker([kiln.lat, kiln.lng], {
            radius: 7,
            fillColor: color,
            color: '#fff',
            weight: 2,
            fillOpacity: 0.9
        });

        // Popup content
        marker.bindPopup(createPopup(kiln, status));

        // Click handler for sidebar
        marker.on('click', function() {
            document.getElementById('kilnInfo').innerHTML = createPopup(kiln, status, true);
        });

        marker.addTo(markersLayer);
        markerArray.push(marker);
    }

    // Update statistics
    document.getElementById('total').textContent = data.length;
    document.getElementById('valid').textContent = validCount;
    document.getElementById('expired').textContent = expiredCount;
    document.getElementById('processing').textContent = processingCount;

    // Fit map to show all markers
    if (markerArray.length > 0) {
        const group = new L.featureGroup(markerArray);
        map.fitBounds(group.getBounds().pad(0.15));
    }
}

// Create popup HTML
function createPopup(kiln, status, sidebar) {
    const statusLabel = status === 'valid' ? 'Valid' : 
                       status === 'expired' ? 'Expired' : 'Processing';
    const statusColor = status === 'valid' ? '#10b981' : 
                       status === 'expired' ? '#ef4444' : '#f59e0b';

    return '<div style="font-family:system-ui;' + (sidebar ? 'font-size:0.9rem;' : '') + '">' +
        '<h3 style="margin:0 0 6px;color:#111">' + kiln.name + '</h3>' +
        '<p style="margin:3px 0"><b>Date of CTO:</b> ' + (kiln.dateCTO || '—') + '</p>' +
        '<p style="margin:3px 0"><b>Valid Till:</b> ' + (kiln.validity || '—') + '</p>' +
        '<p style="margin:8px 0"><b>Status:</b> ' +
        '<span style="background:' + statusColor + ';color:#fff;padding:4px 10px;border-radius:20px;font-weight:600">' +
        statusLabel + '</span></p>' +
        '<p style="margin:3px 0;color:#666;font-size:0.85rem">' +
        kiln.lat.toFixed(5) + ', ' + kiln.lng.toFixed(5) + '</p>' +
        '</div>';
}

// Filter data by search query
function filterData() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!query) {
        displayData(allData);
        return;
    }

    const filtered = allData.filter(function(kiln) {
        return kiln.name.toLowerCase().includes(query);
    });

    displayData(filtered);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

// Update status message
function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

// Auto-refresh every 10 minutes
setInterval(function() {
    if (document.visibilityState === 'visible') {
        loadData();
    }
}, 600000);

// Initialize on page load
window.addEventListener('load', init);


