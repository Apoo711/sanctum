const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const matter = require('gray-matter');
const { marked } = require('marked');

const LOGS_DIR = path.join(__dirname, '..', 'content', 'logs');

// GET /chronicles — Index of all posts
router.get('/', async (req, res) => {
    try {
        const files = await fs.readdir(LOGS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const posts = await Promise.all(
            mdFiles.map(async (filename) => {
                const raw = await fs.readFile(path.join(LOGS_DIR, filename), 'utf8');
                const { data } = matter(raw);
                // Derive slug from filename: strip .md extension
                const slug = filename.replace(/\.md$/, '');
                return { slug, ...data };
            })
        );

        // Sort descending by date
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render('chronicles', {
            title: 'The Chronicles | Sanctum',
            description: 'A living manuscript — expedition logs, conceptual dispatches, and structural observations from the Sanctum.',
            posts
        });
    } catch (err) {
        console.error('[Chronicles Index Error]', err);
        res.status(500).send('Internal Server Error');
    }
});

// GET /chronicles/:slug — Individual post
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const filePath = path.join(LOGS_DIR, `${slug}.md`);
        const raw = await fs.readFile(filePath, 'utf8');
        const { data: meta, content } = matter(raw);
        const html = marked.parse(content);

        res.render('post', {
            title: `${meta.title} | The Chronicles`,
            description: meta.description || '',
            meta,
            content: html
        });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).render('404', { title: '404 — Manuscript Not Found' });
        } else {
            console.error('[Post Render Error]', err);
            res.status(500).send('Internal Server Error');
        }
    }
});

module.exports = router;
