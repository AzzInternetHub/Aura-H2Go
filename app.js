/* ==========================================================================
   AURA H2GO - CLIENT APPLICATION & PWA CONTROLLER
   ========================================================================== */

/**
 * Global App State Variables
 * Holds fetched data and active cart values in memory for quick access.
 */
let appProducts = [];
let appLocations = [];
let selectedCart = {
    product: null,
    quantity: 1,
    locationFee: 0
};

/**
 * Event Listener: Waits until the DOM structure is fully loaded before launching the application core.
 */
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

/**
 * Primary Initialization Function
 * Triggers the PWA install handler and fetches inventory data.
 */
function initApp() {
    setupPWAInstallBanner();
    loadAppData();
}


/* ==========================================================================
   SECTION 1: VIEW ROUTER & SCREEN SWITCHING LOGIC
   ========================================================================== */

/**
 * Navigates between single-page app screens (Home, Checkout, and Success).
 * @param {string} screenName - 'home', 'order', or 'success'
 */
function showScreen(screenName) {
    // 1. Fetch screen elements from DOM
    const homeScreen = document.getElementById('screen-home');
    const orderScreen = document.getElementById('screen-order');
    const successScreen = document.getElementById('screen-success');

    // 2. Hide all screens by default
    if (homeScreen) homeScreen.classList.add('hidden');
    if (orderScreen) orderScreen.classList.add('hidden');
    if (successScreen) successScreen.classList.add('hidden');

    // 3. Un-hide target screen based on route requested
    if (screenName === 'home') {
        if (homeScreen) homeScreen.classList.remove('hidden');
    } else if (screenName === 'order') {
        if (orderScreen) orderScreen.classList.remove('hidden');
        
        // Fallback: If no item selected yet, pre-select first product in database
        if (!selectedCart.product && appProducts.length > 0) {
            selectedCart.product = appProducts[0];
        }
        updateSummary();
    } else if (screenName === 'success') {
        if (successScreen) successScreen.classList.remove('hidden');
    }
}


/* ==========================================================================
   SECTION 2: CORS-PROOF JSONP BACKEND DATA FETCHING
   ========================================================================== */

/**
 * Fetches menu products & delivery zones from Google Sheets Backend.
 * Uses local caching (LocalStorage) for instantaneous load speeds and Script Injection (JSONP) 
 * to completely bypass mobile web browser CORS blocks.
 */
function loadAppData() {
    // Phase A: Load offline cached data first for instant UI rendering
    const cachedProducts = localStorage.getItem('aura_products');
    const cachedLocations = localStorage.getItem('aura_locations');

    if (cachedProducts) {
        try {
            appProducts = JSON.parse(cachedProducts);
            renderProducts(appProducts);
        } catch (e) {
            console.error("Cache parsing error:", e);
        }
    }

    if (cachedLocations) {
        try {
            appLocations = JSON.parse(cachedLocations);
            renderLocations(appLocations);
        } catch (e) {
            console.error("Cache parsing error:", e);
        }
    }

    // Phase B: Fetch live update from Google Apps Script via JSONP
    const script = document.createElement('script');
    const callbackName = 'auraDataCallback_' + Date.now();
    
    // Safety network timeout handler (6 seconds)
    const fetchTimeout = setTimeout(() => {
        if (!cachedProducts || appProducts.length === 0) {
            showEmptyProductsState("No products found. Add products in Admin or check backend deployment.");
        }
    }, 6000);

    // Dynamic JSONP window callback function definition
    window[callbackName] = function(data) {
        clearTimeout(fetchTimeout);
        delete window[callbackName];
        document.body.removeChild(script); // Clean up DOM

        // Process Products
        if (data && data.products && data.products.length > 0) {
            appProducts = data.products;
            localStorage.setItem('aura_products', JSON.stringify(appProducts));
            renderProducts(appProducts);
        } else if (!cachedProducts || appProducts.length === 0) {
            showEmptyProductsState("No water items currently available.");
        }

        // Process Locations
        if (data && data.locations && data.locations.length > 0) {
            appLocations = data.locations;
            localStorage.setItem('aura_locations', JSON.stringify(appLocations));
            renderLocations(appLocations);
        }
    };

    // Inject Script into DOM to initiate fetch request without triggering CORS
    script.src = `${CONFIG.SCRIPT_URL}?action=getAppData&callback=${callbackName}&nocache=${Date.now()}`;
    script.onerror = function() {
        clearTimeout(fetchTimeout);
        if (!cachedProducts || appProducts.length === 0) {
            showEmptyProductsState("Unable to load menu. Check your connection or Apps Script URL.");
        }
    };

    document.body.appendChild(script);
}

