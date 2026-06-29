const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const matter = require('gray-matter');
const { marked } = require('marked');

const LOGS_DIR = path.join(__dirname, '..', 'content', 'logs');

// Cache container to optimize disk I/O in production
const cache = {
    posts: null,
    individualPosts: new Map(),
    clear() {
        cache.posts = null;
        cache.individualPosts.clear();
    }
};

// Expose cache for testing/admin purposes
router._cache = cache;

// GET /blog — Index of all posts
router.get('/', async (req, res) => {
    try {
        const isProd = process.env.NODE_ENV === 'production';
        if (isProd && cache.posts) {
            return res.render('blog', {
                title: 'The Chronicles | Sanctum',
                description: 'Expedition logs, conceptual dispatches, and structural observations from the Sanctum.',
                posts: cache.posts
            });
        }

        const files = await fs.readdir(LOGS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const posts = await Promise.all(
            mdFiles.map(async (filename) => {
                const raw = await fs.readFile(path.join(LOGS_DIR, filename), 'utf8');
                const { data } = matter(raw);
                // Slug = filename without the .md extension
                const slug = filename.replace(/\.md$/, '');
                return { slug, ...data };
            })
        );

        // Sort descending by date
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (isProd) {
            cache.posts = posts;
        }

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

// GET /blog/:slug — Individual post
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const isProd = process.env.NODE_ENV === 'production';

        if (isProd && cache.individualPosts.has(slug)) {
            const cached = cache.individualPosts.get(slug);
            return res.render('post', {
                title: `${cached.meta.title} | The Chronicles`,
                description: cached.meta.description || '',
                meta: cached.meta,
                content: cached.html
            });
        }

        const filePath = path.join(LOGS_DIR, `${slug}.md`);
        const raw = await fs.readFile(filePath, 'utf8');
        const { data: meta, content } = matter(raw);
        const html = marked.parse(content);

        if (isProd) {
            cache.individualPosts.set(slug, { meta, html });
        }

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
