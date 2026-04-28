// ==================== FIREBASE CONFIG ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    getDocs, 
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBDdnsaGyRr2qOoHnPVLiaqFJx6vJOTot4",
    authDomain: "king-number.firebaseapp.com",
    projectId: "king-number",
    storageBucket: "king-number.firebasestorage.app",
    messagingSenderId: "258370651114",
    appId: "1:258370651114:web:69de51df49dc1dcb7d2893",
    measurementId: "G-S0W6M4LSP5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== DEFAULT ADMIN (LANGSUNG DI CODE) ====================
const DEFAULT_ADMIN = {
    email: "admin@kingnumber.com",
    password: "admin123",
    name: "Super Admin",
    role: "admin"
};

// Fungsi untuk membuat default admin jika belum ada
async function createDefaultAdminIfNotExists() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("email", "==", DEFAULT_ADMIN.email));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.log("👑 Creating default admin account...");
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, DEFAULT_ADMIN.email, DEFAULT_ADMIN.password);
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: DEFAULT_ADMIN.email,
                    name: DEFAULT_ADMIN.name,
                    role: DEFAULT_ADMIN.role,
                    createdAt: new Date().toISOString()
                });
                console.log("✅ Default admin created successfully!");
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    try {
                        const signInCred = await signInWithEmailAndPassword(auth, DEFAULT_ADMIN.email, DEFAULT_ADMIN.password);
                        const adminDoc = await getDoc(doc(db, 'users', signInCred.user.uid));
                        if (!adminDoc.exists()) {
                            await setDoc(doc(db, 'users', signInCred.user.uid), {
                                email: DEFAULT_ADMIN.email,
                                name: DEFAULT_ADMIN.name,
                                role: DEFAULT_ADMIN.role,
                                createdAt: new Date().toISOString()
                            });
                        }
                    } catch (signError) {}
                }
            }
        }
    } catch (error) {
        console.error("Error checking admin:", error);
    }
}

// ==================== GLOBAL VARIABLES ====================
const API_BASE = 'https://weak-deloris-nothing672434-fe85179d.koyeb.app';
let currentUser = null;
let currentUserRole = null;
let numbers = [];
let allOtps = [];
let currentView = 'home';
let selectedCountry = null;
let otpRefreshTimer = null;
let lastOtpFetch = 0;
const domOtpIds = new Set();
let modalNumber = null;
let modalRefreshTimer = null;
const domModalIds = new Set();

// ==================== UTILS FUNCTIONS ====================
function showNotif(msg) {
    const n = document.getElementById('notif');
    n.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 2500);
}

function copyText(text, label) {
    navigator.clipboard.writeText(text).then(() => showNotif(`✅ ${label} copied!`)).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showNotif(`✅ ${label} copied!`);
    });
}

