/** --- THE INSTRUMENT CONTROLLER --- **/

document.addEventListener('DOMContentLoaded', () => {
    initChessToggles();
    initOrrery();
    initKatexLaboratory(); // Ensure KaTeX is explicitly called
    initProspectusDrawer(); // Restore Prospectus functionality
    initRecentlyPlayed(); // Initialize Spotify/YTMusic Recently Played
    initDailyLedger(); // Fetch and load active quote dynamically from Rust API
});



// 2. Tactics Toggle Logic
async function initChessToggles() {
    const ratingEl = document.getElementById('chess-rating');
    const labelEl = document.getElementById('chess-label');
    if (!ratingEl || !labelEl) return;
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
            const score = stats ? (stats[key]?.last?.rating || 'N/A') : '1027';
            
            // Update Icon
            if (iconContainer) iconContainer.innerHTML = icons[mode];
            
            ratingEl.innerHTML = `${score} <span class="text-xs opacity-50 font-sans tracking-widest">ELO</span>`;
            labelEl.innerText = `${mode} RATING // ARYAN18GUPTA`;
        });
    });

    if(stats) {
        const bullet = stats.chess_bullet?.last?.rating || '1027';
        ratingEl.innerHTML = `${bullet} <span class="text-xs opacity-50 font-sans tracking-widest">ELO</span>`;
    }
}

async function fetchChessStats(username) {
    try {
        const res = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
        if (!res.ok) return null;
        return await res.json();
    } catch(e) { return null; }
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

        // Calculate responsive orbit radii based on canvas size
        const maxRadius = Math.min(w, h) * 0.35;
        const radii = [maxRadius * 0.4, maxRadius * 0.7, maxRadius];

        // Draw Orbits with glow
        ctx.strokeStyle = '#B5935B';
        radii.forEach((r, i) => {
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

// ================================================================
// 6. PROSPECTUS — Scholar's Desk  (FlipBook-js integration)
// ================================================================

let _activeBookId = null;
let visorBook = null;
let expeditionBook = null;

function initProspectusDrawer() {
    const trigger  = document.getElementById('prospectus-btn');
    const modal    = document.getElementById('prospectus-modal');
    const closeBtn = document.getElementById('prospectus-close-btn');

    // Pre-initialize FlipBooks so they render on the desk immediately
    if (document.getElementById('visor-flipbook') && !visorBook) {
        visorBook = new FlipBook('visor-flipbook', {
            nextButton: document.getElementById('read-next-btn'),
            previousButton: document.getElementById('read-prev-btn'),
            canClose: true,
            arrowKeys: true,
            initialActivePage: 0,
            width: '100%',
            height: '100%',
        });
    }
    if (document.getElementById('expedition-flipbook') && !expeditionBook) {
        expeditionBook = new FlipBook('expedition-flipbook', {
            nextButton: document.getElementById('read-next-btn'),
            previousButton: document.getElementById('read-prev-btn'),
            canClose: true,
            arrowKeys: true,
            initialActivePage: 0,
            width: '100%',
            height: '100%',
        });
    }

    if (trigger && modal) {
        trigger.addEventListener('click', e => {
            e.preventDefault();
            modal.classList.toggle('is-visible');
            if (!modal.classList.contains('is-visible')) closeBook();
        });
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('is-visible');
            closeBook();
        });
    }
}

function openBooklet(bookId) {
    const visorContainer = document.getElementById('visor-container');
    const expContainer = document.getElementById('expedition-container');
    const controls = document.getElementById('reading-controls');

    if (bookId === 'visor' && visorContainer) {
        visorContainer.classList.add('is-reading');
        if (expContainer) expContainer.classList.add('dimmed');
    } else if (bookId === 'expeditions' && expContainer) {
        expContainer.classList.add('is-reading');
        if (visorContainer) visorContainer.classList.add('dimmed');
    }

    if (controls) {
        controls.classList.add('is-visible');
    }

    const tableCloseBtn = document.getElementById('prospectus-close-btn');
    if (tableCloseBtn) {
        tableCloseBtn.style.opacity = '0';
        tableCloseBtn.style.pointerEvents = 'none';
    }
}

function closeBook() {
    // Return all books to the desk
    const containers = document.querySelectorAll('.book-container');
    containers.forEach(c => {
        c.classList.remove('is-reading', 'dimmed');
    });

    const controls = document.getElementById('reading-controls');
    if (controls) {
        controls.classList.remove('is-visible');
    }

    // Restore table close button visibility
    const tableCloseBtn = document.getElementById('prospectus-close-btn');
    if (tableCloseBtn) {
        tableCloseBtn.style.opacity = '1';
        tableCloseBtn.style.pointerEvents = 'auto';
    }

    // Best-effort attempt to reset to cover
    try {
        if (visorBook && typeof visorBook.turnPage === 'function') visorBook.turnPage(0);
        if (expeditionBook && typeof expeditionBook.turnPage === 'function') expeditionBook.turnPage(0);
    } catch (e) {}
}

function closeProspectusModal() {
    const modal = document.getElementById('prospectus-modal');
    if (modal) {
        modal.classList.remove('is-visible');
        closeBook();
    }
}
window.closeProspectusModal = closeProspectusModal;

// Keydown ESC key listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProspectusModal();
    }
});


