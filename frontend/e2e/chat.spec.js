const { test, expect } = require('@playwright/test');

test.describe('SecureChannelX E2E Test', () => {
    let userA = {
        username: 'UserA_' + Date.now(),
        email: `usera_${Date.now()}@test.com`,
        password: 'password123'
    };

    let userB = {
        username: 'UserB_' + Date.now(),
        email: `userb_${Date.now()}@test.com`,
        password: 'password123'
    };

    test('Should register two users and exchange encrypted messages', async ({ browser }) => {
        // 1. Create two isolated browser contexts
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        // Use local frontend URL
        const BASE_URL = 'http://localhost:5173';

        // === REGISTER USER A ===
        await pageA.goto(`${BASE_URL}/register`);
        await pageA.fill('input[placeholder="Username"]', userA.username);
        await pageA.fill('input[placeholder="Email"]', userA.email);
        await pageA.fill('input[placeholder="Password"]', userA.password);
        await pageA.click('button[type="submit"]');
        await expect(pageA).toHaveURL(`${BASE_URL}/login`);

        // === REGISTER USER B ===
        await pageB.goto(`${BASE_URL}/register`);
        await pageB.fill('input[placeholder="Username"]', userB.username);
        await pageB.fill('input[placeholder="Email"]', userB.email);
        await pageB.fill('input[placeholder="Password"]', userB.password);
        await pageB.click('button[type="submit"]');
        await expect(pageB).toHaveURL(`${BASE_URL}/login`);

        // === LOGIN BOTH ===
        // Login A
        await pageA.fill('input[placeholder="Email or Username"]', userA.email);
        await pageA.fill('input[placeholder="Password"]', userA.password);
        await pageA.click('button[type="submit"]');
        await expect(pageA).toHaveURL(`${BASE_URL}/`);
        await pageA.waitForSelector('text=Start a new chat');

        // Login B
        await pageB.goto(`${BASE_URL}/login`);
        await pageB.fill('input[placeholder="Email or Username"]', userB.email);
        await pageB.fill('input[placeholder="Password"]', userB.password);
        await pageB.click('button[type="submit"]');
        await expect(pageB).toHaveURL(`${BASE_URL}/`);

        // === USER A STARTS CHAT WITH USER B ===
        await pageA.click('button[title="New Chat"]');
        await pageA.fill('input[placeholder="Search users..."]', userB.username);
        await pageA.click(`text=${userB.username}`); // Click user in search result
        await pageA.click('button:has-text("Start Chat")');

        // Wait for chat window
        await expect(pageA.locator('h2')).toContainText(userB.username);

        // === SEND MESSAGE A -> B ===
        const secretMessage = "Hello World " + Date.now();
        await pageA.fill('input[placeholder="Type a message"]', secretMessage);
        await pageA.press('input[placeholder="Type a message"]', 'Enter');

        // Verify A sees it (decrypted)
        await expect(pageA.locator(`text=${secretMessage}`)).toBeVisible();

        // === USER B CHECKS MESSAGE ===
        // User B should see chat in list and click it
        await pageB.click(`text=${userA.username}`); // Click chat item

        // Verify B sees it (decrypted)
        await expect(pageB.locator(`text=${secretMessage}`)).toBeVisible();

        // Verify Encryption Indicator
        await expect(pageB.locator('text=🔒 Messages are end-to-end encrypted')).toBeVisible();

        // === SEND REPLY B -> A ===
        const replyMessage = "Reply from B " + Date.now();
        await pageB.fill('input[placeholder="Type a message"]', replyMessage);
        await pageB.press('input[placeholder="Type a message"]', 'Enter');

        // Verify A sees reply
        await expect(pageA.locator(`text=${replyMessage}`)).toBeVisible();

        console.log("✅ E2E Chat Test Passed!");
    });
});
