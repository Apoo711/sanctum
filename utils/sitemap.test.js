const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const { generateSitemapXml } = require('./sitemap');

test('Sitemap Generator', async (t) => {
    await t.test('should generate sitemap successfully under normal conditions', async () => {
        const xml = await generateSitemapXml();
        
        // Assertions
        assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
        assert.ok(xml.includes('<urlset'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/poems'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/resources'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/blog'));
        // It should contain at least one blog post in normal conditions
        assert.ok(xml.includes('/blog/'));
    });

    await t.test('should gracefully handle empty logs directory (empty array returned by readdir)', async (context) => {
        context.mock.method(fs, 'readdir', async () => {
            return [];
        });

        const xml = await generateSitemapXml();

        // Assertions
        assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/poems'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/resources'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/blog'));
        // It should NOT contain any blog posts
        assert.ok(!xml.includes('/blog/202'));
    });

    await t.test('should gracefully handle missing logs directory (readdir throws an error)', async (context) => {
        let consoleErrorCalled = false;
        context.mock.method(console, 'error', () => {
            consoleErrorCalled = true;
        });

        context.mock.method(fs, 'readdir', async () => {
            throw new Error('ENOENT: no such file or directory');
        });

        const xml = await generateSitemapXml();

        // Assertions
        assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/poems'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/resources'));
        assert.ok(xml.includes('https://aryan-gupta.is-a.dev/blog'));
        // It should NOT contain any blog posts
        assert.ok(!xml.includes('/blog/202'));
        // It should have logged the error
        assert.ok(consoleErrorCalled);
    });
});
