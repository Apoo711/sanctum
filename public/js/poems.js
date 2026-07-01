document.addEventListener('DOMContentLoaded', () => {
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeHTML(htmlString) {
        if (!htmlString) return '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const allowedTags = ['SPAN', 'EM', 'B', 'I', 'U', 'STRONG', 'BR'];
        const allowedAttributes = {
            'SPAN': ['class', 'style']
        };

        function cleanNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.cloneNode(true);
            }
            if (node.nodeType === Node.ELEMENT_NODE && allowedTags.includes(node.tagName)) {
                const cleanEl = document.createElement(node.tagName.toLowerCase());
                const allowedAttrs = allowedAttributes[node.tagName] || [];
                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];
                    if (allowedAttrs.includes(attr.name)) {
                        if (attr.name === 'class') {
                            const safeClasses = attr.value.split(/\s+/).filter(c => /^[a-zA-Z0-9_-]+$/.test(c));
                            if (safeClasses.length > 0) {
                                cleanEl.setAttribute('class', safeClasses.join(' '));
                            }
                        } else if (attr.name === 'style') {
                            if (!attr.value.toLowerCase().includes('javascript:') && !attr.value.toLowerCase().includes('expression(')) {
                                cleanEl.setAttribute('style', attr.value);
                            }
                        }
                    }
                }
                for (let i = 0; i < node.childNodes.length; i++) {
                    cleanEl.appendChild(cleanNode(node.childNodes[i]));
                }
                return cleanEl;
            }
            return document.createTextNode(node.textContent);
        }

        const container = document.createElement('div');
        const childNodes = Array.from(doc.body.childNodes);
        for (const child of childNodes) {
            container.appendChild(cleanNode(child));
        }
        return container.innerHTML;
    }

    const lockScreen = document.getElementById('lock-screen');
    const codexScreen = document.getElementById('codex-screen');
    const authForm = document.getElementById('auth-form');
    const passkeyInput = document.getElementById('passkey-input');
    const authError = document.getElementById('auth-error');
    const submitBtn = document.getElementById('submit-btn');
    const lockBtn = document.getElementById('lock-btn');
    
    const scrollModeBtn = document.getElementById('view-mode-scroll');
    const bookModeBtn = document.getElementById('view-mode-book');
    const scrollDot = document.getElementById('scroll-dot');
    const bookDot = document.getElementById('book-dot');
    
    const scrollContainer = document.getElementById('scroll-mode-container');
    const bookContainer = document.getElementById('poems-book-container');
    
    const poemsContainer = document.getElementById('poems-container');
    const colLeft = document.getElementById('poems-col-left');
    const colRight = document.getElementById('poems-col-right');
    const sidebarList = document.getElementById('poems-sidebar-list');
    const sidebar = document.getElementById('poems-sidebar');
    
    let currentMode = 'scroll';
    let poemsData = [];
    let currentFlipBookInstance = null;
    let sidebarObserver = null;

    // View Mode Switcher logic
    if (scrollModeBtn && bookModeBtn) {
        scrollModeBtn.addEventListener('click', () => {
            if (currentMode === 'scroll') return;
            currentMode = 'scroll';
            document.body.classList.remove('in-book-mode');
            updateModeSelector();
            
            // Hide book, show scroll and sidebar
            bookContainer.classList.add('hidden');
            scrollContainer.classList.remove('hidden');
            if (sidebar) sidebar.classList.remove('hidden');
            
            // Render scroll view
            renderScrollMode(poemsData);
        });

        bookModeBtn.addEventListener('click', () => {
            if (currentMode === 'book') return;
            currentMode = 'book';
            document.body.classList.add('in-book-mode');
            updateModeSelector();
            
            // Hide scroll and sidebar, show book
            scrollContainer.classList.add('hidden');
            bookContainer.classList.remove('hidden');
            if (sidebar) sidebar.classList.add('hidden');
            
            // Render book view
            renderBookMode(poemsData);
        });
    }

    function updateModeSelector() {
        if (currentMode === 'scroll') {
            scrollModeBtn.classList.remove('text-[#B5935B]/50');
            scrollModeBtn.classList.add('text-sanctum-accent', 'font-bold');
            scrollDot.classList.remove('bg-transparent');
            scrollDot.classList.add('bg-sanctum-accent');
            
            bookModeBtn.classList.remove('text-sanctum-accent', 'font-bold');
            bookModeBtn.classList.add('text-[#B5935B]/50');
            bookDot.classList.remove('bg-sanctum-accent');
            bookDot.classList.add('bg-transparent');
        } else {
            bookModeBtn.classList.remove('text-[#B5935B]/50');
            bookModeBtn.classList.add('text-sanctum-accent', 'font-bold');
            bookDot.classList.remove('bg-transparent');
            bookDot.classList.add('bg-sanctum-accent');
            
            scrollModeBtn.classList.remove('text-sanctum-accent', 'font-bold');
            scrollModeBtn.classList.add('text-[#B5935B]/50');
            scrollDot.classList.remove('bg-sanctum-accent');
            scrollDot.classList.add('bg-transparent');
        }
    }

    // Check for cached passkey
    const cachedKey = sessionStorage.getItem('poems_passkey') || localStorage.getItem('poems_passkey');

    if (cachedKey) {
        attemptUnlock(cachedKey);
    } else {
        showScreen(lockScreen);
    }

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const passkey = passkeyInput.value;
        attemptUnlock(passkey);
    });

    lockBtn.addEventListener('click', () => {
        sessionStorage.removeItem('poems_passkey');
        localStorage.removeItem('poems_passkey');
        passkeyInput.value = '';
        document.body.classList.remove('in-book-mode');
        
        // Clean up resources
        if (sidebarObserver) {
            sidebarObserver.disconnect();
            sidebarObserver = null;
        }
        if (currentFlipBookInstance) {
            currentFlipBookInstance = null;
        }
        
        // Hide sidebar
        if (sidebar) sidebar.classList.add('hidden');
        
        // Fade out codex and fade in lock screen
        hideScreen(codexScreen, () => {
            if (colLeft && colRight) {
                colLeft.innerHTML = '';
                colRight.innerHTML = '';
            }
            if (sidebarList) {
                sidebarList.innerHTML = '';
            }
            const flipbookEl = document.getElementById('poems-flipbook');
            if (flipbookEl) {
                flipbookEl.innerHTML = '';
            }
            showScreen(lockScreen);
        });
    });

    async function attemptUnlock(passkey) {
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-sanctum-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Deciphering...</span>
        `;
        authError.classList.add('opacity-0');
        authError.innerText = '';
        passkeyInput.removeAttribute('aria-invalid');

        try {
            const response = await fetch('/api/poems', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: passkey })
            });

            if (response.status === 401) {
                throw new Error('CORRUPT_PASSKEY_CIPHER');
            }
            
            if (!response.ok) {
                throw new Error('GATEWAY_OFFLINE');
            }

            poemsData = await response.json();
            
            // Store password for persistence
            sessionStorage.setItem('poems_passkey', passkey);
            localStorage.setItem('poems_passkey', passkey);

            renderCurrentView();

            hideScreen(lockScreen, () => {
                showScreen(codexScreen);
                // Show sidebar if in scroll mode
                if (currentMode === 'scroll' && sidebar) {
                    sidebar.classList.remove('hidden');
                }
            });

        } catch (err) {
            console.error('[Vault Access Error]', err);
            sessionStorage.removeItem('poems_passkey');
            localStorage.removeItem('poems_passkey');
            
            authError.innerText = err.message === 'CORRUPT_PASSKEY_CIPHER' 
                ? 'INVALID PASSKEY CIPHER // ACCESS DENIED' 
                : 'TRANSMISSION ERROR // PORTAL OFFLINE';
            authError.classList.remove('opacity-0');
            passkeyInput.setAttribute('aria-invalid', 'true');
            
            showScreen(lockScreen);
            if (sidebar) sidebar.classList.add('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    const overlayBackBtn = document.getElementById('overlay-back-btn');
    if (overlayBackBtn) {
        overlayBackBtn.addEventListener('click', () => {
            if (scrollModeBtn) scrollModeBtn.click();
        });
    }

    function renderCurrentView() {
        if (currentMode === 'scroll') {
            renderScrollMode(poemsData);
        } else {
            renderBookMode(poemsData);
        }
    }

    function renderScrollMode(poems) {
        // Reset columns and check for empty states
        if (colLeft && colRight) {
            colLeft.innerHTML = '';
            colRight.innerHTML = '';
        }
        if (sidebarList) {
            sidebarList.innerHTML = '';
        }
        
        if (!poems || poems.length === 0) {
            poemsContainer.innerHTML = `
                <div class="col-span-1 md:col-span-2 text-center py-16">
                    <p class="technical text-[#B5935B]/40 text-xs tracking-widest uppercase mb-3">EMPTY_RECORD</p>
                    <p class="font-serif text-[#F4F1EA]/30 text-lg italic">The volume is empty. No verses have been compiled.</p>
                </div>
            `;
            return;
        }

        // Restore column structure if switching back from empty state
        if (!colLeft || !colRight) {
            return;
        }

        poems.forEach((poem, index) => {
            const card = document.createElement('div');
            card.id = `poem-card-${index}`;
            card.className = `poem-card relative border border-sanctum-accent/15 hover:border-sanctum-accent/40 rounded-xl p-5 md:p-8 transition-all duration-500 flex flex-col justify-between hover:shadow-xl hover:shadow-[#B5935B]/5 overflow-hidden opacity-0 transform translate-y-4 w-full break-inside-avoid`;
            card.style.animationDelay = `${index * 80}ms`;
            card.style.animation = 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';

            // format date
            let formattedDate = poem.date;
            try {
                formattedDate = new Date(poem.date).toLocaleDateString('en-AU', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            } catch(e) {}

            card.innerHTML = `
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4 border-b border-sanctum-accent/10 pb-3">
                        <span class="technical text-[9px] text-[#B5935B]/40 uppercase tracking-widest">Entry #${index + 1}</span>
                        <time class="technical text-[9px] text-[#B5935B]/40 uppercase tracking-widest" datetime="${escapeHTML(poem.date)}">
                            ${escapeHTML(formattedDate)}
                        </time>
                    </div>
                    
                    <h3 class="poem-title-script text-2xl md:text-3xl text-[#B5935B] mb-5">
                        ${escapeHTML(poem.title)}
                    </h3>
                    
                    <div class="poem-body whitespace-pre-wrap font-serif text-sm text-[#F4F1EA]/85 leading-loose italic pl-4 md:pl-6 border-l-[0.5px] border-[#B5935B]/25 py-2 mb-4 select-none">${sanitizeHTML(poem.content.trim())}</div>
                </div>
                
                <div class="flex justify-end border-t border-sanctum-accent/5 pt-3">
                    <span class="technical text-[8px] text-sanctum-accent/30 tracking-[0.2em] uppercase">Fragment // End</span>
                </div>
            `;
            
            // Distribute odd entries (Entry #1, #3...) to left, evens to right
            if (index % 2 === 0) {
                colLeft.appendChild(card);
            } else {
                colRight.appendChild(card);
            }

            // Append to scroll-spy sidebar index
            if (sidebarList) {
                const li = document.createElement('li');
                li.className = `sidebar-item-${index}`;
                
                const link = document.createElement('a');
                link.href = `#poem-card-${index}`;
                link.className = `text-[#F4F1EA]/50 hover:text-sanctum-accent transition-colors block py-0.5 truncate text-[10px] uppercase tracking-wider font-mono`;
                link.innerText = poem.title;
                
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.getElementById(`poem-card-${index}`);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });

                li.appendChild(link);
                sidebarList.appendChild(li);
            }
        });

        // Trigger KaTeX rendering on the container if loaded
        if (window.renderMathInElement) {
            try {
                window.renderMathInElement(poemsContainer, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false},
                        {left: "\\(", right: "\\)", display: false},
                        {left: "\\[", right: "\\]", display: true}
                    ]
                });
            } catch(e) {
                console.error('[KaTeX Render Error]', e);
            }
        }

        // Initialize scroll-spy
        initScrollSpy();
    }

    // Auto-pagination logic for Book Mode
    function paginatePoem(poem, maxLines = 16) {
        const paragraphs = poem.content.trim().split(/\n\n+/);
        const pages = [];
        let currentPageLines = [];
        let currentPageParagraphs = [];
        
        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i];
            const paraLines = para.split('\n');
            
            // If a single paragraph is extremely long (rare for poetry, but possible)
            if (paraLines.length > maxLines && currentPageLines.length === 0) {
                pages.push({
                    title: poem.title,
                    content: para,
                    isContinuation: false,
                    part: 1
                });
                continue;
            }
            
            // Estimate lines (lines + 2 for blank lines separation between paragraphs)
            const estimatedLines = currentPageLines.length + paraLines.length + (currentPageLines.length > 0 ? 2 : 0);
            
            if (estimatedLines > maxLines) {
                // Push current page
                pages.push({
                    title: poem.title,
                    content: currentPageParagraphs.join('\n\n'),
                    isContinuation: pages.length > 0,
                    part: pages.length + 1
                });
                currentPageLines = paraLines;
                currentPageParagraphs = [para];
            } else {
                currentPageLines = currentPageLines.concat(paraLines);
                currentPageParagraphs.push(para);
            }
        }
        
        if (currentPageParagraphs.length > 0) {
            pages.push({
                title: poem.title,
                content: currentPageParagraphs.join('\n\n'),
                isContinuation: pages.length > 0,
                part: pages.length + 1
            });
        }
        
        return pages;
    }

    function renderBookMode(poems) {
        const flipbookEl = document.getElementById('poems-flipbook');
        if (!flipbookEl) return;
        
        flipbookEl.innerHTML = '';
        
        // Generate all pages dynamically
        let allContentPages = [];
        poems.forEach((poem, index) => {
            const paginated = paginatePoem(poem, 16);
            paginated.forEach((page, pageIndex) => {
                allContentPages.push({
                    ...page,
                    entryIndex: index + 1,
                    date: poem.date
                });
            });
        });

        const pagesHtml = [];

        // 1. Front Cover (Outer)
        pagesHtml.push(`
            <div class="c-flipbook__page face-cover-dark" style="padding: 1.5rem;">
                <div style="height: 100%; width: 100%; border: 1px solid rgba(212, 175, 55, 0.4); outline: 3px double rgba(212, 175, 55, 0.25); outline-offset: -8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.25rem; gap: 0.5rem; position: relative;">
                    <div style="color: rgba(212, 175, 55, 0.75); font-size: 2rem; margin-bottom: 0.5rem; font-family: serif; user-select: none;">❦</div>
                    <h2 class="font-script text-3xl md:text-4xl text-sanctum-accent text-center leading-tight" style="color: #D4AF37;">The Codex of Verse</h2>
                    <div style="height: 1px; width: 60px; background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.4), transparent); margin: 0.75rem 0;"></div>
                    <p style="font-family: 'EB Garamond', serif; font-size: 0.75rem; font-style: italic; color: rgba(244, 241, 234, 0.75); text-align: center; max-w: 220px; line-height: 1.6;">
                        A compilation of private lyrics, silent verses, and personal reflections.
                    </p>
                    <div style="position: absolute; bottom: 1.5rem; font-family: 'EB Garamond', serif; font-size: 0.65rem; letter-spacing: 0.2em; color: rgba(212, 175, 55, 0.45); text-transform: uppercase;">
                        MCMXXVI
                    </div>
                </div>
            </div>
        `);

        // 2. Inside Front Cover
        pagesHtml.push(`
            <div class="c-flipbook__page face-cover-dark" style="padding: 1.5rem;">
                <div style="height: 100%; width: 100%; border: 1px solid rgba(212, 175, 55, 0.2); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.25rem;">
                    <p style="font-family: 'EB Garamond', serif; font-size: 0.8rem; font-style: italic; color: rgba(244, 241, 234, 0.7); text-align: center; line-height: 2.1; max-w: 240px;">
                        "To feel, to love, to write—<br>
                        these are the quiet stars<br>
                        guiding my pen through<br>
                        the silent watch of the night."
                    </p>
                    <div style="height: 1px; width: 30px; background: rgba(212, 175, 55, 0.25); margin-top: 1.5rem;"></div>
                </div>
            </div>
        `);

        // 3. Dynamic Poem Pages
        allContentPages.forEach((page, index) => {
            let formattedDate = page.date;
            try {
                formattedDate = new Date(page.date).toLocaleDateString('en-AU', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
            } catch(e) {}
            
            const escapedTitle = escapeHTML(page.title);
            const titleHtml = page.isContinuation 
                ? `${escapedTitle} <span class="text-xs font-serif font-normal italic opacity-50">(Part ${page.part})</span>` 
                : escapedTitle;
            
            pagesHtml.push(`
                <div class="c-flipbook__page bg-[#F4F1EA] text-[#020202]">
                    <div style="height:100%;display:flex;flex-direction:column;padding:1.75rem;position:relative;">
                        <div style="display:flex;justify-content:between;align-items:center;margin-bottom:0.4rem;font-family:'JetBrains Mono',monospace;font-size:0.45rem;letter-spacing:0.12em;color:rgba(2,2,2,0.45);text-transform:uppercase;">
                            <span>Entry #${page.entryIndex}</span>
                            <span style="margin-left:auto;">${escapeHTML(formattedDate)}</span>
                        </div>
                        <div style="height:1px;background:linear-gradient(to right,rgba(181,147,91,0.4),transparent);margin-bottom:0.75rem;"></div>
                        
                        <h4 class="poem-title-script text-xl md:text-2xl text-[#B5935B] mb-3" style="font-family:'Pinyon Script',cursive;letter-spacing:normal;">
                            ${titleHtml}
                        </h4>
                        
                        <div class="poem-body whitespace-pre-wrap font-serif text-[12px] md:text-[13px] text-[#020202]/85 leading-relaxed italic pl-4 border-l-[0.5px] border-[#B5935B]/40 py-1 mb-3 select-none" style="font-family:'EB Garamond',serif;">${sanitizeHTML(page.content.trim())}</div>
                        
                        <div style="position:absolute;bottom:0.75rem;left:0;right:0;font-family:'JetBrains Mono',monospace;font-size:0.42rem;letter-spacing:0.2em;color:rgba(2,2,2,0.3);text-align:center;">PG. ${index + 1}</div>
                    </div>
                </div>
            `);
        });

        // 4. Back Cover Inside and Out
        let totalPagesSoFar = 2 + allContentPages.length;
        if (totalPagesSoFar % 2 !== 0) {
            // Add blank page
            pagesHtml.push(`
                <div class="c-flipbook__page bg-[#F4F1EA] text-[#020202]">
                    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;">
                        <div style="font-family:'EB Garamond',serif;font-size:0.8rem;font-style:italic;opacity:0.25;letter-spacing:0.1em;">This page is intentionally left blank.</div>
                    </div>
                </div>
            `);
            totalPagesSoFar++;
        }

        // Inside Back Cover
        pagesHtml.push(`
            <div class="c-flipbook__page face-cover-dark" style="padding: 1.5rem;">
                <div style="height: 100%; width: 100%; border: 1px solid rgba(212, 175, 55, 0.2); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.25rem;">
                    <p style="font-family: 'EB Garamond', serif; font-size: 0.8rem; font-style: italic; color: rgba(244, 241, 234, 0.55); text-align: center; letter-spacing: 0.1em; text-transform: uppercase;">
                        Finis
                    </p>
                    <div style="height: 1px; width: 20px; background: rgba(212, 175, 55, 0.2); margin-top: 1rem;"></div>
                </div>
            </div>
        `);

        // Outside Back Cover
        pagesHtml.push(`
            <div class="c-flipbook__page face-cover-dark" style="padding: 1.5rem;">
                <div style="height: 100%; width: 100%; border: 1px solid rgba(212, 175, 55, 0.4); outline: 3px double rgba(212, 175, 55, 0.25); outline-offset: -8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.25rem; gap: 0.5rem; position: relative;">
                    <div style="color: rgba(212, 175, 55, 0.5); font-size: 1.5rem; margin-bottom: 0.25rem; font-family: serif; user-select: none;">❦</div>
                    <div style="font-family: 'EB Garamond', serif; font-size: 0.7rem; letter-spacing: 0.2em; color: rgba(212, 175, 55, 0.45); text-transform: uppercase;">
                        Sanctum Press
                    </div>
                </div>
            </div>
        `);

        flipbookEl.innerHTML = pagesHtml.join('');

        const nextBtn = document.getElementById('poems-book-next-btn');
        const prevBtn = document.getElementById('poems-book-prev-btn');
        const pageNumEl = document.getElementById('poems-book-page-num');

        // Wait a frame to let DOM render
        setTimeout(() => {
            // Patch FlipBook prototype to implement custom romantic page grouping
            FlipBook.prototype.turnPage = function(action) {
                const totalPages = this.pages.length;
                const classNames = this.classNames;
                const el = this.el;
                
                const activePages = this.getActivePages();
                
                function getGroupOfActivePages(active) {
                    if (active.length === 0) return 0;
                    if (active.length === 1) {
                        if (active[0] === 0) return 0;
                        return totalPages / 2; // Last group (e.g. 8 when totalPages is 16)
                    }
                    return Math.floor((active[0] + 1) / 2);
                }

                function getPagesOfGroup(g) {
                    if (g === 0) return [0];
                    if (g === totalPages / 2) return [totalPages - 1];
                    return [2 * g - 1, 2 * g];
                }

                const currentGroup = getGroupOfActivePages(activePages);
                let targetGroup = currentGroup;

                if (action === 'forward') {
                    if (currentGroup < totalPages / 2) {
                        targetGroup = currentGroup + 1;
                    } else {
                        return;
                    }
                } else if (action === 'back') {
                    if (currentGroup > 0) {
                        targetGroup = currentGroup - 1;
                    } else {
                        return;
                    }
                } else if (typeof action === 'number') {
                    targetGroup = getGroupOfActivePages([action]);
                    if (targetGroup === currentGroup) return;
                }

                const pages = el.querySelectorAll(`.${classNames.page}`);
                const currentIndices = getPagesOfGroup(currentGroup);
                const targetIndices = getPagesOfGroup(targetGroup);

                // Clear any existing animating classes
                pages.forEach(p => p.classList.remove(classNames.isAnimating, classNames.wasActive));

                // Set was-active on current pages, and remove is-active
                currentIndices.forEach(idx => {
                    const pageEl = pages[idx];
                    if (pageEl) {
                        pageEl.classList.remove(classNames.isActive);
                        pageEl.classList.add(classNames.wasActive);
                    }
                });

                // Set is-active on target pages
                targetIndices.forEach(idx => {
                    const pageEl = pages[idx];
                    if (pageEl) {
                        pageEl.classList.add(classNames.isActive);
                    }
                });

                // Determine which pages are animating
                let animatingPages = [];
                if (action === 'forward' || (typeof action === 'number' && targetGroup > currentGroup)) {
                    const flipPageIdx = currentIndices[currentIndices.length - 1];
                    const receivePageIdx = targetIndices[0];
                    animatingPages = [pages[flipPageIdx], pages[receivePageIdx]];
                } else {
                    const flipPageIdx = currentIndices[0];
                    const receivePageIdx = targetIndices[targetIndices.length - 1];
                    animatingPages = [pages[flipPageIdx], pages[receivePageIdx]];
                }

                // Add animating class
                animatingPages.forEach(p => {
                    if (p) p.classList.add(classNames.isAnimating);
                });

                // Handle container classes for centering covers
                el.classList.remove(classNames.atFrontCover, classNames.atBackCover);
                if (targetGroup === 0) {
                    el.classList.add(classNames.atFrontCover);
                } else if (targetGroup === totalPages / 2) {
                    el.classList.add(classNames.atBackCover);
                }

                // Set up transition end handler to clean up classes
                let transitionEndedCount = 0;
                const animatingLength = animatingPages.filter(Boolean).length;
                const onTransitionEnd = () => {
                    animatingPages.forEach(p => {
                        if (p) p.classList.remove(classNames.isAnimating);
                    });
                    currentIndices.forEach(idx => {
                        const pageEl = pages[idx];
                        if (pageEl) pageEl.classList.remove(classNames.wasActive);
                    });
                };

                animatingPages.forEach(p => {
                    if (p) {
                        const clear = () => {
                            p.removeEventListener('transitionend', clear);
                            p.removeEventListener('webkitTransitionEnd', clear);
                            transitionEndedCount++;
                            if (transitionEndedCount >= animatingLength) {
                                onTransitionEnd();
                            }
                        };
                        p.addEventListener('transitionend', clear);
                        p.addEventListener('webkitTransitionEnd', clear);
                    }
                });

                if (!this.Modernizr.csstransforms3d) {
                    onTransitionEnd();
                }

                if (this.options.onPageTurn) {
                    this.options.onPageTurn(el, { pagesActive: targetIndices, children: this.pages });
                }
            };

            currentFlipBookInstance = new FlipBook('poems-flipbook', {
                nextButton: nextBtn,
                previousButton: prevBtn,
                canClose: true,
                arrowKeys: true,
                initialActivePage: 0,
                width: '100%',
                height: '100%',
                onPageTurn: (el, info) => {
                    updateBookCounter(pageNumEl, totalPagesSoFar);
                }
            });

            updateBookCounter(pageNumEl, totalPagesSoFar);
        }, 50);
    }

    function updateBookCounter(pageNumEl, totalPagesSoFar) {
        if (!currentFlipBookInstance || !pageNumEl) return;
        const active = currentFlipBookInstance.getActivePages();
        const firstActive = active[0];

        if (active.length === 1) {
            if (firstActive === 0) {
                pageNumEl.innerText = 'COVER';
            } else if (firstActive === totalPagesSoFar - 1) {
                pageNumEl.innerText = 'BACK COVER';
            } else {
                pageNumEl.innerText = `PAGE ${firstActive} / ${totalPagesSoFar - 2}`;
            }
        } else if (active.length === 2) {
            pageNumEl.innerText = `PAGES ${active[0]} - ${active[1]} OF ${totalPagesSoFar - 2}`;
        }
    }

    function updateSidebarState(activeIdx) {
        const listItems = document.querySelectorAll('#poems-sidebar-list li');
        if (listItems.length === 0) return;

        const N = listItems.length;
        const itemHeight = 28; // fixed height in CSS

        // 1. Calculate translation offset to center the active item
        let translateY = 0;
        if (N > 5) {
            const idealOffset = -(activeIdx - 2) * itemHeight;
            const minOffset = -(N - 5) * itemHeight;
            translateY = Math.max(minOffset, Math.min(0, idealOffset));
        }
        
        const sidebarList = document.getElementById('poems-sidebar-list');
        if (sidebarList) {
            sidebarList.style.transform = `translateY(${translateY}px)`;
        }

        // 2. Update styles and opacity for all items
        listItems.forEach((li, index) => {
            const distance = Math.abs(index - activeIdx);
            const link = li.querySelector('a');

            if (index === activeIdx) {
                // Active item styling
                li.classList.add('border-sanctum-accent');
                li.style.opacity = '1';
                li.style.pointerEvents = 'auto';
                if (link) {
                    link.classList.remove('text-[#F4F1EA]/50');
                    link.classList.add('text-sanctum-accent', 'font-bold');
                }
            } else {
                // Inactive items
                li.classList.remove('border-sanctum-accent');
                
                // Distance opacity gradient
                let opacity = 0;
                if (distance === 1) {
                    opacity = 0.5;
                } else if (distance === 2) {
                    opacity = 0.2;
                }
                
                li.style.opacity = opacity.toString();
                
                if (opacity > 0) {
                    li.style.pointerEvents = 'auto';
                } else {
                    li.style.pointerEvents = 'none';
                }

                if (link) {
                    link.classList.remove('text-sanctum-accent', 'font-bold');
                    link.classList.add('text-[#F4F1EA]/50');
                }
            }
        });
    }

    // Scroll-spy index tracking logic
    function initScrollSpy() {
        const poemCards = document.querySelectorAll('.poem-card');
        if (poemCards.length === 0) return;

        let activeIndex = null;

        if (sidebarObserver) {
            sidebarObserver.disconnect();
        }

        sidebarObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    const index = parseInt(id.split('-').pop(), 10);

                    if (activeIndex === index) return;
                    activeIndex = index;
                    
                    updateSidebarState(activeIndex);
                }
            });
        }, {
            root: null,
            rootMargin: '-25% 0px -55% 0px',
            threshold: 0
        });

        poemCards.forEach(card => sidebarObserver.observe(card));

        // Initial setup
        updateSidebarState(0);
    }

    function showScreen(element) {
        element.classList.remove('hidden');
        void element.offsetWidth;
        element.classList.remove('opacity-0', 'scale-95', 'translate-y-4');
        element.classList.add('opacity-100', 'scale-100', 'translate-y-0');
    }

    function hideScreen(element, callback) {
        element.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
        element.classList.add('opacity-0', 'scale-95', 'translate-y-4');
        
        setTimeout(() => {
            element.classList.add('hidden');
            if (callback) callback();
        }, 600);
    }
});
