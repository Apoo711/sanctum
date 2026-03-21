const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs').promises;
const matter = require('gray-matter');
const app = express();
const PORT = process.env.PORT || 3000;

// Route modules (handles /blog/:slug)
const blogRouter = require('./routes/blog');

// Set Templating Engine
app.use(expressLayouts);
app.set('layout', './layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

const LOGS_DIR = path.join(__dirname, 'content', 'logs');

// Routes
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Aryan Gupta | Sanctum',
        description: 'Personal portfolio, laboratory, and digital sanctum.'
    });
});

// Blog index — reads all .md files, parses frontmatter, sorts by date
app.get('/blog', async (req, res) => {
    try {
        const files = await fs.readdir(LOGS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const posts = await Promise.all(
            mdFiles.map(async (filename) => {
                const raw = await fs.readFile(path.join(LOGS_DIR, filename), 'utf8');
                const { data } = matter(raw);
                const slug = filename.replace(/\.md$/, '');
                return { slug, ...data };
            })
        );

        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render('blog', {
            title: 'The Chronicles | Sanctum',
            description: 'Expedition logs, conceptual dispatches, and structural observations from the Sanctum.',
            posts
        });
    } catch (err) {
        console.error('[Blog Index Error]', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/resources', (req, res) => {
    res.render('resources', { title: 'The Scriptorium' });
});

// Blog post — delegates /blog/:slug to router
app.use('/blog', blogRouter);

// 404 handler for missing routes
app.use((req, res) => {
    res.status(404).render('404', { title: '404 - Gateway Offline' });
});

app.listen(PORT, () => console.log(`Nuclear engine engaged. Sanctum Server running on port ${PORT}`));
