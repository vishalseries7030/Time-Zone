/**
 * Timezone Information Retrieval Application
 * Uses Geoapify API for geocoding and timezone data
 */

// Configuration object
const CONFIG = {
    // Geoapify API Key (Sign up and get your own)
    API_KEY: '38d7a9f23bfc4a99b55de7395c4f****',
    BASE_URL: 'https://api.geoapify.com/v1/geocode',
    FALLBACK_TIMEZONE_API: 'http://worldtimeapi.org/api/timezone',
    REQUEST_TIMEOUT: 10000, // 10 seconds
    MIN_ADDRESS_LENGTH: 3
};


// Application state
const AppState = {
    currentLocation: null,
    isSearching: false,
    locationPermissionGranted: false
};

// DOM element references
const DOM = {
    locationStatus: document.getElementById('locationStatus'),
    statusIndicator: document.getElementById('statusIndicator'),
    currentTimezoneDisplay: document.getElementById('currentTimezoneDisplay'),
    addressInput: document.getElementById('addressInput'),
    searchButton: document.getElementById('searchButton'),
    buttonText: document.querySelector('.button-text'),
    buttonLoader: document.querySelector('.button-loader'),
    addressTimezoneDisplay: document.getElementById('addressTimezoneDisplay'),
    errorMessage: document.getElementById('errorMessage')
};

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌍 Timezone Information App - Starting...');
    
    // Check if API key needs to be configured
    if (CONFIG.API_KEY === 'YOUR_GEOAPIFY_API_KEY_HERE') {
        console.warn('⚠️ Please replace YOUR_GEOAPIFY_API_KEY_HERE with your actual Geoapify API key.');
        console.info('📋 Get your free API key from: https://www.geoapify.com/get-started-with-maps-api/');
        console.info('🔄 Using fallback timezone detection for current location...');
    }
    
    initializeApp();
});

/**
 * Initialize application components
 */
function initializeApp() {
    setupEventListeners();
    getCurrentUserLocation();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Address input enter key support
    DOM.addressInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !AppState.isSearching) {
            event.preventDefault();
            handleAddressSearch();
        }
    });
    
    // Search button click
    DOM.searchButton.addEventListener('click', handleAddressSearch);
    
    // Clear error messages when user starts typing
    DOM.addressInput.addEventListener('input', function() {
        hideErrorMessage();
        if (DOM.addressTimezoneDisplay.style.display !== 'none') {
            DOM.addressTimezoneDisplay.style.display = 'none';
        }
    });
}

/**
 * Get user's current location using Geolocation API
 */
function getCurrentUserLocation() {
    updateLocationStatus('loading', 'Requesting location permission...');
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
        updateLocationStatus('error', 'Geolocation is not supported by your browser');
        showCurrentLocationError('Your browser does not support location detection. Please search by address instead.');
        return;
    }
    
    const geoOptions = {
        enableHighAccuracy: true,
        timeout: CONFIG.REQUEST_TIMEOUT,
        maximumAge: 300000 // Cache for 5 minutes
    };
    
    navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        onLocationError,
        geoOptions
    );
}

/**
 * Handle successful location retrieval
 */
function onLocationSuccess(position) {
    console.log('📍 Location detected:', position.coords);
    
    AppState.locationPermissionGranted = true;
    updateLocationStatus('loading', 'Getting timezone information...');
    
    const { latitude, longitude, accuracy } = position.coords;
    
    // Check if we have a valid API key, otherwise use fallback method
    if (CONFIG.API_KEY === 'YOUR_GEOAPIFY_API_KEY_HERE') {
        console.info('🔄 Using browser timezone detection as fallback...');
        displayCurrentTimezoneWithFallback(latitude, longitude, accuracy);
    } else {
        fetchTimezoneData(latitude, longitude)
            .then(data => {
                AppState.currentLocation = {
                    ...data,
                    coordinates: { lat: latitude, lon: longitude },
                    accuracy: accuracy
                };
                
                displayCurrentTimezone(AppState.currentLocation);
                updateLocationStatus('success', 'Location detected successfully');
            })
            .catch(error => {
                console.error('❌ Error fetching timezone for current location:', error);
                
                // Fallback to browser timezone if API fails
                if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                    console.info('🔄 API key issue detected, using browser timezone as fallback...');
                    displayCurrentTimezoneWithFallback(latitude, longitude, accuracy);
                } else {
                    updateLocationStatus('error', 'Failed to get timezone information');
                    showCurrentLocationError(error.message);
                }
            });
    }
}

/**
 * Handle location retrieval errors
 */
