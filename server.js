try {
    if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile();
    }
} catch (e) {
}

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const trustedProxies = process.env.TRUSTED_PROXIES
    ? process.env.TRUSTED_PROXIES.split(',').map(ip => ip.trim())
    : ['loopback', 'linklocal', 'uniquelocal'];
app.set('trust proxy', trustedProxies);
app.use(express.json());
const PORT = process.env.PORT || 3000;

const blogRouter = require('./routes/blog');

app.use(expressLayouts);
app.set('layout', './layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.version = process.env.ASSETS_VERSION || '1.1.5';

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        next();
    });
    app.use(express.static(path.join(__dirname, 'public'), {
        etag: false,
        maxAge: 0,
        setHeaders: (res, path) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
    }));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
}

const QUOTES_DATA = require('./content/quotes');
const quoteStatePath = path.join(__dirname, 'content', 'quote-state.json');

let cachedQuoteState = null;

async function fetchQuoteState(today) {
    if (!cachedQuoteState || cachedQuoteState.lastUpdatedDate !== today) {
        try {
            const data = await fs.readFile(quoteStatePath, 'utf8');
            cachedQuoteState = JSON.parse(data);
        } catch (err) {
            console.error('[Quote State Read Error]', err.message);
            cachedQuoteState = cachedQuoteState || { lastUpdatedDate: "", currentIndex: -1 };
        }
    }
}

async function updateQuoteState(today) {
    if (cachedQuoteState.lastUpdatedDate !== today) {
        cachedQuoteState.currentIndex = (cachedQuoteState.currentIndex + 1) % QUOTES_DATA.length;
        cachedQuoteState.lastUpdatedDate = today;
        try {
            await fs.writeFile(quoteStatePath, JSON.stringify(cachedQuoteState, null, 2), 'utf8');
        } catch (err) {
            console.error('[Quote State Write Error]', err.message);
        }
    }
}

async function getDailyQuote() {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
    await fetchQuoteState(today);
    await updateQuoteState(today);
    return QUOTES_DATA[cachedQuoteState.currentIndex];
}

const quotesHelper = {
    getDailyQuote
};

// Routes
app.get('/', async (req, res) => {
    try {
        const quote = await quotesHelper.getDailyQuote();
        res.render('index', {
            title: 'Aryan Gupta | Sanctum',
            description: 'Personal portfolio, laboratory, and digital sanctum.',
            quote
        });
    } catch (err) {
        console.error('[Error loading daily quote]', err);
        res.render('index', {
            title: 'Aryan Gupta | Sanctum',
            description: 'Personal portfolio, laboratory, and digital sanctum.',
            quote: { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" }
        });
    }
});

app.get('/api/quote', async (req, res) => {
    try {
        const quote = await quotesHelper.getDailyQuote();
        res.json(quote);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve daily quote' });
    }
});

app.get('/pomodoro', (req, res) => {
    res.render('pomodoro', {
        title: 'The Sandglass | Sanctum',
        description: 'An interactive mechanical focus chronometer.'
    });
});

// Scriptorium Subjects Data
const SUBJECTS_DATA = require('./content/subjects-data');

app.get('/resources', (req, res) => {
    res.render('resources', { 
        title: 'The Scriptorium',
        subjects: Object.values(SUBJECTS_DATA)
    });
});

app.get('/resources/:subject', (req, res) => {
    const subjectKey = req.params.subject.toLowerCase();
    const subject = SUBJECTS_DATA[subjectKey];
    if (!subject) {
        return res.status(404).render('404', { title: '404 - Gateway Offline' });
    }
    res.render('subject', {
        title: `${subject.name} | The Scriptorium`,
        subject
    });
});

app.get('/resources/download/:subject/:title', (req, res) => {
    const { subject, title } = req.params;
    const subjectData = SUBJECTS_DATA[subject.toLowerCase()];
    if (!subjectData) {
        return res.status(404).render('404', { title: '404 - Gateway Offline' });
    }
    const lowercasedTitle = title.toLowerCase();
    const resource = subjectData.resources.find(r => r.title.toLowerCase() === lowercasedTitle);
    if (!resource || !resource.downloadUrl) {
        return res.status(404).render('404', { title: '404 - Gateway Offline' });
    }

    // Validate the redirect URL to prevent Open Redirect vulnerability
    try {
        const parsedUrl = new URL(resource.downloadUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return res.status(400).send('Bad Request: Invalid protocol');
        }
        if (parsedUrl.hostname !== 'github.com') {
            return res.status(400).send('Bad Request: Disallowed download host');
        }
    } catch (e) {
        return res.status(400).send('Bad Request: Invalid download URL');
    }

    res.redirect(resource.downloadUrl);
});


app.get('/api/recently-played', async (req, res) => {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/recently-played');
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error('[YTMusic Proxy Error]', err.message);
        res.status(502).json({
            status: 'error',
            message: 'Unable to fetch music data from backend service'
        });
    }
});

