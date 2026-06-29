const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');
const matter = require('gray-matter');
const { marked } = require('marked');
const { generateSitemapXml } = require('./utils/sitemap');

const DIST_DIR = path.join(__dirname, 'dist');
const VIEWS_DIR = path.join(__dirname, 'views');
const LOGS_DIR = path.join(__dirname, 'content', 'logs');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Scriptorium Subjects Data
const SUBJECTS_DATA = require('./content/subjects-data');

// Helper to copy directory recursively
async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }));
}

// Helper to render an EJS view with the default layout
async function renderView(viewName, data, outputPath) {
    const layoutPath = path.join(VIEWS_DIR, 'layout.ejs');
    const viewPath = path.join(VIEWS_DIR, `${viewName}.ejs`);
    
    // Pass standard title and description locals
    const locals = {
        title: data.title || 'Aryan Gupta | Sanctum',
        description: data.description || 'Personal portfolio, laboratory, and digital sanctum.',
        ...data
    };

    const bodyContent = await ejs.renderFile(viewPath, locals);
    const fullHtml = await ejs.renderFile(layoutPath, {
        ...locals,
        body: bodyContent
    });
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, fullHtml, 'utf8');
    console.log(`[BUILD] Compiled: ${path.relative(__dirname, outputPath)}`);
}

async function build() {
    try {
        console.log('[BUILD] Starting static compilation...');
        
        // 1. Clean and create dist dir
        await fs.rm(DIST_DIR, { recursive: true, force: true });
        await fs.mkdir(DIST_DIR, { recursive: true });

        // 2. Render Index
        let dailyQuote = { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" };
        try {
            const quotes = require('./content/quotes');
            if (quotes && quotes.length > 0) {
                dailyQuote = quotes[0];
            }
        } catch (e) {
            console.warn('[BUILD] Could not load quotes list, using default.');
        }

        await renderView('index', {
            title: 'Aryan Gupta | Sanctum',
            description: 'Personal portfolio, laboratory, and digital sanctum.',
            quote: dailyQuote
        }, path.join(DIST_DIR, 'index.html'));

        // Render Sandglass (Pomodoro) Page
        await renderView('pomodoro', {
            title: 'The Sandglass | Sanctum',
            description: 'Focus chronometer and study companion.'
        }, path.join(DIST_DIR, 'pomodoro', 'index.html'));

        // Render Prospectus Page
        await renderView('prospectus', {
            title: 'The Prospectus | Sanctum',
            description: "The Scholar's Desk. Explore technical dossiers, research portfolios, and digital manuscripts."
        }, path.join(DIST_DIR, 'prospectus', 'index.html'));

        // Render 404 Page
        await renderView('404', {
            title: '404 - Gateway Offline',
            description: 'The requested path has fractured from the coordinates. Return to index.'
        }, path.join(DIST_DIR, '404.html'));

        // 3. Render Poems Page
        await renderView('poems', {
            title: 'The Codex | Sanctum',
            description: 'A locked volume containing compiled verses, personal poetry, and digital manuscripts.'
        }, path.join(DIST_DIR, 'poems', 'index.html'));

        // 4. Render Resources (The Scriptorium)
        await renderView('resources', {
            title: 'The Scriptorium',
            subjects: Object.values(SUBJECTS_DATA)
        }, path.join(DIST_DIR, 'resources', 'index.html'));

        // 5. Render individual Scriptorium subjects
        for (const key in SUBJECTS_DATA) {
            const subject = SUBJECTS_DATA[key];
            await renderView('subject', {
                title: `${subject.name} | The Scriptorium`,
                subject
            }, path.join(DIST_DIR, 'resources', subject.slug, 'index.html'));
        }

        // 6. Render Blog Chronicles & individual articles
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

        // Render blog list
        await renderView('blog', {
            title: 'The Chronicles | Sanctum',
            description: 'Expedition logs, conceptual dispatches, and structural observations from the Sanctum.',
            posts
        }, path.join(DIST_DIR, 'blog', 'index.html'));

        // Render individual blog posts
        await Promise.all(posts.map(async (post) => {
            const filePath = path.join(LOGS_DIR, `${post.slug}.md`);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const { data: meta, content } = matter(fileContent);
            const html = marked.parse(content);

            await renderView('post', {
                title: `${meta.title} | The Chronicles`,
                description: meta.description || '',
                meta,
                content: html
            }, path.join(DIST_DIR, 'blog', post.slug, 'index.html'));
        }));

        // 7. Copy static assets (css, js, images)
        await copyDir(PUBLIC_DIR, DIST_DIR);
        console.log('[BUILD] Static assets copied successfully.');

        // 8. Generate Sitemap
        console.log('[BUILD] Generating sitemap...');
        const sitemapXml = await generateSitemapXml();
        await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
        console.log('[BUILD] Sitemap generated successfully.');

        console.log('[BUILD] Compilation finished successfully. Output in /dist folder.');
    } catch (e) {
        console.error('[BUILD] Build failed:', e);
        process.exit(1);
    }
}

build();
