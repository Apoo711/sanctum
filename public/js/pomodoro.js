/** --- THE SANDGLASS CLIENT ENGINE --- **/

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sandglass-canvas');
    if (canvas) {
        new Sandglass(canvas);
    }
});

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

    draw(ctx) {
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

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = '#B5935B';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Sandglass {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Timer state variables
        this.totalSeconds = 1500; // Default: 25 minutes
        this.elapsedSeconds = 0;
        this.timerInterval = null;
        this.isRunning = false;
        this.currentMode = 'focus'; // 'focus' or 'break'

        // Flip rotation state
        this.renderAngle = 0;
        this.isFlipping = false;
        this.flipStart = 0;
        this.flipDuration = 800; // ms
        this.startAngle = 0;
        this.targetAngle = 0;
        this.wasRunningBeforeFlip = false;

        // Elements
        this.startBtn = document.getElementById('start-btn');
        this.startText = document.getElementById('start-text');
        this.resetBtn = document.getElementById('reset-btn');
        this.timerStatus = document.getElementById('timer-status');
        this.digitalDisplay = document.getElementById('digital-display');
        this.progressBar = document.getElementById('progress-bar');
        this.presetButtons = document.querySelectorAll('.preset-btn');
        this.focusToggle = document.getElementById('focus-toggle');
        this.focusToggleDot = document.getElementById('focus-toggle-dot');
        this.exitFocusBtn = document.getElementById('exit-focus-btn');

        // Particle system variables
        this.fallingParticles = [];
        this.splashParticles = [];

        // Geometry parameters (relative to canvas width 220, height 340)
        this.cX = this.canvas.width / 2;     // 110
        this.cY = this.canvas.height / 2;    // 170
        
        // Funnel vertical boundaries
        this.topLimitY = this.cY - 120;      // 50
        this.neckY = this.cY;                // 170
        this.bottomLimitY = this.cY + 120;   // 290

        // Pre-calculate glass width lookup table for dY from 0 to 120
        this.glassWidthTable = new Float32Array(121);
        for (let dY = 0; dY <= 120; dY++) {
            const u = 1 - dY / 120;
            this.glassWidthTable[dY] = 60 + 4.2679 * u - 40.0954 * u * u - 42.7533 * u * u * u - 25.6015 * u * u * u * u + 50.1822 * u * u * u * u * u;
        }

        // Pre-generate a static noise pool for sand grains
        this.numSandGrains = 200;
        this.sandNoisePool = [];
        for (let i = 0; i < this.numSandGrains; i++) {
            this.sandNoisePool.push({
                rx: Math.random() - 0.5,
                ry: Math.random()
            });
        }

        this.animFrameId = null;

        // Initialize event listeners
        this.initEventListeners();

        // Initialize display and draw once
        this.updateClockDisplay();
        this.draw();
    }

    // Sound Synthesizer: Elegant Minor Chord Bell Chime
    playChime() {
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
    defineTopGlassPath() {
        this.ctx.beginPath();
        // Left curve
        this.ctx.moveTo(this.cX - 60, this.topLimitY);
        this.ctx.bezierCurveTo(this.cX - 60, this.cY - 40, this.cX - 6, this.cY - 20, this.cX - 6, this.neckY);
        // Right curve
        this.ctx.lineTo(this.cX + 6, this.neckY);
        this.ctx.bezierCurveTo(this.cX + 6, this.cY - 20, this.cX + 60, this.cY - 40, this.cX + 60, this.topLimitY);
        this.ctx.closePath();
    }

    defineBottomGlassPath() {
        this.ctx.beginPath();
        // Left curve
        this.ctx.moveTo(this.cX - 6, this.neckY);
        this.ctx.bezierCurveTo(this.cX - 6, this.cY + 20, this.cX - 60, this.cY + 40, this.cX - 60, this.bottomLimitY);
        // Right curve
        this.ctx.lineTo(this.cX + 60, this.bottomLimitY);
        this.ctx.bezierCurveTo(this.cX + 60, this.cY + 40, this.cX + 6, this.cY + 20, this.cX + 6, this.neckY);
        this.ctx.closePath();
    }

    // Mathematical boundary mapping for the hourglass shape
    getGlassWidth(y) {
        const dY = Math.abs(y - this.cY);
        if (dY > 120) return 0;
        return this.glassWidthTable[(dY + 0.5) | 0]; // Fast rounding using bitwise OR
    }

    // Get current pile height at X coordinate for physics collision
    getPileYAtX(x, progress) {
        const maxHeapHeight = 80;
        const heapHeight = progress * maxHeapHeight;
        const widthBound = 58;
        const dx = Math.abs(x - this.cX);
        if (dx >= widthBound) return this.bottomLimitY;
        
        const offset = heapHeight * (1 - Math.pow(dx / widthBound, 2));
        return this.bottomLimitY - offset;
    }

    // Leaf drawing helper
    drawLeaf(lx, ly, leafAngle, scale = 1.0) {
        this.ctx.save();
        this.ctx.translate(lx, ly);
        this.ctx.rotate(leafAngle);
        this.ctx.scale(scale * 1.2, scale * 1.2);
        
        this.ctx.strokeStyle = '#0e1c0a'; // Very dark border sketch
        this.ctx.fillStyle = '#2e5424';    // Deep forest green
        this.ctx.lineWidth = 0.8;
        
        // Detailed leaf shape (pointed oval)
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.bezierCurveTo(3, -5, 10, -3, 12, 0); // Upper curve
        this.ctx.bezierCurveTo(10, 3, 3, 5, 0, 0);   // Lower curve
        this.ctx.fill();
        this.ctx.stroke();
        
        // Middle vein (dark green / black)
        this.ctx.strokeStyle = '#0e1c0a';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(9, 0);
        this.ctx.stroke();
        
        // Side veins
        this.ctx.beginPath();
        this.ctx.moveTo(3, 0);
        this.ctx.lineTo(5, -2);
        this.ctx.moveTo(3, 0);
        this.ctx.lineTo(4, 1.5);
        this.ctx.moveTo(6, 0);
        this.ctx.lineTo(8, -1.5);
        this.ctx.moveTo(6, 0);
        this.ctx.lineTo(7, 1);
        this.ctx.stroke();

        // Lighter green highlight on the upper half
        this.ctx.fillStyle = 'rgba(122, 163, 86, 0.4)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.bezierCurveTo(3, -4, 9, -2.5, 11, 0);
        this.ctx.lineTo(0, 0);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    // Helper functions for drawing rose segments
    drawRoseSepals() {
        // Green sepals at the base
        this.ctx.fillStyle = '#1a3014';
        this.ctx.strokeStyle = '#0e1c0a';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        // Left sepal
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(-6, 2, -4, -4);
        this.ctx.quadraticCurveTo(-2, -2, 0, 0);
        // Right sepal
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(6, 2, 4, -4);
        this.ctx.quadraticCurveTo(2, -2, 0, 0);
        // Bottom sepal
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(0, 7, -2, 4);
        this.ctx.quadraticCurveTo(1, 2, 0, 0);
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawRoseOuterPetals() {
        // Deep shadow undercoat
        this.ctx.fillStyle = '#26050a';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // 1. Layer of outer petals
        this.ctx.fillStyle = '#6e151e';
        this.ctx.strokeStyle = '#1c0306';
        this.ctx.lineWidth = 0.7;
        
        // Petal 1 (Bottom)
        this.ctx.beginPath();
        this.ctx.arc(0, 4, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Petal 2 (Left)
        this.ctx.beginPath();
        this.ctx.arc(-4, -1, 4.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Petal 3 (Right)
        this.ctx.beginPath();
        this.ctx.arc(4, -1, 4.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Petal 4 (Top)
        this.ctx.beginPath();
        this.ctx.arc(0, -4, 4.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawRoseMiddlePetals() {
        // 2. Middle petal layer
        this.ctx.fillStyle = '#9e1b27';
        
        // Mid Petal 1
        this.ctx.beginPath();
        this.ctx.arc(-2, 2, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Mid Petal 2
        this.ctx.beginPath();
        this.ctx.arc(2, 2, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Mid Petal 3
        this.ctx.beginPath();
        this.ctx.arc(0, -2, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawRoseInnerCore() {
        // 3. Inner core
        this.ctx.fillStyle = '#c72e3a';
        this.ctx.beginPath();
        this.ctx.arc(-1, 0, 2.2, 0, Math.PI * 2);
        this.ctx.arc(1, 0, 2.2, 0, Math.PI * 2);
        this.ctx.arc(0, 1, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // 4. Center bud
        this.ctx.fillStyle = '#e8515c';
        this.ctx.beginPath();
        this.ctx.arc(0, -0.5, 1.4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawRoseHighlights() {
        // 5. White-cream highlights on petal edges (fine hand-sketched lines)
        this.ctx.strokeStyle = '#f5f2eb';
        this.ctx.lineWidth = 0.5;
        
        // Outer highlights
        this.ctx.beginPath();
        this.ctx.arc(0, 4, 5, Math.PI * 0.2, Math.PI * 0.8);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(-4, -1, 4.5, Math.PI * 0.8, Math.PI * 1.4);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(4, -1, 4.5, -Math.PI * 0.4, Math.PI * 0.2);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, -4, 4.5, Math.PI * 1.2, Math.PI * 1.8);
        this.ctx.stroke();

        // Inner highlights
        this.ctx.beginPath();
        this.ctx.arc(-2, 2, 3.5, Math.PI * 0.4, Math.PI * 0.9);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(2, 2, 3.5, 0, Math.PI * 0.5);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, -2, 3.5, Math.PI * 1.3, Math.PI * 1.7);
        this.ctx.stroke();

        // Core center glint
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-0.5, -0.8, 0.6, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // Detailed hand-drawn rose helper
    drawDetailedRose(rx, ry, scale = 1.0) {
        this.ctx.save();
        this.ctx.translate(rx, ry);
        this.ctx.scale(scale * 1.3, scale * 1.3);

        this.drawRoseSepals();
        this.drawRoseOuterPetals();
        this.drawRoseMiddlePetals();
        this.drawRoseInnerCore();
        this.drawRoseHighlights();

        this.ctx.restore();
    }

    // Helper to draw a shaded 3D cylinder for the tiered plates
    draw3DCylinder(x, y, rx, ry, height, fillStyle, strokeStyle, highlightColor) {
        // Draw bottom ellipse boundary
        this.ctx.fillStyle = fillStyle;
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw side walls with linear shading gradient
        const wallGrad = this.ctx.createLinearGradient(x - rx, 0, x + rx, 0);
        wallGrad.addColorStop(0.0, '#100501'); // deep shadow edge
        wallGrad.addColorStop(0.35, fillStyle); // wood color
        wallGrad.addColorStop(0.5, highlightColor || '#5c3e21'); // center highlight
        wallGrad.addColorStop(0.65, fillStyle);
        wallGrad.addColorStop(1.0, '#100501');
        
        this.ctx.fillStyle = wallGrad;
        this.ctx.beginPath();
        this.ctx.rect(x - rx, y - height, rx * 2, height);
        this.ctx.fill();
        
        // Outlines on the side edges
        this.ctx.beginPath();
        this.ctx.moveTo(x - rx, y - height);
        this.ctx.lineTo(x - rx, y);
        this.ctx.moveTo(x + rx, y - height);
        this.ctx.lineTo(x + rx, y);
        this.ctx.stroke();
        
        // Draw top ellipse
        const topGrad = this.ctx.createRadialGradient(x, y - height, ry, x, y - height, rx);
        topGrad.addColorStop(0, highlightColor || '#5c3e21');
        topGrad.addColorStop(1, fillStyle);
        
        this.ctx.fillStyle = topGrad;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - height, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    // Helper to draw carved Greek key fret pattern around Tier 2 plates
    drawGreekKeyPattern(x, y, rx, ry, height) {
        this.ctx.strokeStyle = 'rgba(140, 107, 63, 0.75)'; // Bronze carved outline
        this.ctx.lineWidth = 0.8;
        this.ctx.beginPath();
        
        const step = 16;
        const startX = x - rx + 6;
        const endX = x + rx - 6;
        
        for (let sx = startX; sx < endX - 11; sx += step) {
            const w = 12;
            const h = height - 4;
            const top = y - height + 2;
            
            this.ctx.moveTo(sx, top);
            this.ctx.lineTo(sx + w, top);
            this.ctx.lineTo(sx + w, top + h);
            this.ctx.lineTo(sx + 3, top + h);
            this.ctx.lineTo(sx + 3, top + 3);
            this.ctx.lineTo(sx + w - 3, top + 3);
            this.ctx.lineTo(sx + w - 3, top + h - 3);
            this.ctx.lineTo(sx + 6, top + h - 3);
        }
        this.ctx.stroke();
    }

    // Helper to draw column pillars (Greco-Roman style fluted shafts with Ionic capitals)
    drawColumn(colX) {
        // Columns extend deep inside the top and bottom plates: y from 35 to 305
        const startY = this.topLimitY - 15; // 35
        const endY = this.bottomLimitY + 15; // 305
        
        // 1. Draw Shaft Background (dark base)
        const shaftGrad = this.ctx.createLinearGradient(colX - 6, 0, colX + 6, 0);
        shaftGrad.addColorStop(0.0, '#100501'); // deep edge shadow
        shaftGrad.addColorStop(0.35, '#2b160b'); // mahogany base
        shaftGrad.addColorStop(0.5, '#694a30');  // warm wood glint
        shaftGrad.addColorStop(0.65, '#2b160b');
        shaftGrad.addColorStop(1.0, '#100501');
        
        this.ctx.fillStyle = shaftGrad;
        this.ctx.strokeStyle = '#100501';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.rect(colX - 6, startY + 6, 12, endY - startY - 12);
        this.ctx.fill();
        this.ctx.stroke();
        
        // 2. Column flutes (perspective-spaced grooves)
        this.ctx.strokeStyle = 'rgba(2, 2, 2, 0.55)';
        this.ctx.lineWidth = 0.8;
        const fluteOffsets = [-4.2, -1.8, 1.8, 4.2];
        this.ctx.beginPath();
        fluteOffsets.forEach(offset => {
            this.ctx.moveTo(colX + offset, startY + 6);
            this.ctx.lineTo(colX + offset, endY - 6);
        });
        this.ctx.stroke();
        
        // 3. Highlight lines on flutes
        this.ctx.strokeStyle = 'rgba(244, 241, 234, 0.15)';
        this.ctx.lineWidth = 0.5;
        const highlightOffsets = [-3.2, 0, 3.2];
        this.ctx.beginPath();
        highlightOffsets.forEach(offset => {
            this.ctx.moveTo(colX + offset, startY + 6);
            this.ctx.lineTo(colX + offset, endY - 6);
        });
        this.ctx.stroke();

        // 4. Draw Ionic Capital at topLimitY (50)
        // Abacus plate
        this.ctx.fillStyle = '#1e1107';
        this.ctx.strokeStyle = '#B5935B';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(colX - 8, this.topLimitY - 4, 16, 4, 0.5);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Volute scrolls (spirals)
        this.ctx.beginPath();
        this.ctx.arc(colX - 5, this.topLimitY + 3, 2.5, 0, Math.PI * 2);
        this.ctx.arc(colX + 5, this.topLimitY + 3, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Inner detail lines of volute
        this.ctx.strokeStyle = '#8a6d3b';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.arc(colX - 5, this.topLimitY + 3, 1.2, 0, Math.PI * 2);
        this.ctx.arc(colX + 5, this.topLimitY + 3, 1.2, 0, Math.PI * 2);
        this.ctx.stroke();

        // 5. Draw Column Base torus molding at bottomLimitY (290)
        this.ctx.fillStyle = '#1e1107';
        this.ctx.strokeStyle = '#B5935B';
        this.ctx.lineWidth = 1;
        
        // Top base ring
        this.ctx.beginPath();
        this.ctx.roundRect(colX - 7, this.bottomLimitY, 14, 3, 0.5);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Bottom base ring
        this.ctx.beginPath();
        this.ctx.roundRect(colX - 9, this.bottomLimitY + 3, 18, 4, 0.5);
        this.ctx.fill();
        this.ctx.stroke();
    }

    // 3D Vine Wrapping path helper (looser wrap, low frequency)
    drawPillarVinePath(colX, phase, layer) {
        this.ctx.save();
        
        this.ctx.beginPath();
        let drawing = false;
        
        for (let y = this.topLimitY - 10; y <= this.bottomLimitY + 10; y += 2) {
            const theta = y * 0.035 + phase;
            const z = Math.cos(theta);
            const x = colX + Math.sin(theta) * 9;
            
            const isCorrectLayer = (layer === 'front') ? (z > 0) : (z <= 0);
            
            if (isCorrectLayer) {
                const prevTheta = (y - 2) * 0.035 + phase;
                const prevX = colX + Math.sin(prevTheta) * 9;
                
                if (!drawing) {
                    this.ctx.moveTo(prevX, y - 2);
                    drawing = true;
                }
                this.ctx.lineTo(x, y);
            } else {
                drawing = false;
            }
        }
        
        if (layer === 'front') {
            this.ctx.strokeStyle = '#1b3314';
            this.ctx.lineWidth = 3.0;
        } else {
            this.ctx.strokeStyle = '#0d1c0a';
            this.ctx.lineWidth = 1.8;
        }
        this.ctx.stroke();
        
        // Draw highlight if front layer
        if (layer === 'front') {
            this.ctx.beginPath();
            let drawingHighlight = false;
            for (let y = this.topLimitY - 10; y <= this.bottomLimitY + 10; y += 2) {
                const theta = y * 0.035 + phase;
                const z = Math.cos(theta);
                const x = colX + Math.sin(theta) * 9;
                if (z > 0) {
                    const prevTheta = (y - 2) * 0.035 + phase;
                    const prevX = colX + Math.sin(prevTheta) * 9;
                    if (!drawingHighlight) {
                        this.ctx.moveTo(prevX, y - 2);
                        drawingHighlight = true;
                    }
                    this.ctx.lineTo(x, y);
                } else {
                    drawingHighlight = false;
                }
            }
            this.ctx.strokeStyle = '#4e7a3a';
            this.ctx.lineWidth = 1.0;
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    // Drawing loop
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update rotation angle if flipping
        if (this.isFlipping) {
            const now = performance.now();
            const pct = Math.min(1.0, (now - this.flipStart) / this.flipDuration);
            
            // Cubic ease-in-out
            const ease = pct < 0.5 ? 4 * pct * pct * pct : 1 - Math.pow(-2 * pct + 2, 3) / 2;
            this.renderAngle = this.startAngle + (this.targetAngle - this.startAngle) * ease;
            
            if (pct >= 1.0) {
                this.isFlipping = false;
                this.renderAngle = 0;
                
                // Swap sand metrics: elapsed becomes what fell down (or remaining reset)
                if (this.elapsedSeconds > 0 && this.elapsedSeconds < this.totalSeconds) {
                    // Physical sand inversion: the sand at the bottom (elapsedSeconds) is now at the top.
                    this.totalSeconds = this.elapsedSeconds;
                } else {
                    // Reset to active preset if completed or at start
                    const activePreset = document.querySelector('.preset-btn.active');
                    this.totalSeconds = activePreset ? parseInt(activePreset.dataset.duration) : 1500;
                }
                this.elapsedSeconds = 0;
                this.updateClockDisplay();
                
                if (this.wasRunningBeforeFlip) {
                    this.startTimer();
                } else {
                    this.timerStatus.innerText = `${this.currentMode.toUpperCase()} READY // FLIPPED`;
                }
            }
        }

        const progress = Math.min(1.0, this.elapsedSeconds / this.totalSeconds);
        const isFocusMode = document.body.classList.contains('focus-mode-active');

        // Apply rotation to coordinates
        this.ctx.save();
        this.ctx.translate(this.cX, this.cY);
        this.ctx.rotate(this.renderAngle);
        this.ctx.translate(-this.cX, -this.cY);

        // ==========================================
        // STEP 1: Draw Back Vines (Behind Pillars)
        // ==========================================
        if (!isFocusMode) {
            this.drawPillarVinePath(this.cX - 66, 0, 'back');       // Left pillar back vine
            this.drawPillarVinePath(this.cX + 66, Math.PI, 'back'); // Right pillar back vine
        }

        // ==========================================
        // STEP 2: Draw Columns & Plates (3D Frame)
        // ==========================================
        this.drawColumn(this.cX - 66); // Left pillar
        this.drawColumn(this.cX + 66); // Right pillar

        // Tiered 3D Top Plate Pedestal (masking columns seamlessly)
        // Tier 3 (lowest): y=50, rx=70, ry=7, height=5
        this.draw3DCylinder(this.cX, this.topLimitY, 70, 7, 5, '#1e1107', '#B5935B', '#422b1c');
        // Tier 2 (middle): y=45, rx=75, ry=7.5, height=11
        this.draw3DCylinder(this.cX, this.topLimitY - 5, 75, 7.5, 11, '#26160d', '#B5935B', '#593c28');
        this.drawGreekKeyPattern(this.cX, this.topLimitY - 5, 75, 7.5, 11);
        // Tier 1 (top-most): y=34, rx=80, ry=8, height=6
        this.draw3DCylinder(this.cX, this.topLimitY - 16, 80, 8, 6, '#1e1107', '#B5935B', '#422b1c');

        // Tiered 3D Bottom Plate Pedestal (masking columns seamlessly)
        // Tier 3 (upper): y=295, rx=70, ry=7, height=5
        this.draw3DCylinder(this.cX, this.bottomLimitY + 5, 70, 7, 5, '#1e1107', '#B5935B', '#422b1c');
        // Tier 2 (middle): y=306, rx=75, ry=7.5, height=11
        this.draw3DCylinder(this.cX, this.bottomLimitY + 16, 75, 7.5, 11, '#26160d', '#B5935B', '#593c28');
        this.drawGreekKeyPattern(this.cX, this.bottomLimitY + 16, 75, 7.5, 11);
        // Tier 1 (bottom-most): y=312, rx=80, ry=8, height=6
        this.draw3DCylinder(this.cX, this.bottomLimitY + 22, 80, 8, 6, '#1e1107', '#B5935B', '#422b1c');

        // ==========================================
        // STEP 3: Draw Top Sand (Draining)
        // ==========================================
        if (progress < 1.0) {
            this.ctx.save();
            this.defineTopGlassPath();
            this.ctx.clip();
            
            const remainingRatio = 1 - progress;
            const sandHeight = remainingRatio * 110;
            const sandTopY = this.neckY - sandHeight;

            this.ctx.fillStyle = 'rgba(181, 147, 91, 0.9)';
            this.ctx.beginPath();
            this.ctx.moveTo(this.cX - 70, sandTopY);
            
            const depressionDip = Math.sin(progress * Math.PI) * 12 + 2;
            this.ctx.lineTo(this.cX, Math.min(this.neckY - 2, sandTopY + depressionDip));
            
            this.ctx.lineTo(this.cX + 70, sandTopY);
            this.ctx.lineTo(this.cX + 70, this.neckY);
            this.ctx.lineTo(this.cX - 70, this.neckY);
            this.ctx.closePath();
            this.ctx.fill();

            const dipY = Math.min(this.neckY - 2, sandTopY + depressionDip);
            this.ctx.fillStyle = 'rgba(2, 2, 2, 0.15)';
            this.ctx.beginPath();
            const grainsCountTop = (this.numSandGrains * remainingRatio) | 0;
            for (let i = 0; i < grainsCountTop; i++) {
                const noise = this.sandNoisePool[i];
                const sx = this.cX + noise.rx * 110 * remainingRatio;
                const sy = sandTopY + noise.ry * sandHeight;
                const dx = Math.abs(sx - this.cX);
                const surfaceY = dipY + (sandTopY - dipY) * Math.min(1, dx / 70);
                if (sy >= surfaceY && dx <= this.getGlassWidth(sy)) {
                    this.ctx.rect(sx, sy, 1, 1);
                }
            }
            this.ctx.fill();
            this.ctx.restore();
        }

        // ==========================================
        // STEP 4: Draw Bottom Sand (Accumulating)
        // ==========================================
        if (progress > 0) {
            this.ctx.save();
            this.defineBottomGlassPath();
            this.ctx.clip();

            this.ctx.fillStyle = 'rgba(181, 147, 91, 0.9)';
            this.ctx.beginPath();
            this.ctx.moveTo(this.cX - 60, this.bottomLimitY);
            
            const pilePeakY = this.bottomLimitY - (progress * 80);
            this.ctx.quadraticCurveTo(this.cX - 30, pilePeakY + (this.bottomLimitY - pilePeakY) * 0.25, this.cX, pilePeakY);
            this.ctx.quadraticCurveTo(this.cX + 30, pilePeakY + (this.bottomLimitY - pilePeakY) * 0.25, this.cX + 60, this.bottomLimitY);
            this.ctx.closePath();
            this.ctx.fill();

            const H = this.bottomLimitY - pilePeakY;
            this.ctx.fillStyle = 'rgba(2, 2, 2, 0.15)';
            this.ctx.beginPath();
            const grainsCountBottom = (this.numSandGrains * progress) | 0;
            for (let i = 0; i < grainsCountBottom; i++) {
                const noise = this.sandNoisePool[i];
                const sx = this.cX + noise.rx * 110 * progress;
                const sy = pilePeakY + noise.ry * H;
                const dx = Math.abs(sx - this.cX);
                const t = 1 - Math.min(1, dx / 60);
                const pileY = pilePeakY + H * (1 - 1.5 * t + 0.5 * t * t);
                if (sy >= pileY && dx <= this.getGlassWidth(sy)) {
                    this.ctx.rect(sx, sy, 1, 1);
                }
            }
            this.ctx.fill();
            this.ctx.restore();
        }

        // ==========================================
        // STEP 5: Draw Falling Particles
        // ==========================================
        if (this.isRunning && progress < 1.0) {
            for (let i = 0; i < 3; i++) {
                this.fallingParticles.push(new Particle(this.cX + (Math.random() - 0.5) * 3, this.neckY));
            }
        }

        for (let i = this.fallingParticles.length - 1; i >= 0; i--) {
            const p = this.fallingParticles[i];
            const hitY = this.getPileYAtX(p.x, progress);
            
            if (p.update(hitY)) {
                for (let j = 0; j < 2; j++) {
                    this.splashParticles.push(new SplashParticle(p.x, hitY));
                }
                this.fallingParticles.splice(i, 1);
            } else {
                p.draw(this.ctx);
            }
        }

        for (let i = this.splashParticles.length - 1; i >= 0; i--) {
            const sp = this.splashParticles[i];
            if (sp.update()) {
                this.splashParticles.splice(i, 1);
            } else {
                sp.draw(this.ctx);
            }
        }

        // ==========================================
        // STEP 6: Draw Glass Outlines & Glint
        // ==========================================
        this.ctx.strokeStyle = 'rgba(181, 147, 91, 0.35)';
        this.ctx.lineWidth = 1.5;
        
        this.defineTopGlassPath();
        this.ctx.stroke();
        
        this.defineBottomGlassPath();
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(244, 241, 234, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.cX - 5, this.neckY - 5);
        this.ctx.quadraticCurveTo(this.cX - 4, this.neckY, this.cX - 5, this.neckY + 5);
        this.ctx.moveTo(this.cX + 5, this.neckY - 5);
        this.ctx.quadraticCurveTo(this.cX + 4, this.neckY, this.cX + 5, this.neckY + 5);
        this.ctx.stroke();

        // Curved 3D glass reflections/glints inside bulbs
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        // Top left glint
        this.ctx.moveTo(this.cX - 52, this.topLimitY + 15);
        this.ctx.bezierCurveTo(this.cX - 50, this.cY - 45, this.cX - 12, this.cY - 22, this.cX - 10, this.neckY - 12);
        // Bottom left glint
        this.ctx.moveTo(this.cX - 10, this.neckY + 12);
        this.ctx.bezierCurveTo(this.cX - 12, this.cY + 22, this.cX - 50, this.cY + 45, this.cX - 52, this.bottomLimitY - 15);
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.lineWidth = 1.0;
        this.ctx.beginPath();
        // Top right glint
        this.ctx.moveTo(this.cX + 52, this.topLimitY + 15);
        this.ctx.bezierCurveTo(this.cX + 50, this.cY - 45, this.cX + 12, this.cY - 22, this.cX + 10, this.neckY - 12);
        // Bottom right glint
        this.ctx.moveTo(this.cX + 10, this.neckY + 12);
        this.ctx.bezierCurveTo(this.cX + 12, this.cY + 22, this.cX + 50, this.cY + 45, this.cX + 52, this.bottomLimitY - 15);
        this.ctx.stroke();

        // ==========================================
        // STEP 7: Draw Front Vines & Gothic Leaves/Roses
        // ==========================================
        if (!isFocusMode) {
            this.drawPillarVinePath(this.cX - 66, 0, 'front');       // Left pillar front vine
            this.drawPillarVinePath(this.cX + 66, Math.PI, 'front'); // Right pillar front vine

            // Continuous organic glass vine wrapping diagonally in front of glass
            this.ctx.save();
            this.ctx.strokeStyle = '#1c3615';
            this.ctx.lineWidth = 2.8;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(this.cX - 66, 230);
            this.ctx.bezierCurveTo(this.cX - 50, 215, this.cX - 35, 195, this.cX - 10, 175);
            this.ctx.bezierCurveTo(this.cX - 5, 171, this.cX + 5, 169, this.cX + 15, 165);
            this.ctx.bezierCurveTo(this.cX + 35, 145, this.cX + 50, 125, this.cX + 66, 110);
            this.ctx.stroke();

            // Glass vine highlight
            this.ctx.strokeStyle = '#4d7d3d';
            this.ctx.lineWidth = 1.0;
            this.ctx.beginPath();
            this.ctx.moveTo(this.cX - 66, 230);
            this.ctx.bezierCurveTo(this.cX - 50, 215, this.cX - 35, 195, this.cX - 10, 175);
            this.ctx.bezierCurveTo(this.cX - 5, 171, this.cX + 5, 169, this.cX + 15, 165);
            this.ctx.bezierCurveTo(this.cX + 35, 145, this.cX + 50, 125, this.cX + 66, 110);
            this.ctx.stroke();
            this.ctx.restore();

            // Horizontal plate vines following the front ellipse edges
            this.ctx.strokeStyle = '#1c3615';
            this.ctx.lineWidth = 2.0;
            this.ctx.beginPath();
            this.ctx.ellipse(this.cX, this.topLimitY, 70, 7, 0, 0, Math.PI, false);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.ellipse(this.cX, this.bottomLimitY, 70, 7, 0, 0, Math.PI, false);
            this.ctx.stroke();

            // Draw scattered leaves organically (none around time text)
            const leaves = [
                // Top plate area
                {x: this.cX - 55, y: this.topLimitY - 14, angle: -0.5, scale: 0.9},
                {x: this.cX - 30, y: this.topLimitY - 16, angle: -0.25, scale: 1.0},
                {x: this.cX + 25, y: this.topLimitY - 15, angle: 0.3, scale: 0.9},
                {x: this.cX + 55, y: this.topLimitY - 12, angle: 0.5, scale: 1.0},
                // Bottom plate area
                {x: this.cX - 50, y: this.bottomLimitY + 12, angle: -0.4, scale: 0.9},
                {x: this.cX - 15, y: this.bottomLimitY + 14, angle: -0.2, scale: 1.0},
                {x: this.cX + 20, y: this.bottomLimitY + 13, angle: 0.25, scale: 0.9},
                {x: this.cX + 50, y: this.bottomLimitY + 15, angle: 0.45, scale: 1.0},
                // Left column
                {x: this.cX - 74, y: this.topLimitY + 20, angle: -0.2, scale: 0.9},
                {x: this.cX - 58, y: this.topLimitY + 75, angle: 0.4, scale: 1.0},
                {x: this.cX - 76, y: this.topLimitY + 115, angle: -0.5, scale: 0.8},
                {x: this.cX - 58, y: this.topLimitY + 155, angle: 0.3, scale: 1.0},
                {x: this.cX - 74, y: this.topLimitY + 215, angle: -0.3, scale: 0.9},
                // Right column
                {x: this.cX + 58, y: this.topLimitY + 30, angle: -0.4, scale: 0.9},
                {x: this.cX + 74, y: this.topLimitY + 70, angle: 0.3, scale: 1.0},
                {x: this.cX + 56, y: this.topLimitY + 125, angle: -0.3, scale: 0.8},
                {x: this.cX + 75, y: this.topLimitY + 175, angle: 0.4, scale: 1.0},
                {x: this.cX + 58, y: this.topLimitY + 235, angle: -0.5, scale: 0.9},
                // Glass vine
                {x: this.cX - 48, y: this.neckY + 55, angle: 0.5, scale: 1.0},
                {x: this.cX + 48, y: this.neckY - 55, angle: -0.5, scale: 1.0}
            ];
            
            leaves.forEach(lf => {
                this.drawLeaf(lf.x, lf.y, lf.angle, lf.scale);
            });

            // Draw scattered roses organically (no neat rows of 3 at top/bottom, halved count, none around time text)
            const roses = [
                // Scattered along left column / vine (lower)
                {x: this.cX - 62, y: this.topLimitY + 180, scale: 1.0},
                // Scattered along right column / vine (upper & lower)
                {x: this.cX + 64, y: this.topLimitY + 95, scale: 1.0},
                {x: this.cX + 70, y: this.topLimitY + 220, scale: 1.0},
                // Scattered trailing off top/bottom plates (asymmetrical, away from center)
                {x: this.cX - 45, y: this.topLimitY - 12, scale: 1.05},
                {x: this.cX + 45, y: this.topLimitY - 12, scale: 1.05},
                {x: this.cX - 40, y: this.bottomLimitY + 12, scale: 1.05},
                {x: this.cX + 40, y: this.bottomLimitY + 12, scale: 1.05}
            ];
            
            roses.forEach(rs => {
                this.drawDetailedRose(rs.x, rs.y, rs.scale);
            });
        }

        this.ctx.restore();
    }

    // Animation frames controller
    animLoop() {
        this.draw();
        // Only continue loop if running, flipping, or particles are active
        if (this.isRunning || this.isFlipping || this.fallingParticles.length > 0 || this.splashParticles.length > 0) {
            this.animFrameId = requestAnimationFrame(() => this.animLoop());
        } else {
            this.animFrameId = null;
        }
    }

    // Format seconds to digital clock
    updateClockDisplay() {
        const remaining = Math.max(0, this.totalSeconds - this.elapsedSeconds);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const pad = (n) => String(n).padStart(2, '0');
        
        this.digitalDisplay.innerText = `${pad(mins)}:${pad(secs)}`;
        
        // Update browser tab title too
        const modeLabel = this.currentMode === 'focus' ? 'Focus' : 'Break';
        document.title = `(${pad(mins)}:${pad(secs)}) ${modeLabel} | Sanctum`;

        // Progress line bar width
        const ratio = this.totalSeconds > 0 ? (this.elapsedSeconds / this.totalSeconds) * 100 : 0;
        this.progressBar.style.width = `${ratio}%`;
    }

    startTimer() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        // Resume canvas physics rendering loop
        if (!this.animFrameId) {
            this.animLoop();
        }

        this.startText.innerText = "PAUSE FOCUS";
        this.startBtn.classList.remove('primary-btn');
        this.timerStatus.innerText = `${this.currentMode.toUpperCase()} SESSION // TICKING`;

        // Play brief sub-harmonic start tone
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContextClass();
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

        this.timerInterval = setInterval(() => {
            this.elapsedSeconds++;
            this.updateClockDisplay();

            if (this.elapsedSeconds >= this.totalSeconds) {
                // Focus session completed!
                clearInterval(this.timerInterval);
                this.isRunning = false;
                
                this.playChime();
                
                this.timerStatus.innerText = `${this.currentMode.toUpperCase()} COMPLETED`;
                this.startText.innerText = "BEGIN FOCUS";
                this.startBtn.classList.add('primary-btn');
                
                // Show notification if permitted
                if (Notification.permission === 'granted') {
                    new Notification(`Sandglass Chronometer`, {
                        body: `${this.currentMode === 'focus' ? 'Focus session' : 'Break'} finished! Time to rotate the glass.`
                    });
                }
            }
        }, 1000);
    }

    pauseTimer() {
        if (!this.isRunning) return;
        this.isRunning = false;
        clearInterval(this.timerInterval);
        
        this.startText.innerText = "RESUME FOCUS";
        this.startBtn.classList.add('primary-btn');
        this.timerStatus.innerText = `${this.currentMode.toUpperCase()} SESSION // PAUSED`;
    }

    flipHourglass() {
        if (this.isFlipping) return;

        this.wasRunningBeforeFlip = this.isRunning;
        this.pauseTimer();

        // Clear particles in air
        this.fallingParticles = [];
        this.splashParticles = [];

        // Start flip animation
        this.isFlipping = true;
        this.flipStart = performance.now();
        this.startAngle = this.renderAngle;
        this.targetAngle = this.renderAngle + Math.PI;

        if (!this.animFrameId) {
            this.animLoop();
        }
    }

    // Stealth Focus Mode toggles
    enterFocusMode() {
        document.body.classList.add('focus-mode-active');
        this.focusToggleDot.style.transform = 'translateX(16px)';
        this.focusToggleDot.style.backgroundColor = '#B5935B';
        this.focusToggle.style.borderColor = '#B5935B';
        
        // Request notification permission on focus mode activation
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        this.draw();
    }

    exitFocusMode() {
        document.body.classList.remove('focus-mode-active');
        this.focusToggleDot.style.transform = 'translateX(0)';
        this.focusToggleDot.style.backgroundColor = 'rgba(181, 147, 91, 0.5)';
        this.focusToggle.style.borderColor = 'rgba(181, 147, 91, 0.3)';
        this.draw();
    }

    initEventListeners() {
        // Toggle timer status
        this.startBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.pauseTimer();
            } else {
                if (this.elapsedSeconds >= this.totalSeconds) {
                    // Reset to active preset if it was a flipped/shortened timer
                    const activePreset = document.querySelector('.preset-btn.active');
                    this.totalSeconds = activePreset ? parseInt(activePreset.dataset.duration) : 1500;
                    
                    this.elapsedSeconds = 0;
                    this.updateClockDisplay();
                }
                this.startTimer();
            }
        });

        // Reset/Flip timer
        this.resetBtn.addEventListener('click', () => {
            this.flipHourglass();
        });

        // Click on canvas directly also triggers flip
        this.canvas.addEventListener('click', () => {
            this.flipHourglass();
        });

        // Preset selectors
        this.presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isRunning) {
                    if (!confirm("A focus session is currently active. Change preset anyway?")) {
                        return;
                    }
                }
                
                this.pauseTimer();
                this.presetButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.totalSeconds = parseInt(btn.dataset.duration);
                this.elapsedSeconds = 0;

                // Determine if preset is break or focus based on text
                const label = btn.innerText.toLowerCase();
                if (label.includes('break')) {
                    this.currentMode = 'break';
                    this.timerStatus.innerText = `BREAK READY // ${this.totalSeconds / 60}m`;
                    this.startText.innerText = "BEGIN BREAK";
                } else {
                    this.currentMode = 'focus';
                    this.timerStatus.innerText = `FOCUS READY // ${this.totalSeconds / 60}m`;
                    this.startText.innerText = "BEGIN FOCUS";
                }

                // Reset particles
                this.fallingParticles = [];
                this.splashParticles = [];
                
                this.updateClockDisplay();
                this.draw();
            });
        });

        this.focusToggle.addEventListener('click', () => {
            const isFocus = document.body.classList.contains('focus-mode-active');
            if (isFocus) {
                this.exitFocusMode();
            } else {
                this.enterFocusMode();
            }
        });

        this.exitFocusBtn.addEventListener('click', () => {
            this.exitFocusMode();
        });

        // Listen to keyboard shortcut Escape to exit focus mode
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('focus-mode-active')) {
                this.exitFocusMode();
            }
        });
    }
}
