const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs').promises;
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// Set Templating Engine
app.use(expressLayouts);
app.set('layout', './layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Aryan Gupta | Sanctum',
        description: 'Personal portfolio, laboratory, and digital sanctum.' 
    });
});

app.get('/blog', (req, res) => {
    res.render('blog', { title: 'The Chronicles' });
});

app.get('/resources', (req, res) => {
    res.render('resources', { title: 'The Scriptorium' });
});

// Legacy Blog Renderer Route
app.get('/blog/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const filePath = path.join(__dirname, '_legacy_v1', 'docs', `${slug}.md`);
        
        // Read the markdown file
        const data = await fs.readFile(filePath, 'utf8');
        
        // Convert to HTML
        const htmlContent = marked.parse(data);
        
        res.render('blog', { 
            title: `Document: ${slug}`,
            content: htmlContent
        });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).render('404', { title: '404 - Document Not Found' });
        } else {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    }
});

// 404 handler for missing routes
app.use((req, res) => {
    res.status(404).render('404', { title: '404 - Gateway Offline' });
});

app.listen(PORT, () => console.log(`Nuclear engine engaged. Sanctum Server running on port ${PORT}`));