// Render the Poems Codex page
app.get('/poems', (req, res) => {
    res.render('poems', {
        title: 'The Codex | Sanctum',
        description: 'A locked volume containing compiled verses, personal poetry, and digital manuscripts.'
    });
});

app.get('/prospectus', (req, res) => {
    res.render('prospectus', {
        title: 'The Prospectus | Sanctum',
        description: "The Scholar's Desk. Explore technical dossiers, research portfolios, and digital manuscripts.",
        email: process.env.CONTACT_EMAIL || ''
    });
});

class Node {
    constructor(key, value) {
        this.key = key; // IP address
        this.value = value; // Record: { count, blockedUntil, lastAttempt }
        this.prev = null;
        this.next = null;
    }
}

// A Map wrapper that implements eviction (size limit) and TTL cleanup to prevent memory exhaustion
class FailedAttemptsTracker {
    constructor(maxSize = 1000, ttlMs = 30 * 60 * 1000) {
        this.map = new Map(); // ip -> record (for backwards compatibility/tests)
        this.nodeMap = new Map(); // ip -> Node
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.head = null; // Node (oldest/LRU)
        this.tail = null; // Node (newest/MRU)
    }

    _remove(node) {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
        node.prev = null;
        node.next = null;
    }

    _appendToTail(node) {
        if (!this.head) {
            this.head = node;
            this.tail = node;
        } else {
            this.tail.next = node;
            node.prev = this.tail;
            this.tail = node;
        }
    }

    _moveToTail(node) {
        this._remove(node);
        this._appendToTail(node);
    }

    get(ip) {
        this.pruneExpired();
        return this.map.get(ip);
    }

    set(ip, record) {
        this.pruneExpired();

        // If the entry doesn't exist and we are at/over the capacity, evict the oldest
        if (!this.map.has(ip) && this.map.size >= this.maxSize) {
            if (this.head) {
                this.delete(this.head.key);
            }
        }

        record.lastAttempt = Date.now();
        this.map.set(ip, record);

        let node = this.nodeMap.get(ip);
        if (node) {
            node.value = record;
            this._moveToTail(node);
        } else {
            node = new Node(ip, record);
            this.nodeMap.set(ip, node);
            this._appendToTail(node);
        }
    }

    delete(ip) {
        const node = this.nodeMap.get(ip);
        if (node) {
            this._remove(node);
            this.nodeMap.delete(ip);
        }
        return this.map.delete(ip);
    }

    pruneExpired() {
        const now = Date.now();
        let current = this.head;
        while (current) {
            const record = current.value;
            const isBlocked = record.blockedUntil && record.blockedUntil > now;
            const isExpired = (now - record.lastAttempt) > this.ttlMs;

            if (isExpired) {
                const nextNode = current.next;
                if (!isBlocked) {
                    this.delete(current.key);
                }
                current = nextNode;
            } else {
                // Since the list is sorted by lastAttempt, if this node is not expired,
                // no subsequent node can be expired either.
                break;
            }
        }
    }
}

// Tracker to manage failed password attempts by IP with a size limit and TTL eviction
const failedAttempts = new FailedAttemptsTracker();

// Proxy endpoint to fetch poems from Rust backend
app.post('/api/poems', async (req, res) => {
    const ip = req.ip;
    const now = Date.now();

    // Check if this IP is blocked
    const record = failedAttempts.get(ip);
    if (record && record.blockedUntil && record.blockedUntil > now) {
        const remainingMinutes = Math.ceil((record.blockedUntil - now) / 60000);
        return res.status(429).json({
            status: 'error',
            message: `Too many incorrect attempts. Locked out for ${remainingMinutes} more minutes.`
        });
    }

    try {
        const response = await fetch('http://127.0.0.1:8000/api/poems', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        
        if (response.status === 401) {
            // Track failed attempts
            let rec = failedAttempts.get(ip) || { count: 0, blockedUntil: 0 };
            rec.count += 1;
            if (rec.count >= 5) {
                rec.blockedUntil = now + 15 * 60 * 1000; // Block for 15 minutes
                rec.count = 0;
            }
            failedAttempts.set(ip, rec);

            return res.status(401).json({
                status: 'error',
                message: 'Invalid passkey cipher.'
            });
        }
        
        if (!response.ok) {
            return res.status(response.status).json({
                status: 'error',
                message: 'Backend server returned an error.'
            });
        }

        // Reset failures on success
        failedAttempts.delete(ip);

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error('[Poems Proxy Error]', err.message);
        res.status(502).json({
            status: 'error',
            message: 'Unable to fetch poems from backend service'
        });
    }
});

// Blog post — delegates /blog/:slug to router
app.use('/blog', blogRouter);

// 404 handler for missing routes
app.use((req, res) => {
    res.status(404).render('404', { title: '404 - Gateway Offline' });
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`Nuclear engine engaged. Sanctum Server running on port ${PORT}`));
}

module.exports = { app, quotesHelper, failedAttempts, FailedAttemptsTracker };
