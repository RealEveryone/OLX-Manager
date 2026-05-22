const express = require('express');
const {chromium} = require('playwright');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
// Serve frontend assets out of a directory called 'public'
app.use(express.static(path.join(__dirname, 'public')));

const OLX_URL = 'https://www.olx.bg/myaccount/answers/?my_ads=1';
const DB_FILE = path.join(__dirname, 'profiles_db.json');

let profiles = [];

function loadProfiles() {
    if (fs.existsSync(DB_FILE)) {
        profiles = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } else {
        profiles = [
            {id: 1, name: "Профил 1 - Електроника"},
            {id: 2, name: "Профил 2 - Електроника"}
        ];
        saveProfiles();
    }
}

function saveProfiles() {
    fs.writeFileSync(DB_FILE, JSON.stringify(profiles, null, 2), 'utf8');
}

loadProfiles();

/**
 * Checks message counts AND identifies if an account got logged out
 */
async function checkProfileStatus(id) {
    const userDataDir = path.join(__dirname, 'profiles', `olx_profile_${id}`);
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    const page = await context.newPage();
    try {
        await page.goto(OLX_URL, {waitUntil: 'domcontentloaded', timeout: 15000});
        await page.waitForTimeout(2500); // Give it a brief moment to settle redirects

        // 1. Precise Logout Detection matching your explicit login DOM dump
        const currentUrl = page.url();
        const hasLoginPageClass = await page.locator('.login-page').count() > 0;
        const hasCoreLayout = await page.locator('[data-testid="core-layout"]').count() > 0;

        if (hasLoginPageClass || currentUrl.includes('/login') || currentUrl.includes('/myaccount/login')) {
            await context.close();
            return {unreadCount: 0, status: 'Logged Out'};
        }

        // 2. Count Messages
        const exactBadgeSelector = '[data-testid="tabs-messages"] [data-nx-name="Badge"], [data-testid="tabs-messages"] .css-xfs3z';
        const badgeVisible = await page.locator(exactBadgeSelector).isVisible();

        let count = 0;
        if (badgeVisible) {
            const badgeText = await page.locator(exactBadgeSelector).innerText();
            count = parseInt(badgeText.trim()) || 0;
        }

        await context.close();
        return {unreadCount: count, status: 'Active'};
    } catch (e) {
        await context.close();
        return {unreadCount: 0, status: 'Network Error'};
    }
}

/**
 * Core browser runner (Headed mode)
 */
async function openBrowserWindow(id, width = null, height = null) {
    const userDataDir = path.join(__dirname, 'profiles', `olx_profile_${id}`);
    const options = {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    };

    if (width && height) {
        options.viewport = {width, height};
    } else {
        options.viewport = null;
        options.args.push('--start-maximized');
    }

    const context = await chromium.launchPersistentContext(userDataDir, options);
    const page = await context.newPage();
    await page.goto(OLX_URL);

    page.on('close', async () => {
        try {
            await context.close();
        } catch (e) {
        }
    });
}

// ================= API ENDPOINTS =================

// Get all profiles
app.get('/api/profiles', (req, res) => {
    res.json(profiles);
});

// Create new profile
app.post('/api/profiles', (req, res) => {
    const {name} = req.body;
    if (!name || !name.trim()) return res.status(400).json({error: 'Name required'});

    const nextId = profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) + 1 : 1;
    profiles.push({id: nextId, name: name.trim()});
    saveProfiles();
    res.json({success: true, profiles});
});

// Delete profile + clean folder
app.delete('/api/profiles/:id', (req, res) => {
    const idDel = parseInt(req.params.id);
    const folderPath = path.join(__dirname, 'profiles', `olx_profile_${idDel}`);

    if (fs.existsSync(folderPath)) {
        try {
            fs.rmSync(folderPath, {recursive: true, force: true});
        } catch (err) {
            console.log("Folder locked. Skipping physical wipe.");
        }
    }
    profiles = profiles.filter(p => p.id !== idDel);
    saveProfiles();
    res.json({success: true, profiles});
});

// Run live status tracking for all setups
app.get('/api/status', async (req, res) => {
    const liveStatuses = [];
    for (let p of profiles) {
        const result = await checkProfileStatus(p.id);
        liveStatuses.push({
            id: p.id,
            name: p.name,
            unreadCount: result.unreadCount,
            status: result.status
        });
    }
    res.json(liveStatuses);
});

// Open explicit profile
app.post('/api/open/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    openBrowserWindow(id); // Runs asynchronously, doesn't block the app pipeline
    res.json({success: true});
});

// Open profiles with active unread messages simultaneously
app.post('/api/open-active', async (req, res) => {
    let targetedProfiles = [];

    for (let p of profiles) {
        const result = await checkProfileStatus(p.id);
        if (result.unreadCount > 0 && result.status === 'Active') {
            targetedProfiles.push(p);
        }
    }

    // Tiling them sequentially via client requests
    targetedProfiles.forEach(p => {
        openBrowserWindow(p.id, 1024, 768);
    });

    res.json({success: true, count: targetedProfiles.length});
});

app.listen(PORT, () => {
    console.log(`\n🚀 OLX Dashboard Running Successfully!`);
    console.log(`👉 Access via Browser: http://localhost:${PORT}`);
    console.log(`Keep this console window open during operation.\n`);
});