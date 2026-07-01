const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../server');
const blogRouter = require('./blog');

test('Blog Routes Integration Tests', async (t) => {
    // Save original NODE_ENV
    const originalEnv = process.env.NODE_ENV;

    t.afterEach(() => {
        // Restore environment and clear cache after each subtest
        process.env.NODE_ENV = originalEnv;
        blogRouter._cache.clear();
    });

    await t.test('GET /blog/:slug with a nonexistent slug should return 404 status and render the 404 page', async () => {
        const response = await request(app)
            .get('/blog/nonexistent-blog-slug-test')
            .expect(404);

        assert.match(response.text, /404/i);
    });

    await t.test('GET /blog/:slug with path traversal should return 404 status', async () => {
        const response = await request(app)
            .get('/blog/..%2F..%2Fserver.js')
            .expect(404);

        assert.match(response.text, /404/i);
    });

    await t.test('Cache is bypassed when NODE_ENV is not production', async () => {
        process.env.NODE_ENV = 'development';
        blogRouter._cache.clear();

        // Perform request
        const response = await request(app)
            .get('/blog')
            .expect(200);

        // Cache should remain empty/null in development mode
        assert.strictEqual(blogRouter._cache.posts, null);
    });

    await t.test('Cache is populated and used when NODE_ENV is production', async () => {
        process.env.NODE_ENV = 'production';
        blogRouter._cache.clear();

        // 1. Initial request to populate cache
        const response1 = await request(app)
            .get('/blog')
            .expect(200);

        // Cache should be populated now
        assert.ok(blogRouter._cache.posts);
        assert.ok(blogRouter._cache.posts.length > 0);

        // 2. Modify the cache to verify that the subsequent request reads from the cache
        const originalFirstPost = blogRouter._cache.posts[0];
        const modifiedPost = { ...originalFirstPost, title: 'MUTATED CACHE TITLE FOR TESTING' };
        blogRouter._cache.posts[0] = modifiedPost;

        const response2 = await request(app)
            .get('/blog')
            .expect(200);

        // The response should contain our mutated cache title
        assert.match(response2.text, /MUTATED CACHE TITLE FOR TESTING/);
    });

    await t.test('Individual post page caching in production', async () => {
        process.env.NODE_ENV = 'production';
        blogRouter._cache.clear();

        // Let's find a valid slug from the logs directory
        const fs = require('fs').promises;
        const path = require('path');
        const LOGS_DIR = path.join(__dirname, '..', 'content', 'logs');
        const files = await fs.readdir(LOGS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        if (mdFiles.length === 0) {
            throw new Error('No markdown logs found to run tests');
        }
        const slug = mdFiles[0].replace(/\.md$/, '');

        // 1. Request the post to populate cache
        await request(app)
            .get(`/blog/${slug}`)
            .expect(200);

        // Cache should have this slug
        assert.ok(blogRouter._cache.individualPosts.has(slug));
        const cachedItem = blogRouter._cache.individualPosts.get(slug);
        assert.ok(cachedItem.html);

        // 2. Modify cache entry and check if it is served
        blogRouter._cache.individualPosts.set(slug, {
            meta: { title: 'CACHE MUTATED SINGLE POST TITLE' },
            html: '<p>MUTATED HTML CONTENT FOR TESTING</p>'
        });

        const response = await request(app)
            .get(`/blog/${slug}`)
            .expect(200);

        assert.match(response.text, /CACHE MUTATED SINGLE POST TITLE/);
        assert.match(response.text, /MUTATED HTML CONTENT FOR TESTING/);
    });

    await t.test('GET /blog should return 500 status when fs.readdir fails', async (context) => {
        const fs = require('fs').promises;
        
        // Suppress console.error output during the test
        let consoleErrorCalled = false;
        context.mock.method(console, 'error', () => {
            consoleErrorCalled = true;
        });

        // Mock fs.readdir to throw an error
        context.mock.method(fs, 'readdir', async () => {
            throw new Error('Simulated readdir failure');
        });

        // Request /blog
        const response = await request(app)
            .get('/blog')
            .expect(500);

        assert.strictEqual(response.text, 'Internal Server Error');
        assert.ok(consoleErrorCalled);
    });

    await t.test('GET /blog/:slug should return 500 status when fs.readFile throws a generic error', async (context) => {
        const fs = require('fs').promises;
        
        // Suppress console.error output during the test
        let consoleErrorCalled = false;
        context.mock.method(console, 'error', () => {
            consoleErrorCalled = true;
        });

        // Mock fs.readFile to throw a generic error (non-ENOENT)
        context.mock.method(fs, 'readFile', async () => {
            const err = new Error('Simulated generic file read error');
            err.code = 'EACCES'; // A non-ENOENT code
            throw err;
        });

        // Request a blog post slug
        const response = await request(app)
            .get('/blog/any-slug')
            .expect(500);

        assert.strictEqual(response.text, 'Internal Server Error');
        assert.ok(consoleErrorCalled);
    });
});


