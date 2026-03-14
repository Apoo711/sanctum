/** --- THE INSTRUMENT CONTROLLER --- **/

document.addEventListener('DOMContentLoaded', () => {
    initVceCountdown();
    initChessToggles();
    initOrrery();
    initSidebar();
    initKatexLaboratory(); // Ensure KaTeX is explicitly called
    initProspectusDrawer(); // Restore Prospectus functionality
    initProspectusInteraction(); // Comprehensive interaction for passports/dossier
});

// 1. Sidebar Stealth Logic
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
}

// 2. Tactics Toggle Logic
async function initChessToggles() {
    const ratingEl = document.getElementById('chess-rating');
    const labelEl = document.getElementById('chess-label');
    const iconContainer = document.querySelector('.bento-tile:nth-child(3) .w-16'); // Select the icon wrapper
    const buttons = document.querySelectorAll('.mode-btn');
    
    const stats = await fetchChessStats('aryan18gupta');

    const icons = {
        BULLET: `<svg viewBox="0 0 100 100" class="w-full h-full" fill="none" stroke="#B5935B" stroke-width="3">
                    <path d="M30 60 Q50 10 70 60 L70 90 L30 90 Z" fill="#B5935B" fill-opacity="0.1"/>
                    <path d="M30 75 H70 M30 85 H70" stroke-opacity="0.5"/>
                 </svg>`,
        BLITZ: `<svg viewBox="0 0 100 100" class="w-full h-full" fill="none" stroke="#B5935B" stroke-width="3">
                    <path d="M60 10 L25 55 H50 L40 90 L75 45 H50 L60 10 Z" fill="#B5935B" fill-opacity="0.2" stroke-linejoin="round"/>
                </svg>`,
        RAPID: `<svg viewBox="0 0 100 100" class="w-full h-full" fill="none" stroke="#B5935B" stroke-width="3">
                    <circle cx="50" cy="55" r="30" fill="#B5935B" fill-opacity="0.1"/>
                    <path d="M50 35 V55 L65 65" stroke-linecap="round"/>
                    <path d="M40 15 H60 M50 15 V25" stroke-width="4"/>
                    <path d="M75 25 L85 15" stroke-width="4"/>
                </svg>`
    };
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            const key = `chess_${mode.toLowerCase()}`;
            const score = stats ? (stats[key]?.last?.rating || 'N/A') : '713';
            
            // Update Icon
            if (iconContainer) iconContainer.innerHTML = icons[mode];
            
            ratingEl.innerHTML = `${score} <span class="text-xs opacity-50 font-sans tracking-widest">ELO</span>`;
            labelEl.innerText = `${mode} RATING // ARYAN18GUPTA`;
        });
    });

    if(stats) {
        const rapid = stats.chess_rapid?.last?.rating || '713';
        ratingEl.innerHTML = `${rapid} <span class="text-xs opacity-50 font-sans tracking-widest">ELO</span>`;
    }
}

async function fetchChessStats(username) {
    try {
        const res = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
        if (!res.ok) return null;
        return await res.json();
    } catch(e) { return null; }
}

// 3. VCE Epoch Tracker with expanded content
function initVceCountdown() {
    const el = document.getElementById('vce-countdown');
    const target = new Date('2026-10-26T09:00:00').getTime();

    function update() {
        const now = new Date().getTime();
        const dist = target - now;
        
        const d = Math.floor(dist / (1000 * 60 * 60 * 24));
        const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((dist % (1000 * 60)) / 1000);

        const pad = (n) => String(n).padStart(2, '0');
        
        // Enlarged scale and increased gap for numbers
        el.innerHTML = `
            <div class="flex flex-col items-center gap-2">
                <span class="vce-number vce-number-glow font-bold text-[2.25rem]">${pad(d)}</span>
            </div>
            <div class="flex flex-col items-center gap-2">
                <span class="vce-number vce-number-glow font-bold text-[2.25rem]">${pad(h)}</span>
            </div>
            <div class="flex flex-col items-center gap-2">
                <span class="vce-number vce-number-glow font-bold text-[2.25rem]">${pad(m)}</span>
            </div>
            <div class="flex flex-col items-center gap-2">
                <span class="vce-number vce-number-glow font-bold text-[2.25rem]">${pad(s)}</span>
            </div>
        `;
    }

    update();
    setInterval(update, 1000);
}

