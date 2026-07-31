let appState = {
    products: [],
    locations: [],
    selectedProduct: null,
    quantity: 1,
    currentOrder: null
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Instant Load from Cache
    loadCachedData();
    // 2. Background Sync with Google Apps Script
    fetchBackendData();
    
    registerSW();
});

function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

function loadCachedData() {
    const cachedP = localStorage.getItem('aura_cached_products');
    const cachedL = localStorage.getItem('aura_cached_locations');

    if (cachedP && cachedL) {
        appState.products = JSON.parse(cachedP);
        appState.locations = JSON.parse(cachedL);
        if (appState.products.length > 0) {
            appState.selectedProduct = appState.products[0];
            renderProducts();
            renderLocations();
            document.getElementById('loading-spinner').classList.add('hidden');
        }
    }
}

async function fetchBackendData() {
    try {
        const res = await fetch(`${CONFIG.SCRIPT_URL}?action=getInitialData`);
        const data = await res.json();

        if (data.success && data.products && data.products.length > 0) {
            appState.products = data.products;
            appState.locations = data.locations;
            
            // Cache locally for instant next load
            localStorage.setItem('aura_cached_products', JSON.stringify(data.products));
            localStorage.setItem('aura_cached_locations', JSON.stringify(data.locations));

            if (!appState.selectedProduct) {
                appState.selectedProduct = appState.products[0];
            }
            
            renderProducts();
            renderLocations();
            document.getElementById('loading-spinner').classList.add('hidden');
        }
    } catch (err) {
        console.error("Backend sync failed", err);
        if (!appState.products.length) {
            document.getElementById('loading-spinner').innerText = "Network issue. Please refresh.";
        }
    }
}

function renderProducts() {
    const container = document.getElementById('product-container');
    container.innerHTML = appState.products.map(p => {
        const imgUrl = p['Image URL'] || 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=150&auto=format&fit=crop&q=80';
        return `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm border border-slate-200/80">
                <img src="${imgUrl}" alt="${p.Name}" class="w-16 h-16 object-cover rounded-xl bg-slate-100 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-slate-900 text-sm truncate">${p.Name}</h3>
                    <p class="text-[11px] text-slate-500 line-clamp-1">${p.Description}</p>
                    <p class="text-sm font-black text-sky-600 mt-1">GHS ${parseFloat(p['Price (GHS)']).toFixed(2)}</p>
                </div>
                <button onclick="selectProduct('${p['Product ID']}')" class="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow transition flex-shrink-0">
                    Order
                </button>
            </div>
        `;
    }).join('');
}

function renderLocations() {
    const select = document.getElementById('cust-location');
    select.innerHTML = appState.locations.map(l => `
        <option value="${l['Zone Name']}" data-fee="${l['Delivery Fee (GHS)']}">${l['Zone Name']} (+ GHS ${parseFloat(l['Delivery Fee (GHS)']).toFixed(2)})</option>
    `).join('');
    updateSummary();
}

function selectProduct(id) {
    appState.selectedProduct = appState.products.find(p => p['Product ID'] === id);
    appState.quantity = 1;
    document.getElementById('qty-count').innerText = "1";
    showScreen('order');
    updateSummary();
}

function adjustQty(delta) {
    appState.quantity = Math.max(1, appState.quantity + delta);
    document.getElementById('qty-count').innerText = appState.quantity;
    updateSummary();
}

function updateSummary() {
    if (!appState.selectedProduct) return;

    const locSelect = document.getElementById('cust-location');
    const selectedOpt = locSelect.options[locSelect.selectedIndex];
    const deliveryFee = selectedOpt ? parseFloat(selectedOpt.dataset.fee || 0) : 0;
    const unitPrice = parseFloat(appState.selectedProduct['Price (GHS)']);
    const subtotal = unitPrice * appState.quantity;

    document.getElementById('sum-product-name').innerText = `${appState.selectedProduct.Name} (x${appState.quantity})`;
    document.getElementById('sum-subtotal').innerText = subtotal.toFixed(2);
    document.getElementById('sum-delivery').innerText = deliveryFee.toFixed(2);
    document.getElementById('sum-total').innerText = (subtotal + deliveryFee).toFixed(2);
}

function showScreen(name) {
    ['home', 'order', 'success'].forEach(s => {
        document.getElementById(`screen-${s}`).classList.add('hidden');
    });
    document.getElementById(`screen-${name}`).classList.remove('hidden');
    window.scrollTo(0, 0);
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

    const locSelect = document.getElementById('cust-location');
    const selectedOpt = locSelect.options[locSelect.selectedIndex];
    const deliveryFee = parseFloat(selectedOpt.dataset.fee || 0);
    const unitPrice = parseFloat(appState.selectedProduct['Price (GHS)']);
    const subtotal = unitPrice * appState.quantity;

    const payload = {
        action: "createOrder",
        name: document.getElementById('cust-name').value,
        phone: document.getElementById('cust-phone').value,
        location: locSelect.value,
        hall: document.getElementById('cust-hall').value,
        room: document.getElementById('cust-room').value,
        product: appState.selectedProduct.Name,
        quantity: appState.quantity,
        paymentMethod: document.getElementById('cust-payment').value,
        total: subtotal + deliveryFee
    };

    try {
        const res = await fetch(CONFIG.SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            appState.currentOrder = { ...payload, orderId: result.orderId };
            document.getElementById('succ-id').innerText = result.orderId;
            document.getElementById('succ-total').innerText = payload.total.toFixed(2);
            showScreen('success');
        } else {
            alert("Order error: " + (result.error || "Please try again."));
        }
    } catch (err) {
        alert("Submission error. Please check your internet connection.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Order";
    }
}

function redirectToWhatsApp() {
    if (!appState.currentOrder) return;
    const o = appState.currentOrder;
    const msg = `Hello Aura H2Go,\nI placed an order.\n\nOrder ID: ${o.orderId}\nName: ${o.name}\nPhone: ${o.phone}\nProduct: ${o.product}\nQuantity: ${o.quantity} gallon(s)\nLocation: ${o.location}, ${o.hall} - ${o.room}\nTotal: GHS ${o.total.toFixed(2)}`;
    window.open(`https://wa.me/233206871838?text=${encodeURIComponent(msg)}`, '_blank');
}
