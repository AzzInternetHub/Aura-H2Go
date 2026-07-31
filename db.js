const DB_NAME = 'AuraH2GoDB';
let dbInstance = null;

function initDB() {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains('orders')) {
            dbInstance.createObjectStore('orders', { keyPath: 'orderId' });
        }
    };
    request.onsuccess = (e) => { dbInstance = e.target.result; };
}

initDB();