// 4. The Orrery Canvas (Enhanced Spacey Aesthetic)
function initOrrery() {
    const canvas = document.getElementById('orrery');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');

    // Generate static stars for the starfield
    const stars = Array.from({ length: 150 }, () => ({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.5,
        opacity: Math.random()
    }));

    function resize() {
        const box = canvas.parentElement.getBoundingClientRect();
        canvas.width = box.width;
        canvas.height = box.height;
    }
    window.addEventListener('resize', resize);
    resize();

    function draw() {
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);
        
        // Draw Starfield
        ctx.fillStyle = "#F4F1EA";
        stars.forEach(star => {
            ctx.globalAlpha = star.opacity * (0.5 + Math.sin(Date.now() * 0.001 + star.x) * 0.5);
            ctx.beginPath();
            ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;

        const now = new Date();
        const ms = now.getMilliseconds();
        const s = now.getSeconds() + ms / 1000;
        const m = now.getMinutes() + s / 60;
        const h_rot = (now.getHours() % 12) + m / 60;

        ctx.save();
        ctx.translate(w/2, h/2);
        ctx.scale(1, 0.7); // 3D Perspective

        // Draw Orbits with glow
        ctx.strokeStyle = '#B5935B';
        [70, 120, 180].forEach((r, i) => {
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(181, 147, 91, 0.2)';
            ctx.globalAlpha = 0.15;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI*2);
            ctx.stroke();

            // Draw Planets/Hands with Bloom
            ctx.globalAlpha = 0.9;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#B5935B';
            const rot = (i === 0 ? h_rot/12 : (i === 1 ? m/60 : s/60)) * Math.PI*2 - Math.PI/2;
            
            // Draw Hand line
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(Math.cos(rot)*r, Math.sin(rot)*r);
            ctx.stroke();
            
            // Planet Dot
            ctx.beginPath();
            ctx.arc(Math.cos(rot)*r, Math.sin(rot)*r, i === 0 ? 5 : (i === 1 ? 4 : 3), 0, Math.PI*2);
            ctx.fillStyle = '#B5935B';
            ctx.fill();
        });

        // Central Sun with heavy glow
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#B5935B';
        ctx.beginPath();
        ctx.arc(0,0, 6, 0, Math.PI*2);
        ctx.fillStyle = '#B5935B';
        ctx.fill();

        ctx.restore();
        requestAnimationFrame(draw);
    }
    draw();
}

// 5. KaTeX Engine Render
function initKatexLaboratory() {
    const inputEl = document.getElementById('math-input');
    const outputEl = document.getElementById('math-output');

    if (inputEl && outputEl && typeof katex !== 'undefined') {
        const inputString = inputEl.value;
        try {
            katex.render(inputString, outputEl, {
                displayMode: true,
                throwOnError: false,
                macros: { "\\color": "\\textcolor{#1A1A1A}" }
            });
            outputEl.style.color = '#1A1A1A';
        } catch (e) {
            outputEl.innerHTML = `<span style="color:#B5935B">Manuscript Error</span>`;
        }
    }
}

// 6. Prospectus Interaction & Desk Logic
function initProspectusDrawer() {
    const trigger = document.getElementById('prospectus-btn');
    const overlay = document.getElementById('prospectus-overlay');
    
    if (trigger && overlay) {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            overlay.classList.toggle('hidden');
            // Reset items when closing
            if (overlay.classList.contains('hidden')) {
                collapseAllProspectusItems();
            }
        });
    }
}

// Global state for prospectus items
window.prospectusState = {
    vietnam: { current: 1, total: 3 },
    cambodia: { current: 1, total: 3 },
    visor: { current: 1, total: 3 }
};

function initProspectusInteraction() {
    const items = document.querySelectorAll('.passport-booklet, [data-booklet="visor"]');
    
    items.forEach(item => {
        // Remove existing arrow-based navigation if any
        const navContainer = item.querySelector('.page-navigation');
        if (navContainer) navContainer.remove();

        item.addEventListener('click', (e) => {
            const bookletId = item.getAttribute('data-booklet') || (item.innerText.toLowerCase().includes('vietnam') ? 'vietnam' : 'cambodia');
            
            // If item is not enlarged/open, enlarge it and collapse others
            if (!item.classList.contains('is-open') && !item.classList.contains('enlarged')) {
                collapseAllProspectusItems();
                item.classList.add('is-open', 'enlarged', 'scale-125', 'z-50');
                return;
            }

            // If already open, handle page flipping
            const rect = item.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const isLeftSide = clickX < rect.width / 2;

            if (isLeftSide) {
                advancePage(bookletId);
            } else {
                regressPage(bookletId);
            }
        });
    });
}

function advancePage(booklet) {
    let state = window.prospectusState[booklet];
    if (state.current < state.total) {
        updateBookletPage(booklet, state.current, state.current + 1);
        state.current++;
    }
}

function regressPage(booklet) {
    let state = window.prospectusState[booklet];
    if (state.current > 1) {
        updateBookletPage(booklet, state.current, state.current - 1);
        state.current--;
    }
}

function updateBookletPage(booklet, oldPage, newPage) {
    const bookletEl = document.querySelector(`[data-booklet="${booklet}"]`) || 
                      (booklet === 'vietnam' ? document.querySelector('.passport-booklet:nth-child(1)') : document.querySelector('.passport-booklet:nth-child(2)'));
    
    if (!bookletEl) return;

    const oldPageEl = bookletEl.querySelector(`[id$="-page-${oldPage}"]`);
    const newPageEl = bookletEl.querySelector(`[id$="-page-${newPage}"]`);

    if (oldPageEl) {
        oldPageEl.classList.replace('flex', 'hidden');
        oldPageEl.classList.remove('active');
    }
    if (newPageEl) {
        newPageEl.classList.replace('hidden', 'flex');
        newPageEl.classList.add('active');
    }
}

function collapseAllProspectusItems() {
    const items = document.querySelectorAll('.passport-booklet, [data-booklet="visor"]');
    items.forEach(item => {
        item.classList.remove('is-open', 'enlarged', 'scale-125', 'z-50');
        // Reset to first page
        const bookletId = item.getAttribute('data-booklet') || (item.innerText.toLowerCase().includes('vietnam') ? 'vietnam' : 'cambodia');
        if (window.prospectusState[bookletId].current !== 1) {
            updateBookletPage(bookletId, window.prospectusState[bookletId].current, 1);
            window.prospectusState[bookletId].current = 1;
        }
    });
}