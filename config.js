const CONFIG = {
    // Google Apps Script Deployment URL
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxJOeMMAi6eSBlfGyxrv3vP2h4eDfk2hV5GR1B4r4GPtCae7XnnRc8_jNPkJ82mb4_9mw/exec",
    
    // Direct Google Sheet Link
    SHEET_URL: "https://docs.google.com/spreadsheets/d/17VgwnzTujcjSJ_L3GQck7-ytLt4tHtnVCyHVvw5yH8c/edit?usp=drivesdk",
    
    // Admin Passcode
    ADMIN_PASS: "aura2026",

    // Automated Notification Numbers
    SELLER_PHONE: "0598160732", // Formatted for SMS & WhatsApp

    // --- SMS ONLINE GHANA INTEGRATION (Zenoph) ---
    // Register/login at www.smsonlinegh.com to obtain these
    SMS_ONLINE_GH: {
        ENABLED: true,
        API_KEY: "09788ec42cc2a5fe3d57d85bb3361b60ee547f531e126a11a5e4aa7e46fc1452",
        SENDER_ID: "H2Go" // Max 11 characters
    },

    // --- PAYSTACK INTEGRATION & SPLIT PAYMENTS ---
    PAYSTACK: {
        PUBLIC_KEY: "pk_live_8c56d91cee6884d988dd8355981e0134ab72b94b", // Replace with your Paystack Public Key
        SPLIT_CODE: "SPL_8irFXTnD5s", // <-- Insert Paystack Split Code here for multi-account payouts
        CURRENCY: "GHS"
    }
};
