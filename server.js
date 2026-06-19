const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs').promises;
const app = express();
app.set('trust proxy', true);
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Route modules (handles /blog/:slug)
const blogRouter = require('./routes/blog');

// Set Templating Engine
app.use(expressLayouts);
app.set('layout', './layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Disable caching in development for hot-reloads and emulation stability
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


// Quotes Data & Caching Engine
const QUOTES_DATA = require('./content/quotes');
const quoteStatePath = path.join(__dirname, 'content', 'quote-state.json');

async function getDailyQuote() {
    let state = { lastUpdatedDate: "", currentIndex: -1 };
    try {
        const data = await fs.readFile(quoteStatePath, 'utf8');
        state = JSON.parse(data);
    } catch (err) {
        // Fallback to defaults if file missing
    }

    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone

    if (state.lastUpdatedDate !== today) {
        state.currentIndex = (state.currentIndex + 1) % QUOTES_DATA.length;
        state.lastUpdatedDate = today;
        try {
            await fs.writeFile(quoteStatePath, JSON.stringify(state, null, 2), 'utf8');
        } catch (err) {
            console.error('[Quote State Write Error]', err.message);
        }
    }

    return QUOTES_DATA[state.currentIndex];
}

// Routes
app.get('/', async (req, res) => {
    try {
        const quote = await getDailyQuote();
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
        const quote = await getDailyQuote();
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

// Map to track failed password attempts by IP
const failedAttempts = new Map();

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

app.listen(PORT, () => console.log(`Nuclear engine engaged. Sanctum Server running on port ${PORT}`));
