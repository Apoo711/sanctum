/** --- THE SANDGLASS CLIENT ENGINE --- **/

document.addEventListener('DOMContentLoaded', () => {
    initSandglass();
});

function initSandglass() {
    const canvas = document.getElementById('sandglass-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Timer state variables
    let totalSeconds = 1500; // Default: 25 minutes
    let elapsedSeconds = 0;
    let timerInterval = null;
    let isRunning = false;
    let currentMode = 'focus'; // 'focus' or 'break'

    // Flip rotation state
    let renderAngle = 0;
    let isFlipping = false;
    let flipStart = 0;
    const flipDuration = 800; // ms
    let startAngle = 0;
    let targetAngle = 0;
    let wasRunningBeforeFlip = false;

    // Elements
    const startBtn = document.getElementById('start-btn');
    const startText = document.getElementById('start-text');
    const startIcon = document.getElementById('start-icon');
    const resetBtn = document.getElementById('reset-btn');
    const timerStatus = document.getElementById('timer-status');
    const digitalDisplay = document.getElementById('digital-display');
    const progressBar = document.getElementById('progress-bar');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const focusToggle = document.getElementById('focus-toggle');
    const focusToggleDot = document.getElementById('focus-toggle-dot');
    const exitFocusBtn = document.getElementById('exit-focus-btn');
    const hourglassWrapper = document.getElementById('hourglass-wrapper');

    // Particle system variables
    let fallingParticles = [];
    let splashParticles = [];

    // Particle classes
    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vy = Math.random() * 2 + 3; // downward speed
            this.vx = (Math.random() - 0.5) * 0.7; // slight horizontal dispersion
            this.color = '#B5935B';
            this.size = Math.random() * 1.5 + 0.8;
        }

        update(pileYThreshold) {
            this.y += this.vy;
            this.x += this.vx;
            
            // Return true if it hits the bottom pile
            return this.y >= pileYThreshold;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class SplashParticle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vy = -(Math.random() * 1.5 + 0.5); // bounce upwards
            this.vx = (Math.random() - 0.5) * 2; // wider dispersion
            this.alpha = 1.0;
            this.decay = Math.random() * 0.05 + 0.05;
            this.size = Math.random() * 1.0 + 0.5;
        }

        update() {
            this.y += this.vy;
            this.x += this.vx;
            this.vy += 0.1; // gravity pull
            this.alpha -= this.decay;
            return this.alpha <= 0;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.alpha);
            ctx.fillStyle = '#B5935B';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Geometry parameters (relative to canvas width 220, height 340)
    const cX = canvas.width / 2;     // 110
    const cY = canvas.height / 2;    // 170
    
    // Funnel vertical boundaries
    const topLimitY = cY - 120;      // 50
    const neckY = cY;                // 170
    const bottomLimitY = cY + 120;   // 290

    // Sound Synthesizer: Elegant Minor Chord Bell Chime
    function playChime() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const audioCtx = new AudioContextClass();
            
            const playTone = (freq, startTime, duration, volume) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                
                gainNode.gain.setValueAtTime(volume, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
                
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            
            const now = audioCtx.currentTime;
            // A5 Minor triad chime: A5 (880Hz), C6 (1046.5Hz), E6 (1320Hz)
            playTone(880, now, 2.5, 0.15);
            playTone(1046.5, now + 0.15, 2.5, 0.12);
            playTone(1320, now + 0.3, 3.0, 0.08);
        } catch (e) {
            console.error('AudioContext chime failed to execute:', e);
        }
    }

    // Path definitions for clipping and glass contours
    function defineTopGlassPath() {
        ctx.beginPath();
        // Left curve
        ctx.moveTo(cX - 60, topLimitY);
        ctx.bezierCurveTo(cX - 60, cY - 40, cX - 6, cY - 20, cX - 6, neckY);
        // Right curve
        ctx.lineTo(cX + 6, neckY);
        ctx.bezierCurveTo(cX + 6, cY - 20, cX + 60, cY - 40, cX + 60, topLimitY);
        ctx.closePath();
    }

    function defineBottomGlassPath() {
        ctx.beginPath();
        // Left curve
        ctx.moveTo(cX - 6, neckY);
        ctx.bezierCurveTo(cX - 6, cY + 20, cX - 60, cY + 40, cX - 60, bottomLimitY);
        // Right curve
        ctx.lineTo(cX + 60, bottomLimitY);
        ctx.bezierCurveTo(cX + 60, cY + 40, cX + 6, cY + 20, cX + 6, neckY);
        ctx.closePath();
    }

    // Get current pile height at X coordinate for physics collision
    function getPileYAtX(x, progress) {
        // Pile grows upwards from bottomLimitY (290)
        // Max height is neckY + 40 (210), so range is 290 -> 210 (80px maximum height)
        const maxHeapHeight = 80;
        const heapHeight = progress * maxHeapHeight;
        const pilePeakY = bottomLimitY - heapHeight;
        
        // Parabolic heap shape
        const widthBound = 58;
        const dx = Math.abs(x - cX);
        if (dx >= widthBound) return bottomLimitY;
        
        const offset = heapHeight * (1 - Math.pow(dx / widthBound, 2));
        return bottomLimitY - offset;
    }

    // Leaf drawing helper
    function drawLeaf(lx, ly, leafAngle, scale = 1.0) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(leafAngle);
        ctx.scale(scale * 1.2, scale * 1.2);
        
        ctx.strokeStyle = '#0e1c0a'; // Very dark border sketch
        ctx.fillStyle = '#2e5424';    // Deep forest green
        ctx.lineWidth = 0.8;
        
        // Detailed leaf shape (pointed oval)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(3, -5, 10, -3, 12, 0); // Upper curve
        ctx.bezierCurveTo(10, 3, 3, 5, 0, 0);   // Lower curve
        ctx.fill();
        ctx.stroke();
        
        // Middle vein (dark green / black)
        ctx.strokeStyle = '#0e1c0a';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(9, 0);
        ctx.stroke();
        
        // Side veins
        ctx.beginPath();
        ctx.moveTo(3, 0);
        ctx.lineTo(5, -2);
        ctx.moveTo(3, 0);
        ctx.lineTo(4, 1.5);
        ctx.moveTo(6, 0);
        ctx.lineTo(8, -1.5);
        ctx.moveTo(6, 0);
        ctx.lineTo(7, 1);
        ctx.stroke();

        // Lighter green highlight on the upper half
        ctx.fillStyle = 'rgba(122, 163, 86, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(3, -4, 9, -2.5, 11, 0);
        ctx.lineTo(0, 0);
        ctx.fill();
        
        ctx.restore();
    }

    // Detailed hand-drawn rose helper
    function drawDetailedRose(rx, ry, scale = 1.0) {
        ctx.save();
        ctx.translate(rx, ry);
        ctx.scale(scale * 1.3, scale * 1.3);

        // Green sepals at the base
        ctx.fillStyle = '#1a3014';
        ctx.strokeStyle = '#0e1c0a';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        // Left sepal
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-6, 2, -4, -4);
        ctx.quadraticCurveTo(-2, -2, 0, 0);
        // Right sepal
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(6, 2, 4, -4);
        ctx.quadraticCurveTo(2, -2, 0, 0);
        // Bottom sepal
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(0, 7, -2, 4);
        ctx.quadraticCurveTo(1, 2, 0, 0);
        ctx.fill();
        ctx.stroke();

        // Deep shadow undercoat
        ctx.fillStyle = '#26050a';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // 1. Layer of outer petals
        ctx.fillStyle = '#6e151e';
        ctx.strokeStyle = '#1c0306';
        ctx.lineWidth = 0.7;
        
        // Petal 1 (Bottom)
        ctx.beginPath();
        ctx.arc(0, 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Petal 2 (Left)
        ctx.beginPath();
        ctx.arc(-4, -1, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Petal 3 (Right)
        ctx.beginPath();
        ctx.arc(4, -1, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Petal 4 (Top)
        ctx.beginPath();
        ctx.arc(0, -4, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 2. Middle petal layer
        ctx.fillStyle = '#9e1b27';
        
        // Mid Petal 1
        ctx.beginPath();
        ctx.arc(-2, 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Mid Petal 2
        ctx.beginPath();
        ctx.arc(2, 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Mid Petal 3
        ctx.beginPath();
        ctx.arc(0, -2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 3. Inner core
        ctx.fillStyle = '#c72e3a';
        ctx.beginPath();
        ctx.arc(-1, 0, 2.2, 0, Math.PI * 2);
        ctx.arc(1, 0, 2.2, 0, Math.PI * 2);
        ctx.arc(0, 1, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 4. Center bud
        ctx.fillStyle = '#e8515c';
        ctx.beginPath();
        ctx.arc(0, -0.5, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 5. White-cream highlights on petal edges (fine hand-sketched lines)
        ctx.strokeStyle = '#f5f2eb';
        ctx.lineWidth = 0.5;
        
        // Outer highlights
        ctx.beginPath();
        ctx.arc(0, 4, 5, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(-4, -1, 4.5, Math.PI * 0.8, Math.PI * 1.4);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(4, -1, 4.5, -Math.PI * 0.4, Math.PI * 0.2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -4, 4.5, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();

        // Inner highlights
        ctx.beginPath();
        ctx.arc(-2, 2, 3.5, Math.PI * 0.4, Math.PI * 0.9);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(2, 2, 3.5, 0, Math.PI * 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -2, 3.5, Math.PI * 1.3, Math.PI * 1.7);
        ctx.stroke();

        // Core center glint
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-0.5, -0.8, 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Helper to draw a shaded 3D cylinder for the tiered plates
    function draw3DCylinder(x, y, rx, ry, height, fillStyle, strokeStyle, highlightColor) {
        // Draw bottom ellipse boundary
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw side walls with linear shading gradient
        const wallGrad = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
        wallGrad.addColorStop(0.0, '#100501'); // deep shadow edge
        wallGrad.addColorStop(0.35, fillStyle); // wood color
        wallGrad.addColorStop(0.5, highlightColor || '#5c3e21'); // center highlight
        wallGrad.addColorStop(0.65, fillStyle);
        wallGrad.addColorStop(1.0, '#100501');
        
        ctx.fillStyle = wallGrad;
        ctx.beginPath();
        ctx.rect(x - rx, y - height, rx * 2, height);
        ctx.fill();
        
        // Outlines on the side edges
        ctx.beginPath();
        ctx.moveTo(x - rx, y - height);
        ctx.lineTo(x - rx, y);
        ctx.moveTo(x + rx, y - height);
        ctx.lineTo(x + rx, y);
        ctx.stroke();
        
        // Draw top ellipse
        const topGrad = ctx.createRadialGradient(x, y - height, ry, x, y - height, rx);
        topGrad.addColorStop(0, highlightColor || '#5c3e21');
        topGrad.addColorStop(1, fillStyle);
        
        ctx.fillStyle = topGrad;
        ctx.beginPath();
        ctx.ellipse(x, y - height, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // Helper to draw carved Greek key fret pattern around Tier 2 plates
    function drawGreekKeyPattern(x, y, rx, ry, height) {
        ctx.strokeStyle = 'rgba(140, 107, 63, 0.75)'; // Bronze carved outline
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        
        const step = 16;
        const startX = x - rx + 6;
        const endX = x + rx - 6;
        
        for (let sx = startX; sx < endX - 11; sx += step) {
            const w = 12;
            const h = height - 4;
            const top = y - height + 2;
            
            ctx.moveTo(sx, top);
            ctx.lineTo(sx + w, top);
            ctx.lineTo(sx + w, top + h);
            ctx.lineTo(sx + 3, top + h);
            ctx.lineTo(sx + 3, top + 3);
            ctx.lineTo(sx + w - 3, top + 3);
            ctx.lineTo(sx + w - 3, top + h - 3);
            ctx.lineTo(sx + 6, top + h - 3);
        }
        ctx.stroke();
    }

    // Helper to draw column pillars (Greco-Roman style fluted shafts with Ionic capitals)
    function drawColumn(colX) {
        // Columns extend deep inside the top and bottom plates: y from 35 to 305
        const startY = topLimitY - 15; // 35
        const endY = bottomLimitY + 15; // 305
        
        // 1. Draw Shaft Background (dark base)
        const shaftGrad = ctx.createLinearGradient(colX - 6, 0, colX + 6, 0);
        shaftGrad.addColorStop(0.0, '#100501'); // deep edge shadow
        shaftGrad.addColorStop(0.35, '#2b160b'); // mahogany base
        shaftGrad.addColorStop(0.5, '#694a30');  // warm wood glint
        shaftGrad.addColorStop(0.65, '#2b160b');
        shaftGrad.addColorStop(1.0, '#100501');
        
        ctx.fillStyle = shaftGrad;
        ctx.strokeStyle = '#100501';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.rect(colX - 6, startY + 6, 12, endY - startY - 12);
        ctx.fill();
        ctx.stroke();
        
        // 2. Column flutes (perspective-spaced grooves)
        ctx.strokeStyle = 'rgba(2, 2, 2, 0.55)';
        ctx.lineWidth = 0.8;
        const fluteOffsets = [-4.2, -1.8, 1.8, 4.2];
        ctx.beginPath();
        fluteOffsets.forEach(offset => {
            ctx.moveTo(colX + offset, startY + 6);
            ctx.lineTo(colX + offset, endY - 6);
        });
        ctx.stroke();
        
        // 3. Highlight lines on flutes
        ctx.strokeStyle = 'rgba(244, 241, 234, 0.15)';
        ctx.lineWidth = 0.5;
        const highlightOffsets = [-3.2, 0, 3.2];
        ctx.beginPath();
        highlightOffsets.forEach(offset => {
            ctx.moveTo(colX + offset, startY + 6);
            ctx.lineTo(colX + offset, endY - 6);
        });
        ctx.stroke();

        // 4. Draw Ionic Capital at topLimitY (50)
        // Abacus plate
        ctx.fillStyle = '#1e1107';
        ctx.strokeStyle = '#B5935B';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(colX - 8, topLimitY - 4, 16, 4, 0.5);
        ctx.fill();
        ctx.stroke();
        
        // Volute scrolls (spirals)
        ctx.beginPath();
        ctx.arc(colX - 5, topLimitY + 3, 2.5, 0, Math.PI * 2);
        ctx.arc(colX + 5, topLimitY + 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Inner detail lines of volute
        ctx.strokeStyle = '#8a6d3b';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(colX - 5, topLimitY + 3, 1.2, 0, Math.PI * 2);
        ctx.arc(colX + 5, topLimitY + 3, 1.2, 0, Math.PI * 2);
        ctx.stroke();

        // 5. Draw Column Base torus molding at bottomLimitY (290)
        ctx.fillStyle = '#1e1107';
        ctx.strokeStyle = '#B5935B';
        ctx.lineWidth = 1;
        
        // Top base ring
        ctx.beginPath();
        ctx.roundRect(colX - 7, bottomLimitY, 14, 3, 0.5);
        ctx.fill();
        ctx.stroke();
        
        // Bottom base ring
        ctx.beginPath();
        ctx.roundRect(colX - 9, bottomLimitY + 3, 18, 4, 0.5);
        ctx.fill();
        ctx.stroke();
    }

    // 3D Vine Wrapping path helper (looser wrap, low frequency)
    function drawPillarVinePath(colX, phase, layer) {
        ctx.save();
        for (let y = topLimitY - 10; y <= bottomLimitY + 10; y += 2) {
            const theta = y * 0.035 + phase; // Looser frequency (0.035 instead of 0.08)
            const z = Math.cos(theta);
            const x = colX + Math.sin(theta) * 9; // Wider swing for organic look
            
            const isCorrectLayer = (layer === 'front') ? (z > 0) : (z <= 0);
            
            if (isCorrectLayer) {
                // Main stem line
                ctx.strokeStyle = z > 0 ? '#1b3314' : '#0d1c0a';
                ctx.lineWidth = z > 0 ? 3.0 : 1.8;
                ctx.beginPath();
                ctx.moveTo(x, y);
                const prevTheta = (y - 2) * 0.035 + phase;
                const prevX = colX + Math.sin(prevTheta) * 9;
                ctx.lineTo(prevX, y - 2);
                ctx.stroke();
                
                // Highlight stem line
                if (z > 0) {
                    ctx.strokeStyle = '#4e7a3a';
                    ctx.lineWidth = 1.0;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(prevX, y - 2);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    // Drawing loop
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update rotation angle if flipping
        if (isFlipping) {
            const now = performance.now();
            const pct = Math.min(1.0, (now - flipStart) / flipDuration);
            
            // Cubic ease-in-out
            const ease = pct < 0.5 ? 4 * pct * pct * pct : 1 - Math.pow(-2 * pct + 2, 3) / 2;
            renderAngle = startAngle + (targetAngle - startAngle) * ease;
            
            if (pct >= 1.0) {
                isFlipping = false;
                renderAngle = 0;
                
                // Swap sand metrics: elapsed becomes what fell down (or remaining reset)
                if (elapsedSeconds > 0 && elapsedSeconds < totalSeconds) {
                    // Physical sand inversion: the sand at the bottom (elapsedSeconds) is now at the top.
                    totalSeconds = elapsedSeconds;
                } else {
                    // Reset to active preset if completed or at start
                    const activePreset = document.querySelector('.preset-btn.active');
                    totalSeconds = activePreset ? parseInt(activePreset.dataset.duration) : 1500;
                }
                elapsedSeconds = 0;
                updateClockDisplay();
                
                if (wasRunningBeforeFlip) {
                    startTimer();
                } else {
                    timerStatus.innerText = `${currentMode.toUpperCase()} READY // FLIPPED`;
                }
            }
        }

        const progress = Math.min(1.0, elapsedSeconds / totalSeconds);
        const isFocusMode = document.body.classList.contains('focus-mode-active');

        // Apply rotation to coordinates
        ctx.save();
        ctx.translate(cX, cY);
        ctx.rotate(renderAngle);
        ctx.translate(-cX, -cY);

        // ==========================================
        // STEP 1: Draw Back Vines (Behind Pillars)
        // ==========================================
        if (!isFocusMode) {
            drawPillarVinePath(cX - 66, 0, 'back');       // Left pillar back vine
            drawPillarVinePath(cX + 66, Math.PI, 'back'); // Right pillar back vine
        }

        // ==========================================
        // STEP 2: Draw Columns & Plates (3D Frame)
        // ==========================================
        drawColumn(cX - 66); // Left pillar
        drawColumn(cX + 66); // Right pillar

        // Tiered 3D Top Plate Pedestal (masking columns seamlessly)
        // Tier 3 (lowest): y=50, rx=70, ry=7, height=5
        draw3DCylinder(cX, topLimitY, 70, 7, 5, '#1e1107', '#B5935B', '#422b1c');
        // Tier 2 (middle): y=45, rx=75, ry=7.5, height=11
        draw3DCylinder(cX, topLimitY - 5, 75, 7.5, 11, '#26160d', '#B5935B', '#593c28');
        drawGreekKeyPattern(cX, topLimitY - 5, 75, 7.5, 11);
        // Tier 1 (top-most): y=34, rx=80, ry=8, height=6
        draw3DCylinder(cX, topLimitY - 16, 80, 8, 6, '#1e1107', '#B5935B', '#422b1c');

        // Tiered 3D Bottom Plate Pedestal (masking columns seamlessly)
        // Tier 3 (upper): y=295, rx=70, ry=7, height=5
        draw3DCylinder(cX, bottomLimitY + 5, 70, 7, 5, '#1e1107', '#B5935B', '#422b1c');
        // Tier 2 (middle): y=306, rx=75, ry=7.5, height=11
        draw3DCylinder(cX, bottomLimitY + 16, 75, 7.5, 11, '#26160d', '#B5935B', '#593c28');
        drawGreekKeyPattern(cX, bottomLimitY + 16, 75, 7.5, 11);
        // Tier 1 (bottom-most): y=312, rx=80, ry=8, height=6
        draw3DCylinder(cX, bottomLimitY + 22, 80, 8, 6, '#1e1107', '#B5935B', '#422b1c');

        // ==========================================
        // STEP 3: Draw Top Sand (Draining)
        // ==========================================
        if (progress < 1.0) {
            ctx.save();
            defineTopGlassPath();
            ctx.clip();
            
            const remainingRatio = 1 - progress;
            const sandHeight = remainingRatio * 110;
            const sandTopY = neckY - sandHeight;

            ctx.fillStyle = 'rgba(181, 147, 91, 0.9)';
            ctx.beginPath();
            ctx.moveTo(cX - 70, sandTopY);
            
            const depressionDip = Math.sin(progress * Math.PI) * 12 + 2;
            ctx.lineTo(cX, Math.min(neckY - 2, sandTopY + depressionDip));
            
            ctx.lineTo(cX + 70, sandTopY);
            ctx.lineTo(cX + 70, neckY);
            ctx.lineTo(cX - 70, neckY);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(2, 2, 2, 0.15)';
            for (let i = 0; i < 200 * remainingRatio; i++) {
                const sx = cX + (Math.random() - 0.5) * 110 * remainingRatio;
                const sy = sandTopY + Math.random() * sandHeight;
                if (ctx.isPointInPath(sx, sy)) {
                    ctx.fillRect(sx, sy, 1, 1);
                }
            }
            ctx.restore();
        }

        // ==========================================
        // STEP 4: Draw Bottom Sand (Accumulating)
        // ==========================================
        if (progress > 0) {
            ctx.save();
            defineBottomGlassPath();
            ctx.clip();

            ctx.fillStyle = 'rgba(181, 147, 91, 0.9)';
            ctx.beginPath();
            ctx.moveTo(cX - 60, bottomLimitY);
            
            const pilePeakY = bottomLimitY - (progress * 80);
            ctx.quadraticCurveTo(cX - 30, pilePeakY + (bottomLimitY - pilePeakY) * 0.25, cX, pilePeakY);
            ctx.quadraticCurveTo(cX + 30, pilePeakY + (bottomLimitY - pilePeakY) * 0.25, cX + 60, bottomLimitY);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(2, 2, 2, 0.15)';
            for (let i = 0; i < 200 * progress; i++) {
                const sx = cX + (Math.random() - 0.5) * 110 * progress;
                const sy = pilePeakY + Math.random() * (bottomLimitY - pilePeakY);
                if (ctx.isPointInPath(sx, sy)) {
                    ctx.fillRect(sx, sy, 1, 1);
                }
            }
            ctx.restore();
        }

        // ==========================================
        // STEP 5: Draw Falling Particles
        // ==========================================
        if (isRunning && progress < 1.0) {
            for (let i = 0; i < 3; i++) {
                fallingParticles.push(new Particle(cX + (Math.random() - 0.5) * 3, neckY));
            }
        }

        for (let i = fallingParticles.length - 1; i >= 0; i--) {
            const p = fallingParticles[i];
            const hitY = getPileYAtX(p.x, progress);
            
            if (p.update(hitY)) {
                for (let j = 0; j < 2; j++) {
                    splashParticles.push(new SplashParticle(p.x, hitY));
                }
                fallingParticles.splice(i, 1);
            } else {
                p.draw();
            }
        }

        for (let i = splashParticles.length - 1; i >= 0; i--) {
            const sp = splashParticles[i];
            if (sp.update()) {
                splashParticles.splice(i, 1);
            } else {
                sp.draw();
            }
        }

        // ==========================================
        // STEP 6: Draw Glass Outlines & Glint
        // ==========================================
        ctx.strokeStyle = 'rgba(181, 147, 91, 0.35)';
        ctx.lineWidth = 1.5;
        
        defineTopGlassPath();
        ctx.stroke();
        
        defineBottomGlassPath();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(244, 241, 234, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cX - 5, neckY - 5);
        ctx.quadraticCurveTo(cX - 4, neckY, cX - 5, neckY + 5);
        ctx.moveTo(cX + 5, neckY - 5);
        ctx.quadraticCurveTo(cX + 4, neckY, cX + 5, neckY + 5);
        ctx.stroke();

        // Curved 3D glass reflections/glints inside bulbs
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        // Top left glint
        ctx.moveTo(cX - 52, topLimitY + 15);
        ctx.bezierCurveTo(cX - 50, cY - 45, cX - 12, cY - 22, cX - 10, neckY - 12);
        // Bottom left glint
        ctx.moveTo(cX - 10, neckY + 12);
        ctx.bezierCurveTo(cX - 12, cY + 22, cX - 50, cY + 45, cX - 52, bottomLimitY - 15);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        // Top right glint
        ctx.moveTo(cX + 52, topLimitY + 15);
        ctx.bezierCurveTo(cX + 50, cY - 45, cX + 12, cY - 22, cX + 10, neckY - 12);
        // Bottom right glint
        ctx.moveTo(cX + 10, neckY + 12);
        ctx.bezierCurveTo(cX + 12, cY + 22, cX + 50, cY + 45, cX + 52, bottomLimitY - 15);
        ctx.stroke();

        // ==========================================
        // STEP 7: Draw Front Vines & Gothic Leaves/Roses
        // ==========================================
        if (!isFocusMode) {
            drawPillarVinePath(cX - 66, 0, 'front');       // Left pillar front vine
            drawPillarVinePath(cX + 66, Math.PI, 'front'); // Right pillar front vine

            // Continuous organic glass vine wrapping diagonally in front of glass
            ctx.save();
            ctx.strokeStyle = '#1c3615';
            ctx.lineWidth = 2.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(cX - 66, 230);
            ctx.bezierCurveTo(cX - 50, 215, cX - 35, 195, cX - 10, 175);
            ctx.bezierCurveTo(cX - 5, 171, cX + 5, 169, cX + 15, 165);
            ctx.bezierCurveTo(cX + 35, 145, cX + 50, 125, cX + 66, 110);
            ctx.stroke();

            // Glass vine highlight
            ctx.strokeStyle = '#4d7d3d';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(cX - 66, 230);
            ctx.bezierCurveTo(cX - 50, 215, cX - 35, 195, cX - 10, 175);
            ctx.bezierCurveTo(cX - 5, 171, cX + 5, 169, cX + 15, 165);
            ctx.bezierCurveTo(cX + 35, 145, cX + 50, 125, cX + 66, 110);
            ctx.stroke();
            ctx.restore();

            // Horizontal plate vines following the front ellipse edges
            ctx.strokeStyle = '#1c3615';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.ellipse(cX, topLimitY, 70, 7, 0, 0, Math.PI, false);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(cX, bottomLimitY, 70, 7, 0, 0, Math.PI, false);
            ctx.stroke();

            // Draw scattered leaves organically (none around time text)
            const leaves = [
                // Top plate area
                {x: cX - 55, y: topLimitY - 14, angle: -0.5, scale: 0.9},
                {x: cX - 30, y: topLimitY - 16, angle: -0.25, scale: 1.0},
                {x: cX + 25, y: topLimitY - 15, angle: 0.3, scale: 0.9},
                {x: cX + 55, y: topLimitY - 12, angle: 0.5, scale: 1.0},
                // Bottom plate area
                {x: cX - 50, y: bottomLimitY + 12, angle: -0.4, scale: 0.9},
                {x: cX - 15, y: bottomLimitY + 14, angle: -0.2, scale: 1.0},
                {x: cX + 20, y: bottomLimitY + 13, angle: 0.25, scale: 0.9},
                {x: cX + 50, y: bottomLimitY + 15, angle: 0.45, scale: 1.0},
                // Left column
                {x: cX - 74, y: topLimitY + 20, angle: -0.2, scale: 0.9},
                {x: cX - 58, y: topLimitY + 75, angle: 0.4, scale: 1.0},
                {x: cX - 76, y: topLimitY + 115, angle: -0.5, scale: 0.8},
                {x: cX - 58, y: topLimitY + 155, angle: 0.3, scale: 1.0},
                {x: cX - 74, y: topLimitY + 215, angle: -0.3, scale: 0.9},
                // Right column
                {x: cX + 58, y: topLimitY + 30, angle: -0.4, scale: 0.9},
                {x: cX + 74, y: topLimitY + 70, angle: 0.3, scale: 1.0},
                {x: cX + 56, y: topLimitY + 125, angle: -0.3, scale: 0.8},
                {x: cX + 75, y: topLimitY + 175, angle: 0.4, scale: 1.0},
                {x: cX + 58, y: topLimitY + 235, angle: -0.5, scale: 0.9},
                // Glass vine
                {x: cX - 48, y: neckY + 55, angle: 0.5, scale: 1.0},
                {x: cX + 48, y: neckY - 55, angle: -0.5, scale: 1.0}
            ];
            
            leaves.forEach(lf => {
                drawLeaf(lf.x, lf.y, lf.angle, lf.scale);
            });

            // Draw scattered roses organically (no neat rows of 3 at top/bottom, halved count, none around time text)
            const roses = [
                // Scattered along left column / vine (lower)
                {x: cX - 62, y: topLimitY + 180, scale: 1.0},
                // Scattered along right column / vine (upper & lower)
                {x: cX + 64, y: topLimitY + 95, scale: 1.0},
                {x: cX + 70, y: topLimitY + 220, scale: 1.0},
                // Scattered trailing off top/bottom plates (asymmetrical, away from center)
                {x: cX - 45, y: topLimitY - 12, scale: 1.05},
                {x: cX + 45, y: topLimitY - 12, scale: 1.05},
                {x: cX - 40, y: bottomLimitY + 12, scale: 1.05},
                {x: cX + 40, y: bottomLimitY + 12, scale: 1.05}
            ];
            
            roses.forEach(rs => {
                drawDetailedRose(rs.x, rs.y, rs.scale);
            });
        }

        ctx.restore();
    }

    // Animation frames controller
    let animFrameId = null;
    function animLoop() {
        draw();
        animFrameId = requestAnimationFrame(animLoop);
    }

    // Format seconds to digital clock
    function updateClockDisplay() {
        const remaining = Math.max(0, totalSeconds - elapsedSeconds);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const pad = (n) => String(n).padStart(2, '0');
        
        digitalDisplay.innerText = `${pad(mins)}:${pad(secs)}`;
        
        // Update browser tab title too
        const modeLabel = currentMode === 'focus' ? 'Focus' : 'Break';
        document.title = `(${pad(mins)}:${pad(secs)}) ${modeLabel} | Sanctum`;

        // Progress line bar width
        const ratio = totalSeconds > 0 ? (elapsedSeconds / totalSeconds) * 100 : 0;
        progressBar.style.width = `${ratio}%`;
    }

    function startTimer() {
        if (isRunning) return;
        isRunning = true;
        
        // Resume canvas physics rendering loop
        if (!animFrameId) {
            animLoop();
        }

        startText.innerText = "PAUSE FOCUS";
        startBtn.classList.remove('primary-btn');
        timerStatus.innerText = `${currentMode.toUpperCase()} SESSION // TICKING`;

        // Play brief sub-harmonic start tone
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.frequency.setValueAtTime(220, audioCtx.currentTime); // low A3
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        } catch(e){}

        timerInterval = setInterval(() => {
            elapsedSeconds++;
            updateClockDisplay();

            if (elapsedSeconds >= totalSeconds) {
                // Focus session completed!
                clearInterval(timerInterval);
                isRunning = false;
                
                playChime();
                
                timerStatus.innerText = `${currentMode.toUpperCase()} COMPLETED`;
                startText.innerText = "BEGIN FOCUS";
                startBtn.classList.add('primary-btn');
                
                // Show notification if permitted
                if (Notification.permission === 'granted') {
                    new Notification(`Sandglass Chronometer`, {
                        body: `${currentMode === 'focus' ? 'Focus session' : 'Break'} finished! Time to rotate the glass.`
                    });
                }
            }
        }, 1000);
    }

    function pauseTimer() {
        if (!isRunning) return;
        isRunning = false;
        clearInterval(timerInterval);
        
        startText.innerText = "RESUME FOCUS";
        startBtn.classList.add('primary-btn');
        timerStatus.innerText = `${currentMode.toUpperCase()} SESSION // PAUSED`;
    }

    function flipHourglass() {
        if (isFlipping) return;

        wasRunningBeforeFlip = isRunning;
        pauseTimer();

        // Clear particles in air
        fallingParticles = [];
        splashParticles = [];

        // Start flip animation
        isFlipping = true;
        flipStart = performance.now();
        startAngle = renderAngle;
        targetAngle = renderAngle + Math.PI;
    }

    // Toggle timer status
    startBtn.addEventListener('click', () => {
        if (isRunning) {
            pauseTimer();
        } else {
            if (elapsedSeconds >= totalSeconds) {
                // Reset to active preset if it was a flipped/shortened timer
                const activePreset = document.querySelector('.preset-btn.active');
                totalSeconds = activePreset ? parseInt(activePreset.dataset.duration) : 1500;
                
                elapsedSeconds = 0;
                updateClockDisplay();
            }
            startTimer();
        }
    });

    // Reset/Flip timer
    resetBtn.addEventListener('click', () => {
        flipHourglass();
    });

    // Click on canvas directly also triggers flip
    canvas.addEventListener('click', () => {
        flipHourglass();
    });

    // Preset selectors
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isRunning) {
                if (!confirm("A focus session is currently active. Change preset anyway?")) {
                    return;
                }
            }
            
            pauseTimer();
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            totalSeconds = parseInt(btn.dataset.duration);
            elapsedSeconds = 0;

            // Determine if preset is break or focus based on text
            const label = btn.innerText.toLowerCase();
            if (label.includes('break')) {
                currentMode = 'break';
                timerStatus.innerText = `BREAK READY // ${totalSeconds / 60}m`;
                startText.innerText = "BEGIN BREAK";
            } else {
                currentMode = 'focus';
                timerStatus.innerText = `FOCUS READY // ${totalSeconds / 60}m`;
                startText.innerText = "BEGIN FOCUS";
            }

            // Reset particles
            fallingParticles = [];
            splashParticles = [];
            
            updateClockDisplay();
            draw();
        });
    });

    // Stealth Focus Mode toggles
    function enterFocusMode() {
        document.body.classList.add('focus-mode-active');
        focusToggleDot.style.transform = 'translateX(16px)';
        focusToggleDot.style.backgroundColor = '#B5935B';
        focusToggle.style.borderColor = '#B5935B';
        
        // Request notification permission on focus mode activation
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function exitFocusMode() {
        document.body.classList.remove('focus-mode-active');
        focusToggleDot.style.transform = 'translateX(0)';
        focusToggleDot.style.backgroundColor = 'rgba(181, 147, 91, 0.5)';
        focusToggle.style.borderColor = 'rgba(181, 147, 91, 0.3)';
    }

    focusToggle.addEventListener('click', () => {
        const isFocus = document.body.classList.contains('focus-mode-active');
        if (isFocus) {
            exitFocusMode();
        } else {
            enterFocusMode();
        }
    });

    exitFocusBtn.addEventListener('click', () => {
        exitFocusMode();
    });

    // Listen to keyboard shortcut Escape to exit focus mode
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('focus-mode-active')) {
            exitFocusMode();
        }
    });

    // Initialize display and draw once
    updateClockDisplay();
    draw();
    // Render static canvas first frame, activate requestAnimationFrame loop only when ticking to save CPU cycles
    animLoop();
}