/**
 * Renders empty placeholder UI when backend returns no inventory.
 */
function showEmptyProductsState(message) {
    const container = document.getElementById('products-container');
    if (container) {
        container.innerHTML = `
            <div class="p-6 text-center bg-slate-800/60 rounded-2xl border border-slate-700/60 my-4 shadow-inner">
                <i class="fa-solid fa-droplet-slash text-3xl text-sky-400/50 mb-2"></i>
                <p class="text-xs text-slate-300 font-medium">${message}</p>
            </div>
        `;
    }
}

/**
 * Builds and mounts HTML product card list onto screen.
 * @param {Array} products - Product items array
 */
function renderProducts(products) {
    const container = document.getElementById('products-container');
    if (!container) return;

    if (!products || products.length === 0) {
        showEmptyProductsState("No products available at the moment.");
        return;
    }

    container.innerHTML = products.map(prod => `
        <div class="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between shadow-md">
            <div class="flex items-center gap-3">
                ${prod.image ? `<img src="${prod.image}" alt="${prod.name}" class="w-12 h-12 rounded-xl object-cover border border-slate-700">` : `
                <div class="w-12 h-12 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-droplet"></i>
                </div>`}
                <div>
                    <h4 class="font-bold text-sm text-white">${prod.name}</h4>
                    <p class="text-[11px] text-slate-400 line-clamp-1">${prod.description || 'Clean, safe drinking water'}</p>
                    <span class="text-xs font-mono font-bold text-sky-400">GHS ${parseFloat(prod.price || 0).toFixed(2)}</span>
                </div>
            </div>
            <button onclick="addToCart('${prod.id}')" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-sky-600/20">
                + Add
            </button>
        </div>
    `).join('');
}

/**
 * Populates Campus Zone dropdown select menu with fees.
 * @param {Array} locations - Locations array from sheet
 */
function renderLocations(locations) {
    const select = document.getElementById('delivery-location');
    if (!select) return;

    select.innerHTML = `<option value="">Select Campus Zone / Hostel</option>` + 
        locations.map(loc => `
            <option value="${loc.name}" data-fee="${loc.fee}">
                ${loc.name} (+GHS ${parseFloat(loc.fee || 0).toFixed(2)})
            </option>
        `).join('');
}


/* ==========================================================================
   SECTION 3: CART CALCULATIONS & STATE MANAGEMENT
   ========================================================================== */

/**
 * Triggered when user clicks '+ Add' on a product item.
 * Sets selected item and transitions view to checkout.
 */
function addToCart(productId) {
    const product = appProducts.find(p => p.id === productId);
    if (product) {
        selectedCart.product = product;
        selectedCart.quantity = 1;
        showScreen('order');
    }
}

/**
 * Adjusts order quantity via stepper (+ / -).
 */
function adjustQty(amount) {
    let currentQty = selectedCart.quantity + amount;
    if (currentQty < 1) currentQty = 1; // Prevent zero or negative ordering
    selectedCart.quantity = currentQty;

    const qtyDisplay = document.getElementById('qty-count');
    if (qtyDisplay) qtyDisplay.innerText = currentQty;

    updateSummary();
}

/**
 * Recalculates subtotal, delivery fee, and grand total in real-time.
 */
function updateSummary() {
    if (!selectedCart.product) return;

    // Fetch delivery fee attached to selected zone
    const locSelect = document.getElementById('delivery-location');
    let deliveryFee = 0;

    if (locSelect && locSelect.selectedIndex > 0) {
        const selectedOption = locSelect.options[locSelect.selectedIndex];
        deliveryFee = parseFloat(selectedOption.getAttribute('data-fee') || 0);
    }
    selectedCart.locationFee = deliveryFee;

    // Financial calculations
    const itemPrice = parseFloat(selectedCart.product.price || 0);
    const subtotal = itemPrice * selectedCart.quantity;
    const total = subtotal + deliveryFee;

    // Update Checkout UI labels
    const prodNameEl = document.getElementById('sum-product-name');
    const subtotalEl = document.getElementById('sum-subtotal');
    const deliveryEl = document.getElementById('sum-delivery');
    const totalEl = document.getElementById('sum-total');

    if (prodNameEl) prodNameEl.innerText = `${selectedCart.product.name} (x${selectedCart.quantity})`;
    if (subtotalEl) subtotalEl.innerText = subtotal.toFixed(2);
    if (deliveryEl) deliveryEl.innerText = deliveryFee.toFixed(2);
    if (totalEl) totalEl.innerText = total.toFixed(2);
}