function onLocationError(error) {
    console.error('❌ Geolocation error:', error);
    
    let errorMessage = '';
    let statusMessage = '';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            statusMessage = 'Location access denied';
            errorMessage = 'Location access was denied. Please enable location permission or search by address.';
            break;
        case error.POSITION_UNAVAILABLE:
            statusMessage = 'Location unavailable';
            errorMessage = 'Your location could not be determined. Please check your GPS settings or search by address.';
            break;
        case error.TIMEOUT:
            statusMessage = 'Location request timed out';
            errorMessage = 'Location request timed out. Please try again or search by address.';
            break;
        default:
            statusMessage = 'Location error occurred';
            errorMessage = 'An unknown error occurred while detecting your location. Please search by address.';
            break;
    }
    
    updateLocationStatus('error', statusMessage);
    showCurrentLocationError(errorMessage);
}

/**
 * Fetch timezone data using coordinates
 */
async function fetchTimezoneData(latitude, longitude) {
    const url = `${CONFIG.BASE_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json&apiKey=${CONFIG.API_KEY}`;
    
    console.log('🔄 Fetching timezone data for:', { latitude, longitude });
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error('No timezone information found for these coordinates');
        }
        
        console.log('✅ Timezone data retrieved successfully');
        return data.results[0];
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your internet connection and try again.');
        }
        
        console.error('❌ API Error:', error);
        throw new Error(error.message || 'Failed to retrieve timezone information');
    }
}

/**
 * Fetch timezone data using address
 */
async function fetchTimezoneByAddress(address) {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `${CONFIG.BASE_URL}/search?text=${encodedAddress}&format=json&apiKey=${CONFIG.API_KEY}`;
    
    console.log('🔍 Searching timezone for address:', address);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error('Address not found. Please check the spelling and try with a more complete address.');
        }
        
        console.log('✅ Address timezone data retrieved successfully');
        
        const result = data.results[0];
        return {
            ...result,
            coordinates: { lat: result.lat, lon: result.lon }
        };
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your internet connection and try again.');
        }
        
        console.error('❌ Address API Error:', error);
        throw new Error(error.message || 'Failed to find timezone information for this address');
    }
}

/**
 * Handle address search
 */
async function handleAddressSearch() {
    const address = DOM.addressInput.value.trim();
    
    // Validate input
    if (!address) {
        showErrorMessage('Please enter an address to search for timezone information.');
        DOM.addressInput.focus();
        return;
    }
    
    if (address.length < CONFIG.MIN_ADDRESS_LENGTH) {
        showErrorMessage(`Please enter at least ${CONFIG.MIN_ADDRESS_LENGTH} characters for the address.`);
        DOM.addressInput.focus();
        return;
    }
    
    if (AppState.isSearching) {
        return;
    }
    
    // Check if API key is configured
    if (CONFIG.API_KEY === 'YOUR_GEOAPIFY_API_KEY_HERE') {
        showErrorMessage('⚠️ API key not configured. Please add your Geoapify API key to use address search functionality.');
        return;
    }
    
    setSearchingState(true);
    
    try {
        const timezoneData = await fetchTimezoneByAddress(address);
        displayAddressTimezone(timezoneData);
        showSuccessMessage('Timezone information retrieved successfully!');
        
    } catch (error) {
        console.error('❌ Address search failed:', error);
        
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            showErrorMessage('❌ API authentication failed. Please check your Geoapify API key configuration.');
        } else {
            showErrorMessage(error.message);
        }
        
    } finally {
        setSearchingState(false);
    }
}

/**
 * Display current location timezone information
 */
function displayCurrentTimezone(locationData) {
    const timezoneInfo = createTimezoneInfoHTML(locationData, true);
    DOM.currentTimezoneDisplay.innerHTML = timezoneInfo;
}

/**
 * Display address timezone information
 */
function displayAddressTimezone(locationData) {
    const timezoneInfo = createTimezoneInfoHTML(locationData, false);
    DOM.addressTimezoneDisplay.innerHTML = timezoneInfo;
    DOM.addressTimezoneDisplay.style.display = 'block';
}

/**
 * Create timezone information HTML
 */
