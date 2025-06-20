// stored-passwords.js
// Assumes firebase, CryptoJS loaded
const auth = firebase.auth();
const db = firebase.firestore();

const websitesList = document.getElementById('websitesList');
const passwordDetails = document.getElementById('passwordDetails');
const selectedWebsite = document.getElementById('selectedWebsite');
const decryptedPassword = document.getElementById('decryptedPassword');
const copyDecryptedBtn = document.getElementById('copyDecryptedBtn');
const websiteLink = document.getElementById('websiteLink');
const logoutBtn = document.getElementById('logoutBtn');

// At the top, import or include VaultSessionManager.js
// <script src="VaultSessionManager.js"></script> in HTML, or import if using modules

// On page load, try to restore session
VaultSession.tryRestore();

// Use VaultSession.get() for decryption with PBKDF2 and salt
async function decryptPassword(encString) {
    const vaultKey = await VaultSession.get();
    if (!vaultKey) return '';
    const [salt, ivHex, cipherText] = encString.split(':');
    const key = CryptoJS.PBKDF2(vaultKey, CryptoJS.enc.Hex.parse(salt), { keySize: 256/32, iterations: 100000 });
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(cipherText, key, { iv });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    // Fetch all passwords for user from RTDB
    websitesList.innerHTML = '<em>Loading...</em>';
    const userId = user.uid;
    const snapshot = await firebase.database().ref('users/' + userId + '/passwords').orderByChild('createdAt').once('value');
    const passwords = snapshot.val() || {};
    console.log('[DEBUG] Loaded passwords from RTDB:', passwords);
    const sites = Object.entries(passwords).map(([id, data]) => ({ id, website: data.website, username: data.username, password: data.password }));
    if (sites.length === 0) {
        websitesList.innerHTML = '<p>No passwords stored yet.</p>';
        return;
    }
    websitesList.innerHTML = sites.map(site => `<div class="mb-3"><a href="#" data-id="${site.id}" class="website-link">${site.website}</a></div>`).join('');
    // Add click listeners
    document.querySelectorAll('.website-link').forEach(link => {
        link.addEventListener('click', async e => {
            e.preventDefault();
            const id = link.getAttribute('data-id');
            const site = sites.find(s => s.id === id);
            if (site) {
                selectedWebsite.innerText = site.website;
                websiteLink.href = /^https?:\/\//.test(site.website) ? site.website : 'https://' + site.website;
                const vaultKey = await VaultSession.get();
                console.log('[DEBUG] vaultKey for decryption:', vaultKey);
                console.log('[DEBUG] Encrypted password:', site.password);
                const decrypted = await decryptPassword(site.password);
                console.log('[DEBUG] Decrypted password:', decrypted);
                decryptedPassword.value = decrypted;
                passwordDetails.style.display = 'block';
            }
        });
    });
});

copyDecryptedBtn.addEventListener('click', () => {
    if (decryptedPassword.value) {
        navigator.clipboard.writeText(decryptedPassword.value);
        copyDecryptedBtn.innerText = 'Copied!';
        setTimeout(() => copyDecryptedBtn.innerText = 'Copy Password', 1200);
    }
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}); 