/* ==========================================================================
   SECTION 4: CHECKOUT SUBMISSION & DISPATCH PIPELINE
   ========================================================================== */

/**
 * Handles checkout form submission. Formats order metadata and fires background processors.
 */
function submitOrder(e) {
    e.preventDefault();

    // Extract input values
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const location = document.getElementById('delivery-location').value;
    const hall = document.getElementById('cust-hall').value;
    const room = document.getElementById('cust-room').value;
    const payment = document.getElementById('cust-payment').value;

    const itemPrice = parseFloat(selectedCart.product ? selectedCart.product.price : 0);
    const subtotal = itemPrice * selectedCart.quantity;
    const grandTotal = (subtotal + selectedCart.locationFee).toFixed(2);

    const orderRef = "ORD-" + Math.floor(1000 + Math.random() * 9000);

    // Package explicit key-value payload mapped to Apps Script columns
    const orderData = {
        orderId: orderRef,
        customerName: name,
        phone: phone,
        location: location,
        hall: hall,
        room: room,
        items: selectedCart.product ? selectedCart.product.name : 'Water',
        quantity: selectedCart.quantity,
        paymentMethod: payment,
        total: grandTotal
    };

    // Store global reference for WhatsApp redirection button
    window.currentOrderData = orderData;

    // Display values on Success Screen
    const succId = document.getElementById('succ-id');
    const succTotal = document.getElementById('succ-total');
    if (succId) succId.innerText = orderRef;
    if (succTotal) succTotal.innerText = grandTotal;

    // Switch view to success & send order details down processing pipelines
    showScreen('success');
    handleCheckoutSubmit(orderData);
}

/**
 * Dispatches order across multi-channels (Google Sheets, SMS Gateway, Paystack, WhatsApp).
 * @param {Object} orderData - Formatted order payload
 */
async function handleCheckoutSubmit(orderData) {
    // 1. Log order asynchronously to Google Sheets database
    try {
        fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createOrder', ...orderData })
        });
    } catch (e) {
        console.warn('Sheet order logging queued via network:', e);
    }

    // 2. Dispatch SMS alert to Admin phone via SMS Online Ghana API
    if (CONFIG.SMS_ONLINE_GH && CONFIG.SMS_ONLINE_GH.ENABLED) {
        dispatchSMSOnlineGhana(orderData);
    }

    // 3. Trigger requested Payment Gateway
    if (orderData.paymentMethod === 'paystack') {
        launchPaystackSplitPayment(orderData);
    } else {
        launchWhatsAppNotification(orderData);
    }
}

/**
 * Triggers non-blocking SMS alert to business owner via SMS Online Ghana API.
 */
function dispatchSMSOnlineGhana(order) {
    const smsMessage = `[Aura H2Go] New Order!\nCustomer: ${order.customerName}\nPhone: ${order.phone}\nLocation: ${order.location}\nTotal: GHS ${order.total}`;
    const apiEndpoint = `https://api.smsonlinegh.com/v4/message/sms/send?key=${encodeURIComponent(CONFIG.SMS_ONLINE_GH.API_KEY)}&to=${encodeURIComponent(CONFIG.SELLER_PHONE)}&author=${encodeURIComponent(CONFIG.SMS_ONLINE_GH.SENDER_ID)}&msg=${encodeURIComponent(smsMessage)}`;
    
    // Non-blocking background image ping
    const ping = new Image();
    ping.src = apiEndpoint;
}

/**
 * Initializes Paystack Inline Popup Modal with automated detection for subaccount (ACCT_) vs split group (SPL_).
 */