function createTimezoneInfoHTML(locationData, isCurrentLocation) {
    const timezone = locationData.timezone || {};
    const coordinates = locationData.coordinates || { lat: locationData.lat, lon: locationData.lon };
    
    // Get local time for the timezone
    const localTime = getLocalTimeForTimezone(timezone.name);
    
    const accuracyInfo = isCurrentLocation && locationData.accuracy 
        ? `<br><small>GPS Accuracy: ±${Math.round(locationData.accuracy)} meters</small>` 
        : '';
    
    return `
        <div class="timezone-info">
            <div class="timezone-header">
                <div class="timezone-title">
                    ${isCurrentLocation ? 'Your Current Location' : 'Search Result'}
                </div>
                <div class="timezone-location">
                    📍 ${locationData.formatted || 'Location information unavailable'}
                    ${accuracyInfo}
                </div>
            </div>
            
            <div class="timezone-details">
                <div class="detail-item">
                    <div class="detail-label">Current Local Time</div>
                    <div class="detail-value">${localTime}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Timezone Name</div>
                    <div class="detail-value">${timezone.name || 'Unknown'}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">UTC Offset (Standard)</div>
                    <div class="detail-value">${timezone.offset_STD || 'Unknown'}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">UTC Offset (Daylight)</div>
                    <div class="detail-value">${timezone.offset_DST || 'N/A'}</div>
                </div>
            </div>
            
            <div class="coordinates-info">
                <div class="coordinates-title">📍 Geographic Coordinates</div>
                <div class="coordinates-text">
                    Latitude: ${coordinates.lat.toFixed(6)}°<br>
                    Longitude: ${coordinates.lon.toFixed(6)}°
                </div>
            </div>
        </div>
    `;
}

/**
 * Get formatted local time for a timezone
 */
function getLocalTimeForTimezone(timezoneName) {
    if (!timezoneName) {
        return 'Unknown';
    }
    
    try {
        return new Date().toLocaleString('en-US', {
            timeZone: timezoneName,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    } catch (error) {
        console.error('❌ Error formatting time:', error);
        return 'Time formatting error';
    }
}

/**
 * Update location status indicator
 */
function updateLocationStatus(status, message) {
    DOM.statusIndicator.className = `status-indicator ${status}`;
    DOM.locationStatus.textContent = message;
}

/**
 * Set searching state for address search
 */
function setSearchingState(isSearching) {
    AppState.isSearching = isSearching;
    DOM.searchButton.disabled = isSearching;
    
    if (isSearching) {
        DOM.buttonText.style.display = 'none';
        DOM.buttonLoader.style.display = 'block';
    } else {
        DOM.buttonText.style.display = 'block';
        DOM.buttonLoader.style.display = 'none';
    }
}

/**
 * Show error message for current location
 */
function showCurrentLocationError(message) {
    DOM.currentTimezoneDisplay.innerHTML = `
        <div class="error-message">
            <span class="error-icon">⚠️</span>
            <div>
                <strong>Location Detection Failed</strong><br>
                ${message}
            </div>
        </div>
    `;
}

/**
 * Show error message for address search
 */
function showErrorMessage(message) {
    DOM.errorMessage.innerHTML = `
        <span class="error-icon">❌</span>
        <div>
            <strong>Search Error</strong><br>
            ${message}
        </div>
    `;
    DOM.errorMessage.style.display = 'flex';
    DOM.addressTimezoneDisplay.style.display = 'none';
}

/**
 * Hide error message
 */
function hideErrorMessage() {
    DOM.errorMessage.style.display = 'none';
}

/**
 * Display current timezone with fallback method (when API key is not available)
 */
function displayCurrentTimezoneWithFallback(latitude, longitude, accuracy) {
    // Use browser's timezone detection
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentTime = new Date();
    
    // Get timezone offset information
    const offsetMinutes = currentTime.getTimezoneOffset();
    const offsetHours = Math.abs(offsetMinutes / 60);
    const offsetSign = offsetMinutes <= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(Math.floor(offsetHours)).padStart(2, '0')}:${String(Math.abs(offsetMinutes % 60)).padStart(2, '0')}`;
    
    // Create fallback location data
    const fallbackData = {
        timezone: {
            name: browserTimezone,
            offset_STD: offsetString,
            offset_DST: 'Detected by browser'
        },
        formatted: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        coordinates: { lat: latitude, lon: longitude },
        accuracy: accuracy
    };
    
    AppState.currentLocation = fallbackData;
    displayCurrentTimezone(fallbackData);
    updateLocationStatus('success', 'Location detected (using browser timezone)');
    
    console.info('✅ Using browser timezone detection as fallback');
}
function showSuccessMessage(message) {
    // Create temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
        <span class="success-icon">✅</span>
        <div>${message}</div>
    `;
    
    // Insert before address timezone display
    DOM.addressTimezoneDisplay.parentNode.insertBefore(successDiv, DOM.addressTimezoneDisplay);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// Export functions for potential testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        fetchTimezoneData,
        fetchTimezoneByAddress,
        getLocalTimeForTimezone
    };
}