/*
v.0.2
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Target URL adjusted specifically to filter for your selling listings (my_ads=1)
const OLX_URL = 'https://www.olx.bg/myaccount/answers/?my_ads=1';
const DB_FILE = path.join(__dirname, 'profiles_db.json');

// Interface for reading user typing in the console
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

let profiles = [];

// Loads existing database file or configures default profiles if running the first time
function loadProfiles() {
    if (fs.existsSync(DB_FILE)) {
        profiles = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } else {
        profiles = [
            { id: 1, name: "Профил 1 - Електроника" },
            { id: 2, name: "Профил 2 - Електроника" }
        ];
        saveProfiles();
    }
}

function saveProfiles() {
    fs.writeFileSync(DB_FILE, JSON.stringify(profiles, null, 2), 'utf8');
}

/**
 * Checks an account for unread messages invisibly in the background (Headless)
 */
async function checkMessages(id) {
    const userDataDir = path.join(__dirname, 'profiles', `olx_profile_${id}`);
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    const page = await context.newPage();
    try {
        await page.goto(OLX_URL, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(2000); // 2-second buffer for layout initialization

        // Target structural elements specific to OLX Bulgaria message badges (.css-xfs3z)
        const exactBadgeSelector = '[data-testid="tabs-messages"] [data-nx-name="Badge"], [data-testid="tabs-messages"] .css-xfs3z';
        const badgeVisible = await page.locator(exactBadgeSelector).isVisible();

        let count = 0;
        if (badgeVisible) {
            const badgeText = await page.locator(exactBadgeSelector).innerText();
            count = parseInt(badgeText.trim()) || 0;
        }
        await context.close();
        return count;
    } catch (e) {
        await context.close();
        return "Грешка (Няма Логин)";
    }
}

/**
 * Opens a single visible browser window for you to manage your listings (Headed)
 */
async function openBrowser(id) {
    const userDataDir = path.join(__dirname, 'profiles', `olx_profile_${id}`);
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: null,
        args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
    });
    const page = await context.newPage();
    await page.goto(OLX_URL);

    return new Promise((resolve) => {
        page.on('close', async () => {
            // FIX: Gracefully ignore browser closing context crashes
            try {
                await context.close();
            } catch (e) {
                // Do nothing if already torn down by clicking the red X
            }
            resolve();
        });
    });
}

/**
 * Opens all registered browser profile windows side-by-side simultaneously
 */
async function openAllProfilesSimultaneously() {
    console.clear();
    console.log("=================================================");
    console.log("Стартиране на ВСИЧКИ профили едновременно...");
    console.log("Натиснете [Ctrl + C] в тази конзола, за да ги затворите.");
    console.log("=================================================\n");

    if (profiles.length === 0) {
        console.log("Няма налични профили за отваряне!");
        return;
    }

    const promises = profiles.map(async (p) => {
        const userDataDir = path.join(__dirname, 'profiles', `olx_profile_${p.id}`);
        try {
            const context = await chromium.launchPersistentContext(userDataDir, {
                headless: false,
                viewport: { width: 1024, height: 768 }, // Scaled windows so they tile beautifully
                args: ['--disable-blink-features=AutomationControlled']
            });
            const page = await context.newPage();
            await page.goto(OLX_URL);

            return new Promise((resolve) => {
                page.on('close', async () => {
                    try {
                        await context.close();
                    } catch (e) {
                        // Suppress context closure warning exceptions
                    }
                    console.log(` -> [${p.name}] затворен.`);
                    resolve();
                });
            });
        } catch (err) {
            console.log(`Грешка при отваряне на ${p.name}:`, err.message);
        }
    });
    await Promise.all(promises);
}

/**
 * Main Application Infinite Menu Loop Thread
 */
