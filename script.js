// Brick Kilns Monitoring Dashboard - J&K PCB - Advanced Version
// Fetches data from GitHub-hosted JSON file (Recommended for hosting)

// GitHub raw JSON file URL
const DATA_URL = 'https://raw.githubusercontent.com/geoin-git/brick-kilns-dashboard/kilns.json';
//const DATA_URL = 'kilns.json';

let map;
let markersLayer;
let allData = [];
let filteredData = [];
let markerClusterGroup;
let heatmapLayer;
let currentFilters = {
    status: 'all',
    search: '',
    dateFrom: '',
    dateTo: ''
};

// Map tile layers
const tileLayers = {
    googleStreet: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { attribution: '© Google' }),
    openstreet: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }),
    //googleStreet: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { attribution: '© Google' }),
    googleMap: L.tileLayer('https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', { attribution: '© Google' }),
    googleSatellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { attribution: '© Google' })
};

// Chart.js configuration
let statusChart = null;
let monthlyChart = null;

// Initialize map
function init() {
    map = L.map('map').setView([33.8, 74.8], 8);
    tileLayers.openstreet.addTo(map);
    
    markersLayer = L.layerGroup().addTo(map);
    
    // Initialize marker clustering (if library is available)
    if (typeof L.markerClusterGroup !== 'undefined') {
        markerClusterGroup = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });
    } else {
        console.warn('Marker clustering library not loaded, using standard markers');
        markerClusterGroup = markersLayer;
    }

    // Map type change handler
    document.getElementById('mapType').addEventListener('change', function(e) {
        map.eachLayer(function(layer) {
            if (layer !== markersLayer && layer !== markerClusterGroup && layer !== heatmapLayer && layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        tileLayers[e.target.value].addTo(map);
    });

    // Search input handler
    document.getElementById('searchInput').addEventListener('input', debounce(function() {
        currentFilters.search = document.getElementById('searchInput').value;
        applyFilters();
    }, 300));

    // Status filter handler
    document.getElementById('statusFilter').addEventListener('change', function(e) {
        currentFilters.status = e.target.value;
        applyFilters();
    });

    // Date filter handlers
    document.getElementById('dateFrom').addEventListener('change', function(e) {
        currentFilters.dateFrom = e.target.value;
        applyFilters();
    });

    document.getElementById('dateTo').addEventListener('change', function(e) {
        currentFilters.dateTo = e.target.value;
        applyFilters();
    });

    // View mode handlers
    document.getElementById('viewMode').addEventListener('change', function(e) {
        toggleViewMode(e.target.value);
    });

    // Export handlers
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);

    // Clear filters
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    // Load data
    loadData();
    
    // Initialize charts
    initCharts();
}

// Fetch and load data from GitHub
async function loadData() {
    const btn = document.getElementById('refreshBtn');
    const origText = btn.innerHTML;
    btn.innerHTML = 'Loading...';
    btn.disabled = true;
    updateStatus('Fetching data...');

    try {
        // Add cache-busting parameter only for remote URLs
        let url = DATA_URL;
        if (DATA_URL.startsWith('http://') || DATA_URL.startsWith('https://')) {
            url = DATA_URL + '?t=' + Date.now();
        }
        
        console.log('Fetching data from:', url);
        
        // For local files, use 'no-cors' or omit mode, for remote use 'cors'
        const fetchOptions = {
            method: 'GET',
            cache: 'no-cache'
        };
        
        // Only set mode for remote URLs
        if (DATA_URL.startsWith('http://') || DATA_URL.startsWith('https://')) {
            fetchOptions.mode = 'cors';
        }
        
        const response = await fetch(url, fetchOptions);

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

        // Normalize data structure - handle different field name formats
        allData = data.map(function(kiln) {
            // Normalize field names (handle both lowercase and capitalized versions)
            const normalized = {
                name: kiln.Name || kiln.name || '',
                // Handle coordinate swap - JSON has Latitude/Longitude but they appear swapped
                // Latitude in JSON (74.x) is actually longitude, Longitude (33.x) is actually latitude
                lat: kiln.Longitude !== undefined ? parseFloat(kiln.Longitude) : (kiln.lat !== undefined ? parseFloat(kiln.lat) : (kiln.Latitude !== undefined ? parseFloat(kiln.Latitude) : null)),
                lng: kiln.Latitude !== undefined ? parseFloat(kiln.Latitude) : (kiln.lng !== undefined ? parseFloat(kiln.lng) : (kiln.Longitude !== undefined ? parseFloat(kiln.Longitude) : null)),
                dateCTO: kiln.Date_of_CTO || kiln.dateCTO || '',
                validity: kiln.Validity || kiln.validity || ''
            };
            
            // If coordinates are still swapped (lat > 70 means it's longitude), swap them
            if (normalized.lat && normalized.lng) {
                if (normalized.lat > 70 && normalized.lng < 50) {
                    // Swap coordinates
                    const temp = normalized.lat;
                    normalized.lat = normalized.lng;
                    normalized.lng = temp;
                }
            }
            
            return normalized;
        });
        console.log('Loaded ' + allData.length + ' kilns');
        
        // Log first record to check structure
        if (allData.length > 0) {
            console.log('First record sample (normalized):', allData[0]);
            console.log('Sample coordinates - lat:', allData[0].lat, 'lng:', allData[0].lng);
        }

        if (allData.length === 0) {
            updateStatus('No data found');
        } else {
            filteredData = allData;
            displayData(allData);
            updateStatus('LIVE: ' + allData.length + ' kilns loaded');
            updateCharts(allData);
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
    if (markerClusterGroup && markerClusterGroup.clearLayers) {
        markerClusterGroup.clearLayers();
    }
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }

    let validCount = 0;
    let expiredCount = 0;
    let processingCount = 0;
    const markerArray = [];
    const heatmapData = [];
    let skippedCount = 0;

    for (let i = 0; i < data.length; i++) {
        const kiln = data[i];
        
        // Check if kiln object exists and has required properties
        if (!kiln || typeof kiln !== 'object') {
            console.warn('Skipping invalid kiln object at index', i);
            skippedCount++;
            continue;
        }
        
        // Validate coordinates - check if they exist first
        if (kiln.lat === undefined || kiln.lat === null || kiln.lng === undefined || kiln.lng === null) {
            console.warn('Skipping kiln with undefined coordinates:', kiln.name || 'Unknown', 'lat:', kiln.lat, 'lng:', kiln.lng);
            skippedCount++;
            continue;
        }
        
        // Parse coordinates (already normalized, but ensure they're numbers)
        const lat = typeof kiln.lat === 'number' ? kiln.lat : parseFloat(kiln.lat);
        const lng = typeof kiln.lng === 'number' ? kiln.lng : parseFloat(kiln.lng);
        
        // Validate parsed coordinates
        if (isNaN(lat) || isNaN(lng)) {
            console.warn('Skipping kiln with invalid coordinates:', kiln.name || 'Unknown', 'lat:', kiln.lat, 'lng:', kiln.lng);
            skippedCount++;
            continue;
        }
        
        // Additional validation - ensure coordinates are within reasonable range
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            console.warn('Skipping kiln with out-of-range coordinates:', kiln.name || 'Unknown', 'lat:', lat, 'lng:', lng);
            skippedCount++;
            continue;
        }

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

        // Create marker with validated coordinates
        try {
            const marker = L.circleMarker([lat, lng], {
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

            // Add to cluster group or direct layer
            if (markerClusterGroup && markerClusterGroup.addLayer) {
                markerClusterGroup.addLayer(marker);
            } else {
                marker.addTo(markersLayer);
            }
            markerArray.push(marker);
            
            // Add to heatmap data
            heatmapData.push([lat, lng, 1]);
        } catch (error) {
            console.error('Error creating marker for:', kiln.name, error);
            skippedCount++;
        }
    }

    // Add cluster group to map
    if (markerArray.length > 0 && markerClusterGroup && markerClusterGroup.addLayer) {
        if (!map.hasLayer(markerClusterGroup)) {
            map.addLayer(markerClusterGroup);
        }
    }

    // Update statistics
    document.getElementById('total').textContent = data.length;
    document.getElementById('valid').textContent = validCount;
    document.getElementById('expired').textContent = expiredCount;
    document.getElementById('processing').textContent = processingCount;
    
    if (skippedCount > 0) {
        console.warn('Skipped ' + skippedCount + ' kilns with invalid coordinates');
        updateStatus('LIVE: ' + markerArray.length + ' kilns displayed (' + skippedCount + ' skipped)');
    }

    // Fit map to show all markers
    if (markerArray.length > 0) {
        const group = new L.featureGroup(markerArray);
        map.fitBounds(group.getBounds().pad(0.15));
    } else {
        console.error('No valid markers to display');
        updateStatus('No valid coordinates found');
    }
    
    // Update charts
    updateCharts(data);
}

// Create popup HTML
function createPopup(kiln, status, sidebar) {
    const statusLabel = status === 'valid' ? 'Valid' : 
                       status === 'expired' ? 'Expired' : 'Processing';
    const statusColor = status === 'valid' ? '#10b981' : 
                       status === 'expired' ? '#ef4444' : '#f59e0b';

    return '<div style="font-family:system-ui;' + (sidebar ? 'font-size:0.9rem;' : '') + '">' +
        '<h3 style="margin:0 0 6px;color:#111">' + (kiln.name || 'Unnamed Kiln') + '</h3>' +
        '<p style="margin:3px 0"><b>Date of CTO:</b> ' + (kiln.dateCTO || '—') + '</p>' +
        '<p style="margin:3px 0"><b>Valid Till:</b> ' + (kiln.validity || '—') + '</p>' +
        '<p style="margin:8px 0"><b>Status:</b> ' +
        '<span style="background:' + statusColor + ';color:#fff;padding:4px 10px;border-radius:20px;font-weight:600">' +
        statusLabel + '</span></p>' +
        '<p style="margin:3px 0;color:#666;font-size:0.85rem">' +
        'Coordinates: ' + (typeof kiln.lat === 'number' && !isNaN(kiln.lat) ? kiln.lat.toFixed(5) : kiln.lat) + ', ' + (typeof kiln.lng === 'number' && !isNaN(kiln.lng) ? kiln.lng.toFixed(5) : kiln.lng) + '</p>' +
        '</div>';
}

// Apply all filters
function applyFilters() {
    let filtered = allData.slice();

    // Status filter
    if (currentFilters.status !== 'all') {
        filtered = filtered.filter(function(kiln) {
            return getStatus(kiln.validity) === currentFilters.status;
        });
    }

    // Search filter
    if (currentFilters.search) {
        const query = currentFilters.search.toLowerCase().trim();
        filtered = filtered.filter(function(kiln) {
            const name = (kiln.name || '').toLowerCase();
            return name.includes(query);
        });
    }

    // Date range filter
    if (currentFilters.dateFrom || currentFilters.dateTo) {
        filtered = filtered.filter(function(kiln) {
            if (!kiln.dateCTO) return false;
            
            const ctoDate = parseDate(kiln.dateCTO);
            if (!ctoDate) return false;
            
            if (currentFilters.dateFrom) {
                const fromDate = new Date(currentFilters.dateFrom);
                if (ctoDate < fromDate) return false;
            }
            
            if (currentFilters.dateTo) {
                const toDate = new Date(currentFilters.dateTo);
                toDate.setHours(23, 59, 59, 999); // Include entire day
                if (ctoDate > toDate) return false;
            }
            
            return true;
        });
    }

    filteredData = filtered;
    displayData(filtered);
}

// Parse date from various formats
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Try DD-MM-YYYY format
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    
    // Try standard date parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date;
    }
    
    return null;
}

// Clear all filters
function clearFilters() {
    currentFilters = {
        status: 'all',
        search: '',
        dateFrom: '',
        dateTo: ''
    };
    
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    
    applyFilters();
}

// Toggle view mode (markers/heatmap)
function toggleViewMode(mode) {
    if (mode === 'heatmap') {
        // Show heatmap
        if (markerClusterGroup && map.hasLayer(markerClusterGroup)) {
            map.removeLayer(markerClusterGroup);
        }
        
        const heatmapData = filteredData
            .filter(k => k.lat && k.lng && !isNaN(parseFloat(k.lat)) && !isNaN(parseFloat(k.lng)))
            .map(k => [parseFloat(k.lat), parseFloat(k.lng), 1]);
        
        if (heatmapData.length > 0) {
            // Simple heatmap using circle markers with opacity
            heatmapLayer = L.layerGroup();
            heatmapData.forEach(function(point) {
                L.circleMarker([point[0], point[1]], {
                    radius: 15,
                    fillColor: '#ef4444',
                    color: '#ef4444',
                    weight: 0,
                    fillOpacity: 0.3
                }).addTo(heatmapLayer);
            });
            heatmapLayer.addTo(map);
        }
    } else {
        // Show markers
        if (heatmapLayer) {
            map.removeLayer(heatmapLayer);
            heatmapLayer = null;
        }
        if (markerClusterGroup && filteredData.length > 0 && !map.hasLayer(markerClusterGroup)) {
            map.addLayer(markerClusterGroup);
        }
    }
}

// Export to CSV
function exportToCSV() {
    if (filteredData.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = ['Name', 'Latitude', 'Longitude', 'Date of CTO', 'Valid Till', 'Status'];
    const rows = filteredData.map(function(kiln) {
        const status = getStatus(kiln.validity);
        const statusLabel = status === 'valid' ? 'Valid' : status === 'expired' ? 'Expired' : 'Processing';
        return [
            kiln.name || '',
            kiln.lat || '',
            kiln.lng || '',
            kiln.dateCTO || '',
            kiln.validity || '',
            statusLabel
        ];
    });
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `brick-kilns-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export to Excel
function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel export library not loaded');
        return;
    }
    
    if (filteredData.length === 0) {
        alert('No data to export');
        return;
    }
    
    const data = filteredData.map(function(kiln) {
        const status = getStatus(kiln.validity);
        const statusLabel = status === 'valid' ? 'Valid' : status === 'expired' ? 'Expired' : 'Processing';
        return {
            'Name': kiln.name || '',
            'Latitude': kiln.lat || '',
            'Longitude': kiln.lng || '',
            'Date of CTO': kiln.dateCTO || '',
            'Valid Till': kiln.validity || '',
            'Status': statusLabel
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Brick Kilns');
    XLSX.writeFile(wb, `brick-kilns-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Initialize charts
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library not loaded, charts will not be available');
        return;
    }
    
    const statusCtx = document.getElementById('statusChart');
    const monthlyCtx = document.getElementById('monthlyChart');
    
    if (statusCtx) {
        statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Valid', 'Expired', 'Processing'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    if (monthlyCtx) {
        monthlyChart = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Kilns',
                    data: [],
                    backgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Update charts with data
function updateCharts(data) {
    if (!statusChart && !monthlyChart) return;
    
    // Update status chart
    if (statusChart) {
        let validCount = 0, expiredCount = 0, processingCount = 0;
        data.forEach(function(kiln) {
            const status = getStatus(kiln.validity);
            if (status === 'valid') validCount++;
            else if (status === 'expired') expiredCount++;
            else processingCount++;
        });
        
        statusChart.data.datasets[0].data = [validCount, expiredCount, processingCount];
        statusChart.update();
    }
    
    // Update monthly chart
    if (monthlyChart) {
        const monthlyData = {};
        data.forEach(function(kiln) {
            if (kiln.dateCTO) {
                const date = parseDate(kiln.dateCTO);
                if (date) {
                    const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
                }
            }
        });
        
        const sortedMonths = Object.keys(monthlyData).sort();
        monthlyChart.data.labels = sortedMonths;
        monthlyChart.data.datasets[0].data = sortedMonths.map(m => monthlyData[m]);
        monthlyChart.update();
    }
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





