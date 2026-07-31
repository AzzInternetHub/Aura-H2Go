function login() {
    const input = document.getElementById('admin-pass').value;
    if (input === CONFIG.ADMIN_PASS) {
        document.getElementById('login-box').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
    } else {
        alert('Invalid Access Key');
    }
}