function toggleTheme() {
    const cur = document.body.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('fn_theme', next);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

const savedTheme = localStorage.getItem('fn_theme') || 'dark';
document.body.setAttribute('data-theme', savedTheme);
const themeIcon = document.getElementById('themeIcon');
if (themeIcon) {
    themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ==================== AUTH FUNCTIONS ====================
async function handleLogin() {
    console.log("🔐 Login button clicked!");
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorDiv = document.getElementById('loginError');
    
    errorDiv.style.display = 'none';
    
    if (!email || !password) {
        errorDiv.textContent = '❌ Please enter email and password';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login success:", userCredential.user.email);
    } catch (error) {
        console.error("❌ Login error:", error);
        errorDiv.textContent = '❌ Invalid email or password';
        errorDiv.style.display = 'block';
    }
}

async function handleLogout() {
    console.log("🚪 Logout clicked!");
    await signOut(auth);
}

function showApp(user, role) {
    currentUser = user;
    currentUserRole = role;
    
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userName').textContent = user?.name || user?.email?.split('@')[0] || 'User';
    
    const roleBadge = document.getElementById('userRole');
    const adminBtn = document.getElementById('adminTabBtn');
    
    if (role === 'admin') {
        roleBadge.innerHTML = '<i class="fas fa-crown"></i> Admin';
        adminBtn.style.display = 'block';
        loadUsersList();
    } else {
        roleBadge.innerHTML = '<i class="fas fa-user"></i> User';
        adminBtn.style.display = 'none';
    }
    
    loadNumbers();
    fetchOtps();
    startAutoRefresh();
}

function hideApp() {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    if (otpRefreshTimer) {
        clearInterval(otpRefreshTimer);
        otpRefreshTimer = null;
    }
}

// ==================== ADMIN FUNCTIONS ====================
async function loadUsersList() {
    if (currentUserRole !== 'admin') return;
    
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = [];
        snapshot.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));
        
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.uid.substring(0, 8)}...<\/td>
                <td>${u.email}<\/td>
                <td>${u.name}<\/td>
                <td><span style="background:${u.role === 'admin' ? 'var(--accent)' : 'var(--bg-tertiary)'}; padding:4px 12px; border-radius:50px; font-size:11px;">${u.role === 'admin' ? '👑 Admin' : '👤 User'}</span><\/td>
                <td>${u.uid !== currentUser?.uid ? `<button class="delete-user-btn" data-uid="${u.uid}" data-name="${u.name}">Delete</button>` : 'Current'}<\/td>
            </td>
        `).join('');
        
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteUser(btn.dataset.uid, btn.dataset.name);
            });
        });
    } catch(error) {
        console.error("Error loading users:", error);
    }
}

async function createUser() {
    const email = document.getElementById('newEmail').value.trim();
    const name = document.getElementById('newName').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const role = document.getElementById('newRole').value;
    
    if (!email || !name || !password) {
        showNotif('❌ Please fill all fields');
        return;
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), { 
            email, name, role, createdAt: new Date().toISOString() 
        });
        showNotif(`✅ User ${name} created`);
        document.getElementById('newEmail').value = '';
        document.getElementById('newName').value = '';
        document.getElementById('newPassword').value = '';
        loadUsersList();
    } catch (error) {
        showNotif('❌ ' + error.message);
    }
}

async function deleteUser(uid, name) {
    if (uid === currentUser?.uid) {
        showNotif('❌ Cannot delete yourself');
        return;
    }
    if (confirm(`Delete user "${name}"?`)) {
        await deleteDoc(doc(db, 'users', uid));
        showNotif(`✅ User ${name} deleted`);
        loadUsersList();
    }
}

// ==================== NUMBERS FUNCTIONS ====================
async function loadNumbers() {
    try {
        const res = await fetch(`${API_BASE}/api/numbers`);
        const data = await res.json();
        if (data.success && Array.isArray(data.numbers)) {
            numbers = data.numbers;
            renderCountries();
            updateStats();
        }
    } catch(e) { console.error(e); }
}

function groupByCountry(nums) {
    const map = new Map();
    nums.forEach(n => {
        const code = n.countryCode || n.country;
        if (!map.has(code)) map.set(code, { name: n.country, flag: n.flag, code, items: [] });
        map.get(code).items.push(n);
    });
    return Array.from(map.values());
}

function renderCountries(query = '') {
    const grid = document.getElementById('countriesGrid');
    const q = query.toLowerCase().trim();
    let groups = groupByCountry(numbers);
    if (q) groups = groups.filter(g => g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q));
    
    if (!groups.length) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-globe"></i><h3>No countries found</h3></div>';
        return;
    }
    
    grid.innerHTML = groups.map(g => {
        const otpCnt = allOtps.filter(o => o.country && g.name && o.country.toLowerCase().includes(g.name.toLowerCase().split(' ')[0])).length;
        return `<div class="country-card" data-country='${JSON.stringify({code:g.code,name:g.name,flag:g.flag})}'>
            <span class="cc-flag">${g.flag}</span>
            <div class="cc-name">${g.name}</div>
            <div class="cc-meta">
                <span class="cc-count">${g.items.length} #</span>
                <span class="cc-otp-badge ${otpCnt ? 'visible' : ''}"><i class="fas fa-key"></i> ${otpCnt || ''}</span>
                <span class="cc-arrow"><i class="fas fa-chevron-right"></i></span>
            </div>
        </div>`;
    }).join('');
    
    document.querySelectorAll('.country-card').forEach(card => {
        card.addEventListener('click', () => {
            const country = JSON.parse(card.dataset.country);
            openCountry(country);
        });
    });
}

function openCountry(meta) {
    selectedCountry = meta;
    renderCountryDetail(meta, '');
    switchView('country');
}

function renderCountryDetail(meta, numQuery = '') {
    let countryNums = numbers.filter(n => n.countryCode === meta.code);
    if (numQuery) countryNums = countryNums.filter(n => n.number.toLowerCase().includes(numQuery.toLowerCase()));
    
    document.getElementById('countryDetailHeader').innerHTML = `
        <span class="cdh-flag">${meta.flag}</span>
        <div class="cdh-info"><h2>${meta.name}</h2><p>${countryNums.length} numbers available</p></div>
        <div class="cdh-search"><div class="search-input-wrap"><i class="fas fa-search"></i><input class="search-input" id="countrySearchInput" placeholder="Search numbers..." style="padding-left:44px;"></div></div>
    `;
    
    const countrySearchInput = document.getElementById('countrySearchInput');
    if (countrySearchInput) {
        countrySearchInput.value = numQuery;
        countrySearchInput.addEventListener('input', (e) => {
            renderCountryDetail(meta, e.target.value);
        });
    }
    
    if (!countryNums.length) {
        document.getElementById('numbersList').innerHTML = '<div class="empty-state"><i class="fas fa-phone"></i><h3>No numbers found</h3></div>';
        return;
    }
    
    document.getElementById('numbersList').innerHTML = countryNums.map(n => `
        <div class="number-card">
            <div class="number-val"><i class="fas fa-sim-card"></i> ${n.number}</div>
            <div class="number-actions">
                <button class="btn btn-copy" data-number="${n.number}"><i class="fas fa-copy"></i> Copy</button>
                <button class="btn btn-otp" data-number="${n.number}" data-country="${meta.name}" data-flag="${meta.flag}"><i class="fas fa-key"></i> OTPs</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', () => copyText(btn.dataset.number, 'Number'));
    });
    document.querySelectorAll('.btn-otp').forEach(btn => {
        btn.addEventListener('click', () => showNumberOtps(btn.dataset.number, btn.dataset.country, btn.dataset.flag));
    });
}

