const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const SUBJECTS_DATA = require('../content/subjects-data');

const SITE_URL = process.env.SITE_URL || 'https://aryan-gupta.is-a.dev';
const LOGS_DIR = path.join(__dirname, '../content/logs');

async function generateSitemapXml() {
    const urls = [];
    const currentDate = new Date().toISOString().split('T')[0];

    // 1. Static Pages (No trailing slashes as requested)
    urls.push({ loc: `${SITE_URL}`, lastmod: currentDate, changefreq: 'daily', priority: '1.0' });
    urls.push({ loc: `${SITE_URL}/poems`, lastmod: currentDate, changefreq: 'weekly', priority: '0.8' });
    urls.push({ loc: `${SITE_URL}/resources`, lastmod: currentDate, changefreq: 'weekly', priority: '0.8' });
    urls.push({ loc: `${SITE_URL}/blog`, lastmod: currentDate, changefreq: 'daily', priority: '0.8' });

    // 2. Resource Subjects
    for (const key in SUBJECTS_DATA) {
        const subject = SUBJECTS_DATA[key];
        urls.push({
            loc: `${SITE_URL}/resources/${subject.slug}`,
            lastmod: currentDate,
            changefreq: 'monthly',
            priority: '0.6'
        });
    }

    // 3. Blog Chronicles
    try {
        const files = await fs.readdir(LOGS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        
        for (const filename of mdFiles) {
            const filePath = path.join(LOGS_DIR, filename);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const { data } = matter(fileContent);
            const slug = filename.replace(/\.md$/, '');
            
            let lastmod = currentDate;
            if (data.date) {
                const parsedDate = new Date(data.date);
                if (!isNaN(parsedDate.getTime())) {
                    lastmod = parsedDate.toISOString().split('T')[0];
                }
            }
            
            urls.push({
                loc: `${SITE_URL}/blog/${slug}`,
                lastmod,
                changefreq: 'monthly',
                priority: '0.7'
            });
        }
    } catch (err) {
        console.error('[Sitemap Generator] Error reading blog logs:', err);
    }

    // Compile URLs into XML tags
    const xmlItems = urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`;
}

module.exports = { generateSitemapXml };