function launchPaystackSplitPayment(order) {
    // Verify script inclusion safety
    if (typeof PaystackPop === 'undefined') {
        alert('Paystack SDK is loading or offline. Redirecting to WhatsApp order confirmation.');
        launchWhatsAppNotification(order);
        return;
    }

    // Base Paystack Options configuration
    const paystackOptions = {
        key: CONFIG.PAYSTACK.PUBLIC_KEY,
        email: order.email || 'order@aurah2go.com',
        amount: Math.round(parseFloat(order.total) * 100), // Convert GHS to Pesewas (e.g., 3.00 GHS = 300 pesewas)
        currency: CONFIG.PAYSTACK.CURRENCY || 'GHS',
        callback: function(response) {
            alert('Payment Successful! Reference: ' + response.reference);
            launchWhatsAppNotification(order);
        },
        onClose: function() {
            alert('Payment window closed. Completing order via WhatsApp dispatch.');
            launchWhatsAppNotification(order);
        }
    };

    // Smart Routing: Attach either split_code (SPL_) or subaccount (ACCT_) based on code prefix
    const rawCode = CONFIG.PAYSTACK.SPLIT_CODE ? CONFIG.PAYSTACK.SPLIT_CODE.trim() : '';
    if (rawCode !== '') {
        if (rawCode.startsWith('SPL_')) {
            paystackOptions.split_code = rawCode;
        } else if (rawCode.startsWith('ACCT_')) {
            paystackOptions.subaccount = rawCode;
        } else {
            // Fallback for custom formatted split codes
            paystackOptions.split_code = rawCode;
        }
    }

    // Launch Paystack Payment Modal
    const handler = PaystackPop.setup(paystackOptions);
    handler.openIframe();
}

/**
 * Formats order string and redirects client directly to seller WhatsApp line.
 */
function launchWhatsAppNotification(order) {
    const formattedPhone = CONFIG.SELLER_PHONE.replace(/^0/, '233');
    const locationDetails = `${order.location}${order.hall ? ' (' + order.hall + ', Rm ' + order.room + ')' : ''}`;
    const itemsDetails = `${order.items}${order.quantity ? ' x ' + order.quantity : ''}`;

    const message = `*NEW ORDER - AURA H2GO*%0A` +
                    `*Customer:* ${encodeURIComponent(order.customerName)}%0A` +
                    `*Phone:* ${encodeURIComponent(order.phone)}%0A` +
                    `*Location:* ${encodeURIComponent(locationDetails)}%0A` +
                    `*Order Items:* ${encodeURIComponent(itemsDetails)}%0A` +
                    `*Total Paid/Due:* GHS ${encodeURIComponent(order.total)}%0A` +
                    `*Payment Method:* ${encodeURIComponent(order.paymentMethod.toUpperCase())}`;

    window.location.href = `https://wa.me/${formattedPhone}?text=${message}`;
}

/**
 * Global helper function for manual WhatsApp redirect button on Success Screen.
 */
function redirectToWhatsApp() {
    if (window.currentOrderData) {
        launchWhatsAppNotification(window.currentOrderData);
    }
}


/* ==========================================================================
   SECTION 5: PWA INSTALLATION BANNER CONTROLLERS
   ========================================================================== */

let deferredPrompt;

// Intercept default web install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
});

function setupPWAInstallBanner() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone || localStorage.getItem('pwa_banner_dismissed')) return;

    if (isIOS) {
        setTimeout(showIOSInstallInstructions, 1500);
    }
}

function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 text-white flex items-center justify-between z-50 shadow-2xl';
    banner.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-bold text-white shadow-md">
                <i class="fa-solid fa-download"></i>
            </div>
            <div>
                <p class="text-xs font-bold">Install Aura H2Go App</p>
                <p class="text-[10px] text-slate-400">Add to home screen for fast loading & offline ordering</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="triggerInstall()" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-xs font-bold transition">Install</button>
            <button onclick="dismissInstall()" class="px-2 py-1.5 text-slate-400 hover:text-white text-xs"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    document.body.appendChild(banner);
}

function showIOSInstallInstructions() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 text-white flex items-center justify-between z-50 shadow-2xl';
    banner.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-bold text-white animate-bounce">
                <i class="fa-solid fa-arrow-down text-lg"></i>
            </div>
            <div>
                <p class="text-xs font-bold">Install Aura H2Go App</p>
                <p class="text-[10px] text-slate-300">Tap <strong class="text-sky-400">Share</strong> (icon below) then <strong class="text-sky-400">'Add to Home Screen'</strong></p>
            </div>
        </div>
        <button onclick="dismissInstall()" class="px-2 py-1.5 text-slate-400 hover:text-white text-xs"><i class="fa-solid fa-xmark"></i></button>
    `;
    document.body.appendChild(banner);
}

function triggerInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
            dismissInstall();
        });
    }
}

function dismissInstall() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
    localStorage.setItem('pwa_banner_dismissed', 'true');
}