function updateStats() {
    const groups = groupByCountry(numbers);
    document.getElementById('totalNums').textContent = numbers.length;
    document.getElementById('totalCnts').textContent = groups.length;
}

// ==================== OTPS FUNCTIONS ====================
async function fetchOtps() {
    const now = Date.now();
    if (now - lastOtpFetch < 3000) return;
    lastOtpFetch = now;
    
    try {
        const res = await fetch(`${API_BASE}/api/tops?limit=200`);
        const data = await res.json();
        let otpsArray = [];
        if (data.success && Array.isArray(data.otps)) otpsArray = data.otps;
        else if (Array.isArray(data)) otpsArray = data;
        else if (data.tops && Array.isArray(data.tops)) otpsArray = data.tops;
        
        allOtps = otpsArray.slice(0, 200);
        
        document.getElementById('totalOtpsStat').textContent = allOtps.length;
        document.getElementById('otpCount').textContent = allOtps.length;
        document.getElementById('otpCntCount').textContent = [...new Set(allOtps.map(o => o.country).filter(Boolean))].length;
        
        if (currentView === 'otps') {
            populateCountryFilter();
            insertNewOtpCards();
            applyFilter();
        }
        if (currentView === 'home') updateCountryBadges();
        document.querySelector('.live-dot').style.background = '#34d39a';
    } catch(e) {
        document.querySelector('.live-dot').style.background = '#ff5a5a';
    }
}

