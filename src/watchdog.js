/**
 * Watchdog Agent for Antigravity Telegram Bot
 * 
 * Monitors the bot process (src/telegram-bot.js), restarts it if it crashes,
 * and force-restarts it if it becomes unresponsive (heartbeat check).
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const BOT_SCRIPT = path.join(PROJECT_ROOT, 'src', 'telegram-bot.js');
const HEARTBEAT_FILE = path.join(PROJECT_ROOT, '.heartbeat');

const HEARTBEAT_TIMEOUT_MS = 90000; // 90 seconds
const MONITOR_INTERVAL_MS = 15000; // 15 seconds
const MIN_UPTIME_MS = 10000; // 10 seconds (to detect crash loop)
const CRASH_LOOP_COOLDOWN_MS = 15000; // 15 seconds cooldown

let botProcess = null;
let lastHeartbeatTime = Date.now();
let lastSpawnTime = Date.now();
let isExiting = false;

function spawnBot() {
    console.log(`[Watchdog] 🚀 Starting Antigravity Bot (${BOT_SCRIPT})...`);
    lastSpawnTime = Date.now();
    
    // Set heartbeat time to now to prevent immediate timeout
    lastHeartbeatTime = Date.now();
    try {
        fs.writeFileSync(HEARTBEAT_FILE, Date.now().toString(), 'utf8');
    } catch (_) {}

    botProcess = spawn('node', [BOT_SCRIPT], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, WATCHDOG: 'true' },
        stdio: 'inherit' // Automatically forwards stdout, stderr, and stdin
    });

    botProcess.on('exit', (code, signal) => {
        botProcess = null;
        if (isExiting) return;

        const uptime = Date.now() - lastSpawnTime;
        const exitMsg = signal ? `killed with signal ${signal}` : `exited with code ${code}`;
        console.error(`[Watchdog] ❌ Bot process ${exitMsg}.`);

        let delay = 2000;
        if (uptime < MIN_UPTIME_MS) {
            console.warn(`[Watchdog] ⚠️ Bot crashed very quickly (uptime: ${(uptime / 1000).toFixed(1)}s). Waiting ${CRASH_LOOP_COOLDOWN_MS / 1000}s before restart to prevent loop...`);
            delay = CRASH_LOOP_COOLDOWN_MS;
        }

        setTimeout(() => {
            if (!isExiting) {
                spawnBot();
            }
        }, delay);
    });
}

// Heartbeat checking loop
setInterval(() => {
    if (isExiting || !botProcess) return;

    try {
        if (fs.existsSync(HEARTBEAT_FILE)) {
            const content = fs.readFileSync(HEARTBEAT_FILE, 'utf8').trim();
            const timestamp = parseInt(content, 10);
            if (!isNaN(timestamp)) {
                lastHeartbeatTime = timestamp;
            }
        }
    } catch (e) {
        console.error(`[Watchdog] Failed to read heartbeat file: ${e.message}`);
    }

    const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;
    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        console.warn(`[Watchdog] ⚠️ Bot heartbeat is stale (no update for ${(timeSinceLastHeartbeat / 1000).toFixed(0)}s). Bot might be frozen. Force-restarting...`);
        
        // Reset heartbeat file to prevent infinite kill loop
        lastHeartbeatTime = Date.now();
        try {
            fs.writeFileSync(HEARTBEAT_FILE, Date.now().toString(), 'utf8');
        } catch (_) {}

        if (botProcess) {
            try {
                botProcess.kill('SIGKILL');
            } catch (err) {
                console.error(`[Watchdog] Failed to kill bot process: ${err.message}`);
            }
        }
    }
}, MONITOR_INTERVAL_MS);

// Handle clean shutdown
const shutdown = () => {
    if (isExiting) return;
    isExiting = true;
    console.log('[Watchdog] 🛑 Shutting down watchdog and bot...');
    if (botProcess) {
        try {
            botProcess.kill('SIGTERM');
        } catch (_) {}
    }
    // Delete heartbeat file on clean exit
    try {
        if (fs.existsSync(HEARTBEAT_FILE)) {
            fs.unlinkSync(HEARTBEAT_FILE);
        }
    } catch (_) {}
    
    setTimeout(() => process.exit(0), 1000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
spawnBot();
