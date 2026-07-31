let appState = {
    products: [],
    locations: [],
    selectedProduct: null,
    currentOrder: null
};

document.addEventListener('DOMContentLoaded', () => {
    fetchBackendData();
    registerSW();
});

function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

async function fetchBackendData() {
    try {
        const res = await fetch(`${CONFIG.SCRIPT_URL}?action=getInitialData`);
        const data = await res.json();

        if (data.success) {
            appState.products = data.products;
            appState.locations = data.locations;
            appState.selectedProduct = appState.products[0];
            
            renderProducts();
            renderLocations();
            document.getElementById('loading-spinner').classList.add('hidden');
        }
    } catch (err) {
        console.error("Backend fetch failed", err);
        document.getElementById('loading-spinner').innerText = "Failed to load live data. Check internet connection.";
    }
}

function renderProducts() {
    const container = document.getElementById('product-container');
    container.innerHTML = appState.products.map(p => `
        <div class="glass-card p-5 rounded-2xl flex justify-between items-center">
            <div>
                <h3 class="font-bold text-slate-900 text-sm">${p.Name}</h3>
                <p class="text-xs text-slate-500">${p.Description}</p>
                <p class="text-base font-black text-sky-600 mt-1">GHS ${parseFloat(p['Price (GHS)']).toFixed(2)}</p>
            </div>
            <button onclick="selectProduct('${p['Product ID']}')" class="bg-sky-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow">
                Select
            </button>
        </div>
    `).join('');
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
    showScreen('order');
    updateSummary();
}

function updateSummary() {
    if (!appState.selectedProduct) return;

    const locSelect = document.getElementById('cust-location');
    const selectedOpt = locSelect.options[locSelect.selectedIndex];
    const deliveryFee = selectedOpt ? parseFloat(selectedOpt.dataset.fee || 0) : 0;
    const subtotal = parseFloat(appState.selectedProduct['Price (GHS)']);

    document.getElementById('sum-product-name').innerText = appState.selectedProduct.Name;
    document.getElementById('sum-subtotal').innerText = subtotal.toFixed(2);
    document.getElementById('sum-delivery').innerText = deliveryFee.toFixed(2);
    document.getElementById('sum-total').innerText = (subtotal + deliveryFee).toFixed(2);
}

function showScreen(name) {
    ['home', 'order', 'success'].forEach(s => {
        document.getElementById(`screen-${s}`).classList.add('hidden');
    });
    document.getElementById(`screen-${name}`).classList.remove('hidden');
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    const locSelect = document.getElementById('cust-location');
    const selectedOpt = locSelect.options[locSelect.selectedIndex];
    const deliveryFee = parseFloat(selectedOpt.dataset.fee || 0);
    const subtotal = parseFloat(appState.selectedProduct['Price (GHS)']);

    const payload = {
        action: "createOrder",
        name: document.getElementById('cust-name').value,
        phone: document.getElementById('cust-phone').value,
        location: locSelect.value,
        hall: document.getElementById('cust-hall').value,
        room: document.getElementById('cust-room').value,
        product: appState.selectedProduct.Name,
        quantity: 1,
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
        }
    } catch (err) {
        alert("Order failed to submit. Please check connection.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Order";
    }
}

function redirectToWhatsApp() {
    if (!appState.currentOrder) return;
    const o = appState.currentOrder;
    const msg = `Hello Aura H2Go,\nI placed an order.\n\nOrder ID: ${o.orderId}\nName: ${o.name}\nPhone: ${o.phone}\nLocation: ${o.location}, ${o.hall} - ${o.room}\nProduct: ${o.product}\nTotal Amount: GHS ${o.total.toFixed(2)}`;
    window.open(`https://wa.me/233206871838?text=${encodeURIComponent(msg)}`, '_blank');
}
