const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { app, quotesHelper } = require('./server');

test('Server Route "/" Error Fallback', async (t) => {
    let server;
    let port;

    t.before(() => {
        // Start the server on an ephemeral port
        server = app.listen(0);
        port = server.address().port;
    });

    t.after(() => {
        // Close the server when done
        server.close();
    });

    await t.test('should render index view with default Marcus Aurelius quote when getDailyQuote fails', async (context) => {
        // Suppress console.error output during the test
        let consoleErrorCalled = false;
        context.mock.method(console, 'error', () => {
            consoleErrorCalled = true;
        });

        // Mock getDailyQuote to throw an error
        context.mock.method(quotesHelper, 'getDailyQuote', async () => {
            throw new Error('Simulated quote retrieval failure');
        });

        // Capture arguments passed to res.render
        let renderView = null;
        let renderOptions = null;
        context.mock.method(express.response, 'render', function (view, options) {
            renderView = view;
            renderOptions = options;
            // Complete the request with a status to prevent the client from hanging
            this.send('mocked render');
        });

        // Request the root route
        const response = await fetch(`http://127.0.0.1:${port}/`);
        assert.strictEqual(response.status, 200);

        const text = await response.text();
        assert.strictEqual(text, 'mocked render');

        // Assertions for res.render options and arguments
        assert.strictEqual(renderView, 'index');
        assert.ok(renderOptions);
        assert.strictEqual(renderOptions.title, 'Aryan Gupta | Sanctum');
        assert.strictEqual(renderOptions.description, 'Personal portfolio, laboratory, and digital sanctum.');
        assert.deepStrictEqual(renderOptions.quote, {
            text: 'You have power over your mind - not outside events. Realize this, and you will find strength.',
            author: 'Marcus Aurelius'
        });

        // Assert that console.error was indeed called
        assert.ok(consoleErrorCalled);
    });
});

test('Route "/resources/download/:subject/:title"', async (t) => {
    let server;
    let port;

    t.before(() => {
        // Start the server on an ephemeral port
        server = app.listen(0);
        port = server.address().port;
    });

    t.after(() => {
        // Close the server when done
        server.close();
    });

    await t.test('should return 404 when subject is invalid', async () => {
        const response = await fetch(`http://127.0.0.1:${port}/resources/download/invalid-subject/some-title`);
        assert.strictEqual(response.status, 404);
    });

    await t.test('should return 404 when title is invalid for a valid subject', async () => {
        const response = await fetch(`http://127.0.0.1:${port}/resources/download/physics/invalid-title`);
        assert.strictEqual(response.status, 404);
    });
});