// 7. YouTube Music Recently Played Integration
function initRecentlyPlayed() {
    const statusDot = document.getElementById('music-status-dot');
    const statusText = document.getElementById('music-status-text');
    const titleEl = document.getElementById('music-title');
    const artistEl = document.getElementById('music-artist');
    const albumEl = document.getElementById('music-album');
    const linkEl = document.getElementById('music-link');
    const vinylEl = document.getElementById('music-vinyl');
    const coverEl = document.getElementById('music-cover');
    const defaultIcon = document.getElementById('music-default-icon');
    const tonearmEl = document.getElementById('music-tonearm');

    if (!titleEl) return;

    // Use a clean state variable in the closure to track the un-duplicated track title
    let currentTitle = titleEl.innerText;

    function checkTitleMarquee() {
        // We need to wait for layout/render to calculate width correctly
        setTimeout(() => {
            titleEl.classList.remove('animate-marquee');
            titleEl.style.transform = 'none';
            
            // Set titleEl to the clean original title to measure correctly
            titleEl.innerText = currentTitle;

            const parentWidth = titleEl.parentElement.clientWidth;
            const textWidth = titleEl.scrollWidth;

            if (textWidth > parentWidth && parentWidth > 0) {
                // Duplicate text with spacing to create a seamless looping circle marquee
                // Use strictly non-breaking spaces (\u00A0) to prevent collapsing space artifacts causing stutter
                const spacer = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"; // 12 non-breaking spaces
                titleEl.innerText = currentTitle + spacer + currentTitle + spacer;
                titleEl.classList.add('animate-marquee');
            }
        }, 200);
    }

    async function updateMusicData() {
        try {
            const response = await fetch('/api/recently-played');
            if (!response.ok) throw new Error('Network response not ok');
            const data = await response.json();

            if (data.status === 'playing') {
                // Update status header for active play
                statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]';
                statusText.innerText = 'NOW PLAYING';
                statusText.className = 'metadata text-[10px] tracking-[0.2em] uppercase text-emerald-500 font-bold';
                
                currentTitle = data.title;
                titleEl.innerText = currentTitle;
                artistEl.innerText = data.artist;
                albumEl.innerText = data.album;
                checkTitleMarquee();

                // Update link to track if videoId is available
                if (data.videoId) {
                    linkEl.href = `https://music.youtube.com/watch?v=${data.videoId}`;
                    linkEl.classList.remove('opacity-0', 'pointer-events-none');
                } else {
                    linkEl.classList.add('opacity-0', 'pointer-events-none');
                }

                // Update Cover Art
                if (data.thumbnailUrl) {
                    coverEl.style.backgroundImage = `url('${data.thumbnailUrl}')`;
                    if (defaultIcon) defaultIcon.classList.add('hidden');
                } else {
                    coverEl.style.backgroundImage = 'none';
                    if (defaultIcon) defaultIcon.classList.remove('hidden');
                }

                // Spin vinyl and place the tonearm/stylus
                vinylEl.style.animation = 'spin 12s linear infinite';
                tonearmEl.style.transform = 'rotate(0deg)';
            } else if (data.status === 'error') {
                throw new Error(data.message || 'Unknown backend error');
            } else {
                // Track is loaded but not active (recently played state)
                statusDot.className = 'w-2 h-2 rounded-full bg-zinc-600';
                statusText.innerText = 'RECENTLY PLAYING';
                statusText.className = 'metadata text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-bold';
                
                if (data.title) {
                    currentTitle = data.title;
                    titleEl.innerText = currentTitle;
                    artistEl.innerText = data.artist;
                    albumEl.innerText = data.album;
                    checkTitleMarquee();
                    
                    if (data.videoId) {
                        linkEl.href = `https://music.youtube.com/watch?v=${data.videoId}`;
                        linkEl.classList.remove('opacity-0', 'pointer-events-none');
                    } else {
                        linkEl.classList.add('opacity-0', 'pointer-events-none');
                    }
                    
                    if (data.thumbnailUrl) {
                        coverEl.style.backgroundImage = `url('${data.thumbnailUrl}')`;
                        if (defaultIcon) defaultIcon.classList.add('hidden');
                    } else {
                        coverEl.style.backgroundImage = 'none';
                        if (defaultIcon) defaultIcon.classList.remove('hidden');
                    }
                }
                
                // Slow down/stop vinyl and park the tonearm/stylus
                vinylEl.style.animation = 'none';
                tonearmEl.style.transform = 'rotate(-25deg)';
            }
        } catch (err) {
            console.error('Error fetching recently played track:', err);
            const isSetup = err.message && (err.message.includes('empty') || err.message.includes('browser.json') || err.message.includes('oauth.json') || err.message.includes('authenticate') || err.message.includes('headers') || err.message.includes('Auth'));
            
            statusDot.className = isSetup 
                ? 'w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.7)]' 
                : 'w-2 h-2 rounded-full bg-red-600 animate-pulse';
            statusText.innerText = isSetup ? 'SETUP REQUIRED' : 'OFFLINE';
            statusText.className = isSetup 
                ? 'metadata text-[10px] tracking-[0.2em] uppercase text-amber-500 font-bold' 
                : 'metadata text-[10px] tracking-[0.2em] uppercase text-red-500 font-bold';
                
            const fallbackText = isSetup ? 'Session Setup Needed' : 'Offline';
            currentTitle = fallbackText;
            titleEl.innerText = currentTitle;
            artistEl.innerText = isSetup ? 'Configure browser.json' : 'Service disconnected';
            albumEl.innerText = 'SYSTEM STANDBY';
            checkTitleMarquee();
            linkEl.classList.add('opacity-0', 'pointer-events-none');
            
            vinylEl.style.animation = 'none';
            tonearmEl.style.transform = 'rotate(-25deg)';
        }
    }

    // Add keyframes stylesheet dynamically for slow vinyl spinning
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    updateMusicData();
    // Poll every 15 seconds to keep it fresh
    setInterval(updateMusicData, 15000);
}

// 8. Daily Ledger Quote Integration
async function initDailyLedger() {
    const textEl = document.getElementById('ledger-quote-text');
    const authorEl = document.getElementById('ledger-quote-author');
    if (!textEl || !authorEl) return;

    try {
        const response = await fetch('/api/quote');
        if (response.ok) {
            const data = await response.json();
            textEl.innerText = `"${data.text}"`;
            authorEl.innerHTML = `&mdash; ${data.author}`;
        }
    } catch (e) {
        console.error('Failed to load daily quote from API:', e);
    }
}
