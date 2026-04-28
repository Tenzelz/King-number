// ==================== OPTIMIZED MODAL FUNCTIONS WITH PAGINATION ====================
let modalNumber = null;
let modalRefreshTimer = null;
let modalOtpsCache = new Map(); // Cache OTPs per number
let lastModalFetch = 0;
let currentPage = 1;
const ITEMS_PER_PAGE = 10; // Show 10 items per page
let totalFilteredOtps = [];

const MODAL_FETCH_INTERVAL = 8000; // Increased to 8 seconds

async function fetchModalOtps() {
    if (!modalNumber) return;
    
    const now = Date.now();
    if (now - lastModalFetch < MODAL_FETCH_INTERVAL) return;
    lastModalFetch = now;
    
    // Show loading indicator
    const loadMoreBtn = document.getElementById('loadMoreOtps');
    if (loadMoreBtn) {
        loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        loadMoreBtn.disabled = true;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/tops?limit=100`);
        const data = await res.json();
        let all = Array.isArray(data.otps) ? data.otps : (Array.isArray(data) ? data : (data.tops || []));
        const matches = all.filter(o => (o.number || o.phone) === modalNumber);
        
        // Update cache (only keep latest 100 to prevent memory issues)
        matches.forEach(o => {
            if (o.id && !modalOtpsCache.has(o.id)) {
                modalOtpsCache.set(o.id, o);
            }
        });
        
        // Keep only latest 100 items in cache
        if (modalOtpsCache.size > 100) {
            const oldestKeys = Array.from(modalOtpsCache.keys()).slice(0, modalOtpsCache.size - 100);
            oldestKeys.forEach(key => modalOtpsCache.delete(key));
        }
        
        // Convert cache to array and sort by time (newest first)
        totalFilteredOtps = Array.from(modalOtpsCache.values())
            .sort((a, b) => {
                const timeA = a.timestamp || a.time || 0;
                const timeB = b.timestamp || b.time || 0;
                return timeB - timeA;
            });
        
        // Reset to page 1 when new data arrives
        currentPage = 1;
        renderModalOtpsPage();
        
    } catch(e) {
        console.error('Modal fetch error:', e);
    } finally {
        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show More OTPs';
            loadMoreBtn.disabled = false;
        }
    }
}

function renderModalOtpsPage() {
    const grid = document.getElementById('modalOtpList');
    if (!grid) return;
    
    const startIndex = 0;
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const visibleOtps = totalFilteredOtps.slice(startIndex, endIndex);
    const hasMore = endIndex < totalFilteredOtps.length;
    
    if (visibleOtps.length === 0 && totalFilteredOtps.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Waiting for OTPs...</h3>
                <p>No OTPs received yet for this number</p>
                <small style="margin-top: 10px; display: block;">OTPs will appear here automatically</small>
            </div>
        `;
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
    }
    
    // Use DocumentFragment for batch DOM update
    const fragment = document.createDocumentFragment();
    
    visibleOtps.forEach(o => {
        const card = createOptimizedOtpCard(o);
        fragment.appendChild(card);
    });
    
    // Clear and update in one operation
    while (grid.firstChild) {
        grid.removeChild(grid.firstChild);
    }
    grid.appendChild(fragment);
    
    // Update or create load more button
    let loadMoreContainer = document.getElementById('loadMoreContainer');
    if (!loadMoreContainer) {
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.id = 'loadMoreContainer';
        loadMoreContainer.style.textAlign = 'center';
        loadMoreContainer.style.marginTop = '20px';
        grid.parentNode.insertBefore(loadMoreContainer, grid.nextSibling);
    }
    
    if (hasMore) {
        loadMoreContainer.style.display = 'block';
        loadMoreContainer.innerHTML = `
            <button id="loadMoreOtps" class="btn btn-secondary" style="width: auto; padding: 10px 24px;">
                <i class="fas fa-chevron-down"></i> Show More OTPs (${totalFilteredOtps.length - endIndex} left)
            </button>
        `;
        
        const loadMoreBtn = document.getElementById('loadMoreOtps');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                currentPage++;
                renderModalOtpsPage();
            });
        }
    } else {
        if (totalFilteredOtps.length > ITEMS_PER_PAGE) {
            loadMoreContainer.style.display = 'block';
            loadMoreContainer.innerHTML = `
                <div style="color: var(--text-muted); font-size: 12px; padding: 10px;">
                    <i class="fas fa-check-circle"></i> All ${totalFilteredOtps.length} OTPs loaded
                </div>
            `;
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
    
    // Update counter
    const counter = document.getElementById('modalOtpCounter');
    if (counter) {
        counter.textContent = `(${visibleOtps.length}/${totalFilteredOtps.length})`;
    }
}

function createOptimizedOtpCard(o) {
    const safe = str => (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const otpCode = o.otp || (o.code) || (o.message && /\d{4,6}/.exec(o.message)?.[0]) || '';
    
    const div = document.createElement('div');
    div.className = 'otp-card';
    div.setAttribute('data-id', o.id);
    
    // Format time safely
    let timeStr = 'Just now';
    if (o.timestamp) {
        try {
            const date = new Date(o.timestamp);
            if (!isNaN(date.getTime())) {
                timeStr = date.toLocaleTimeString();
            }
        } catch(e) {}
    } else if (o.time) {
        timeStr = o.time;
    }
    
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div>
                <span style="font-size:24px;">${o.flag || '🌍'}</span> 
                <strong>${safe(o.country || 'Unknown')}</strong> 
                <span style="background:var(--bg-tertiary); padding:2px 10px; border-radius:50px; font-size:11px; display:inline-block; margin-top:4px;">
                    ${safe(o.sender || o.service || 'Unknown Sender')}
                </span>
            </div>
            <span style="font-size:11px; color:var(--text-muted);">
                <i class="far fa-clock"></i> ${safe(timeStr)}
            </span>
        </div>
        ${otpCode ? `
        <div class="otp-code-block" data-otp="${safe(otpCode)}" style="cursor:pointer; background:var(--bg-tertiary); padding:8px; border-radius:var(--radius-sm); margin-bottom:10px;">
            <div style="font-size:10px; opacity:0.7;"><i class="fas fa-key"></i> OTP Code (click to copy)</div>
            <div class="otp-code-val" style="font-size:20px; font-weight:bold; font-family:monospace;">${safe(otpCode)}</div>
        </div>
        ` : ''}
        <div style="margin:8px 0;">
            <span style="font-size:11px; color:var(--text-muted);"><i class="fas fa-phone"></i> Number</span>
            <div style="font-family:'JetBrains Mono', monospace; font-size:13px; word-break:break-all;">${safe(o.number || o.phone || '—')}</div>
        </div>
        <div class="otp-msg" style="background:var(--bg-tertiary); padding:10px; border-radius:var(--radius-sm); margin:10px 0; max-height:80px; overflow-y:auto; font-size:12px;">
            <i class="fas fa-envelope"></i> ${safe(o.message || o.text || 'No message content')}
        </div>
        <button class="otp-copy-btn" data-message="${safe((o.message || o.text || '').replace(/"/g, '&quot;'))}" style="width:100%; padding:10px; background:var(--bg-tertiary); border:none; border-radius:var(--radius-sm); cursor:pointer;">
            <i class="fas fa-copy"></i> Copy Full Message
        </button>
    `;
    
    // Add event listeners
    const otpCodeBlock = div.querySelector('.otp-code-block');
    if (otpCodeBlock) {
        otpCodeBlock.addEventListener('click', (e) => {
            e.stopPropagation();
            copyText(otpCodeBlock.dataset.otp, 'OTP');
        });
    }
    
    const copyMsgBtn = div.querySelector('.otp-copy-btn');
    if (copyMsgBtn) {
        copyMsgBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyText(copyMsgBtn.dataset.message, 'Message');
        });
    }
    
    return div;
}

function showNumberOtps(number, country, flag) {
    // Clear previous data
    modalNumber = number;
    modalOtpsCache.clear();
    totalFilteredOtps = [];
    currentPage = 1;
    
    // Update modal title and counter
    const title = document.getElementById('modalTitle');
    if (title) {
        title.innerHTML = `<i class="fas fa-key"></i> ${flag} ${country}`;
    }
    
    const numElement = document.getElementById('modalNum');
    if (numElement) {
        numElement.textContent = number;
    }
    
    const counter = document.getElementById('modalOtpCounter');
    if (!counter) {
        const header = document.querySelector('#otpModal .modal-header');
        if (header && !document.getElementById('modalOtpCounter')) {
            const counterSpan = document.createElement('span');
            counterSpan.id = 'modalOtpCounter';
            counterSpan.style.fontSize = '12px';
            counterSpan.style.marginLeft = '10px';
            header.appendChild(counterSpan);
        }
    }
    
    // Show loading state
    const grid = document.getElementById('modalOtpList');
    if (grid) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <h3>Loading OTPs...</h3>
                <p>Please wait while we fetch the data</p>
            </div>
        `;
    }
    
    // Remove old load more container
    const oldContainer = document.getElementById('loadMoreContainer');
    if (oldContainer) oldContainer.remove();
    
    // Show modal
    document.getElementById('otpModal').classList.add('open');
    
    // Fetch OTPs
    fetchModalOtps();
    
    // Set up refresh timer
    if (modalRefreshTimer) clearInterval(modalRefreshTimer);
    modalRefreshTimer = setInterval(() => {
        if (document.getElementById('otpModal').classList.contains('open')) {
            fetchModalOtps();
        }
    }, MODAL_FETCH_INTERVAL);
}

