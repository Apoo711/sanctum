const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs').promises;
const app = express();
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


// Routes
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Aryan Gupta | Sanctum',
        description: 'Personal portfolio, laboratory, and digital sanctum.'
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
    const resource = subjectData.resources.find(r => r.title.toLowerCase() === title.toLowerCase());
    if (!resource || !resource.downloadUrl) {
        return res.status(404).render('404', { title: '404 - Gateway Offline' });
    }
    res.redirect(resource.downloadUrl);
});


// Proxy endpoint to get YouTube Music Recently Played
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

// Proxy endpoint to fetch poems from Rust backend
app.post('/api/poems', async (req, res) => {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/poems', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        
        if (response.status === 401) {
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