function makeOtpCard(o, animate = true) {
    const safe = str => (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const otpCode = o.otp || (o.code) || (o.message && /\d{4,6}/.exec(o.message)?.[0]) || '';
    const otpBlock = otpCode ? `
        <div class="otp-code-block" data-otp="${otpCode}">
            <div style="font-size:10px; opacity:0.7;"><i class="fas fa-key"></i> OTP Code</div>
            <div class="otp-code-val">${safe(otpCode)}</div>
        </div>` : '';
    
    return `<div class="otp-card${animate ? ' is-new' : ''}" data-id="${o.id}">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div><span style="font-size:24px;">${o.flag || '🌍'}</span> <strong>${safe(o.country || 'Unknown')}</strong> <span style="background:var(--bg-tertiary); padding:2px 10px; border-radius:50px; font-size:11px;">${safe(o.sender || o.service || '')}</span></div>
            <span style="font-size:11px; color:var(--text-muted);"><i class="far fa-clock"></i> ${safe(o.time || new Date(o.timestamp).toLocaleTimeString() || '')}</span>
        </div>
        ${otpBlock}
        <div style="margin:8px 0;"><span style="font-size:11px; color:var(--text-muted);"><i class="fas fa-phone"></i> Number</span><div style="font-family:'JetBrains Mono'; font-size:13px;">${safe(o.number || o.phone || '—')}</div></div>
        <div class="otp-msg"><i class="fas fa-envelope"></i> ${safe(o.message || o.text || '')}</div>
        <button class="otp-copy-btn" data-message="${safe(o.message || o.text || '')}" style="width:100%; padding:10px; background:var(--bg-tertiary); border:none; border-radius:var(--radius-sm); cursor:pointer;"><i class="fas fa-copy"></i> Copy Full Message</button>
    </div>`;
}

function insertNewOtpCards() {
    const grid = document.getElementById('otpGrid');
    const newItems = allOtps.filter(o => o.id && !domOtpIds.has(o.id));
    
    if (!newItems.length && domOtpIds.size === 0 && grid.querySelector('.empty-state')) return;
    if (newItems.length && grid.querySelector('.empty-state')) grid.innerHTML = '';
    
    newItems.forEach(o => {
        domOtpIds.add(o.id);
        const div = document.createElement('div');
        div.innerHTML = makeOtpCard(o, true);
        grid.prepend(div.firstElementChild);
        
        const otpCodeBlock = div.querySelector('.otp-code-block');
        if (otpCodeBlock) {
            otpCodeBlock.addEventListener('click', () => copyText(otpCodeBlock.dataset.otp, 'OTP'));
        }
        const copyMsgBtn = div.querySelector('.otp-copy-btn');
        if (copyMsgBtn) {
            copyMsgBtn.addEventListener('click', () => copyText(copyMsgBtn.dataset.message, 'Message'));
        }
    });
    
    const cards = grid.querySelectorAll('.otp-card');
    if (cards.length > 100) {
        Array.from(cards).slice(100).forEach(c => {
            domOtpIds.delete(c.dataset.id);
            c.remove();
        });
    }
}

function applyFilter() {
    const cf = document.getElementById('otpCountryFilter').value;
    const sq = document.getElementById('otpSearch').value.toLowerCase();
    
    document.querySelectorAll('#otpGrid .otp-card').forEach(card => {
        const o = allOtps.find(x => x.id == card.dataset.id);
        if (!o) { card.style.display = 'none'; return; }
        const countryOk = cf === 'all' || (o.country || '').toLowerCase() === cf.toLowerCase();
        const searchOk = !sq || (o.number || '').toLowerCase().includes(sq) || (o.sender || '').toLowerCase().includes(sq) || (o.message || '').toLowerCase().includes(sq);
        card.style.display = (countryOk && searchOk) ? '' : 'none';
    });
}

function renderOtps() {
    applyFilter();
}

function populateCountryFilter() {
    const csel = document.getElementById('otpCountryFilter');
    const cur = csel.value;
    const countries = [...new Set(allOtps.map(o => o.country).filter(Boolean))].sort();
    csel.innerHTML = '<option value="all">🌍 All Countries</option>' + countries.map(c => `<option value="${c}"${c === cur ? ' selected' : ''}>${c}</option>`).join('');
}

function updateCountryBadges() {
    document.querySelectorAll('.country-card').forEach(card => {
        const nameElem = card.querySelector('.cc-name');
        if (!nameElem) return;
        const name = nameElem.textContent.trim().toLowerCase().split(' ')[0];
        const cnt = allOtps.filter(o => o.country && o.country.toLowerCase().includes(name)).length;
        const badge = card.q