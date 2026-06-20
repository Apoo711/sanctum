const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../server');

test('Blog Routes Integration Tests', async (t) => {
    await t.test('GET /blog/:slug with a nonexistent slug should return 404 status and render the 404 page', async () => {
        const response = await request(app)
            .get('/blog/nonexistent-blog-slug-test')
            .expect(404);

        assert.match(response.text, /404/i);
    });
});
