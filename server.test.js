const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { app, quotesHelper, FailedAttemptsTracker } = require('./server');

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

test('FailedAttemptsTracker Unit Tests', async (t) => {
    await t.test('should track failed attempts and handle basic retrieval', () => {
        const tracker = new FailedAttemptsTracker(5, 60000);
        tracker.set('1.1.1.1', { count: 1, blockedUntil: 0 });
        const record = tracker.get('1.1.1.1');
        assert.ok(record);
        assert.strictEqual(record.count, 1);
        assert.ok(record.lastAttempt);
    });

    await t.test('should prune expired non-blocked entries', async () => {
        // Set TTL to 10ms
        const tracker = new FailedAttemptsTracker(5, 10);
        tracker.set('1.1.1.1', { count: 1, blockedUntil: 0 });
        
        // Wait 20ms
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Query to trigger prune
        const record = tracker.get('1.1.1.1');
        assert.strictEqual(record, undefined);
    });

    await t.test('should NOT prune blocked entries even if older than TTL', async () => {
        // Set TTL to 10ms
        const tracker = new FailedAttemptsTracker(5, 10);
        const now = Date.now();
        tracker.set('1.1.1.1', { count: 0, blockedUntil: now + 1000 });
        
        // Wait 20ms (longer than TTL)
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Query to check if it's still there
        const record = tracker.get('1.1.1.1');
        assert.ok(record);
        assert.ok(record.blockedUntil > Date.now());
    });

    await t.test('should enforce size limit by evicting the oldest entry', () => {
        // Set size limit to 2
        const tracker = new FailedAttemptsTracker(2, 60000);
        
        tracker.set('1.1.1.1', { count: 1, blockedUntil: 0 });
        tracker.set('2.2.2.2', { count: 2, blockedUntil: 0 });
        
        // Manually adjust timestamps in the internal map for test predictability
        tracker.map.get('1.1.1.1').lastAttempt = Date.now() - 10000;
        tracker.map.get('2.2.2.2').lastAttempt = Date.now() - 5000;
        
        // This third insert should trigger eviction of the oldest (1.1.1.1)
        tracker.set('3.3.3.3', { count: 3, blockedUntil: 0 });

        assert.strictEqual(tracker.get('1.1.1.1'), undefined);
        assert.ok(tracker.get('2.2.2.2'));
        assert.ok(tracker.get('3.3.3.3'));
    });
});

test('Route "/prospectus"', async (t) => {
    let server;
    let port;

    t.before(() => {
        server = app.listen(0);
        port = server.address().port;
    });

    t.after(() => {
        server.close();
    });

    await t.test('should render prospectus view with 200 status', async () => {
        const response = await fetch(`http://127.0.0.1:${port}/prospectus`);
        assert.strictEqual(response.status, 200);
        const html = await response.text();
        assert.match(html, /The Scholar's Desk/);
        assert.match(html, /Aryan Gupta/);
    });
});