async function mainMenu() {
    loadProfiles();
    while (true) {
        console.clear();
        console.log("=================================================");
        console.log("       OLX БЪЛГАРИЯ - КОНЗОЛЕН МЕНИДЖЪР          ");
        console.log("=================================================");
        console.log(" 1. КОНЗОЛЕН МОНИТОР (Списък ID + Съобщения)");
        console.log(" 2. Стартиране на конкретен Профил (Единично)");
        console.log(" 3. Стартиране на ВСИЧКИ профили наведнъж (Браузъри)");
        console.log(" 4. Редактиране (Добави/Изтрий профил и папка)");
        console.log(" 5. Изход");
        console.log("=================================================");

        const choice = await question("Изберете опция (1-5): ");

        if (choice === '1') {
            console.clear();
            console.log("=================================================");
            console.log("             ЖИВ КОНЗОЛЕН МОНИТОР                ");
            console.log("=================================================");

            if (profiles.length === 0) {
                console.log(" Списъкът е празен! Добавете профили от меню 4.");
                console.log("=================================================");
                await question("\nНатиснете [Enter] за връщане...");
                continue;
            }

            console.log(" Моля изчакайте, събират се данни от акаунтите...\n");
            console.log(String.raw`ID   │ Име на Профила                 │ Нови Съобщения`);
            console.log(String.raw`─────┼────────────────────────────────┼───────────────`);

            for (let p of profiles) {
                const res = await checkMessages(p.id);
                const idStr = String(p.id).padEnd(4);
                const nameStr = p.name.padEnd(30);

                let statusStr = res;
                if (typeof res === 'number') {
                    statusStr = res > 0 ? `Брой: ${res} ‼` : "0 съобщения";
                }

                console.log(`${idStr} │ ${nameStr} │ ${statusStr}`);
            }
            console.log("=================================================");
            await question("\nНатиснете [Enter] за връщане към менюто...");
        }
        else if (choice === '2') {
            const idToOpen = await question("Въведете ID на профила за стартиране: ");
            const target = profiles.find(p => p.id == idToOpen);

            // FIX: If user types an incorrect index configuration, alert them safely instead of crashing
            if (target) {
                console.log(`\nОтваряне на ${target.name}... Затворете браузъра ръчно.`);
                await openBrowser(target.id);
            } else {
                console.log("\n❌ Невалидно или несъществуващо ID! Връщане към менюто...");
                await question("Натиснете [Enter] за да продължите...");
            }
        }
        else if (choice === '3') {
            await openAllProfilesSimultaneously();
            await question("\nВсички операции приключиха. Натиснете [Enter]...");
        }
        else if (choice === '4') {
            console.clear();
            console.log("=== РЕДАКТИРАНЕ НА ПРОФИЛИ ===");
            console.log(" 1. Създаване на нов профил");
            console.log(" 2. Изтриване на съществуващ профил + Папка");
            const subChoice = await question("Изберете под-опция (1-2): ");

            if (subChoice === '1') {
                // FIX: If all entries are cleared out, restart sequence mapping cleanly back at 1
                const nextId = profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) + 1 : 1;
                const newName = await question("Въведете име за новия профил: ");
                if (newName.trim()) {
                    profiles.push({ id: nextId, name: newName });
                    saveProfiles();
                    console.log(`Профилът "${newName}" беше създаден успешно с ID: ${nextId}`);
                }
            } else if (subChoice === '2') {
                const idDel = await question("Въведете ID за изтриване: ");
                const targetProfile = profiles.find(p => p.id == idDel);

                if (targetProfile) {
                    const folderPath = path.join(__dirname, 'profiles', `olx_profile_${idDel}`);

                    // Automatically drop heavy cache folders when deleting registered accounts
                    if (fs.existsSync(folderPath)) {
                        console.log(`Премахване на файлове на папка: ${folderPath}...`);
                        try {
                            fs.rmSync(folderPath, { recursive: true, force: true });
                            console.log("Папката беше напълно заличена от диска!");
                        } catch (err) {
                            console.log("Внимание: Папката е заключена или отворена в момента.");
                        }
                    }
                    profiles = profiles.filter(p => p.id != idDel);
                    saveProfiles();
                    console.log("Профилът е премахнат от конзолния регистър.");
                } else {
                    console.log("Не е намерен профил с такова ID!");
                }
            }
            await question("\nНатиснете [Enter]...");
        }
        else if (choice === '5') {
            rl.close();
            process.exit(0);
        }
    }
}

mainMenu();