function closeModal() {
    document.getElementById('otpModal').classList.remove('open');
    if (modalRefreshTimer) {
        clearInterval(modalRefreshTimer);
        modalRefreshTimer = null;
    }
    modalNumber = null;
    modalOtpsCache.clear();
    totalFilteredOtps = [];
    currentPage = 1;
    
    // Clean up
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) loadMoreContainer.remove();
}

// Also optimize the main OTP grid similarly
let mainOtpsCache = [];
let mainCurrentPage = 1;
const MAIN_ITEMS_PER_PAGE = 20;

function insertNewOtpCards() {
    const grid = document.getElementById('otpGrid');
    if (!grid) return;
    
    const newItems = allOtps.filter(o => o.id && !domOtpIds.has(o.id));
    
    if (!newItems.length && domOtpIds.size === 0 && grid.querySelector('.empty-state')) return;
    if (newItems.length && grid.querySelector('.empty-state')) grid.innerHTML = '';
    
    // Add to cache
    newItems.forEach(o => {
        domOtpIds.add(o.id);
        mainOtpsCache.unshift(o);
    });
    
    // Keep only last 200 in cache
    if (mainOtpsCache.length > 200) {
        const removed = mainOtpsCache.splice(200);
        removed.forEach(o => domOtpIds.delete(o.id));
    }
    
    // Re-render current page
    renderMainOtpsPage();
}

function renderMainOtpsPage() {
    const grid = document.getElementById('otpGrid');
    if (!grid) return;
    
    const startIndex = 0;
    const endIndex = mainCurrentPage * MAIN_ITEMS_PER_PAGE;
    const visibleOtps = mainOtpsCache.slice(startIndex, endIndex);
    
    if (visibleOtps.length === 0 && mainOtpsCache.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-key"></i><h3>No OTPs yet</h3><p>OTP messages will appear here</p></div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    visibleOtps.forEach(o => {
        const card = createOptimizedOtpCard(o);
        fragment.appendChild(card);
    });
    
    while (grid.firstChild) {
        grid.removeChild(grid.firstChild);
    }
    grid.appendChild(fragment);
    
    // Add load more for main grid if needed
    let loadMoreMain = document.getElementById('loadMoreMain');
    const hasMore = endIndex < mainOtpsCache.length;
    
    if (!loadMoreMain && hasMore) {
        loadMoreMain = document.createElement('div');
        loadMoreMain.id = 'loadMoreMain';
        loadMoreMain.style.textAlign = 'center';
        loadMoreMain.style.marginTop = '20px';
        grid.parentNode.insertBefore(loadMoreMain, grid.nextSibling);
    }
    
    if (loadMoreMain) {
        if (hasMore) {
            loadMoreMain.style.display = 'block';
            loadMoreMain.innerHTML = `
                <button id="loadMoreMainBtn" class="btn btn-secondary">
                    <i class="fas fa-chevron-down"></i> Show More OTPs (${mainOtpsCache.length - endIndex} left)
                </button>
            `;
            document.getElementById('loadMoreMainBtn')?.addEventListener('click', () => {
                mainCurrentPage++;
                renderMainOtpsPage();
            });
        } else if (mainOtpsCache.length > MAIN_ITEMS_PER_PAGE) {
            loadMoreMain.style.display = 'block';
            loadMoreMain.innerHTML = `
                <div style="color: var(--text-muted); font-size: 12px; padding: 10px;">
                    <i class="fas fa-check-circle"></i> All ${mainOtpsCache.length} OTPs loaded
                </div>
            `;
        } else {
            loadMoreMain.style.display = 'none';
        }
    }
}

// Override renderOtps to use pagination
function renderOtps() {
    renderMainOtpsPage();
    applyFilter();
}

// Reset pagination when filter changes
const originalApplyFilter = applyFilter;
applyFilter = function() {
    mainCurrentPage = 1;
    originalApplyFilter();
    renderMainOtpsPage();
};
