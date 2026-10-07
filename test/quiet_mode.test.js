const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'src', 'index.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function extractFunction(name) {
    let start = source.indexOf(`function ${name}(`);
    assert.notStrictEqual(start, -1, `${name} not found`);
    if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0;
    let seen = false;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
        if (source[i] === '{') {
            depth++;
            seen = true;
        } else if (source[i] === '}') {
            depth--;
            if (seen && depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unterminated ${name}`);
}

function extractNotification() {
    const marker = 'const taskWatcher = new TaskWatcher({';
    const start = source.indexOf(marker);
    assert.notStrictEqual(start, -1, 'task watcher callback not found');
    const header = source.indexOf('onNotification: async ({ conversationId, text, type }) => {', start);
    assert.notStrictEqual(header, -1, 'notification header not found');
    const bodyStart = source.indexOf('=> {', header) + 3;
    let depth = 0;
    for (let i = bodyStart; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) {
                return `(async (notification) => { const conversationId = notification.conversationId, text = notification.text, type = notification.type; ${source.slice(bodyStart + 1, i + 1)})`;
            }
        }
    }
    throw new Error('unterminated onNotification');
}

function createHarness() {
    const sends = [];
    const edits = [];
    const logs = [];
    const files = new Map();
    const watchers = [];
    const context = {
        console: { log: (...args) => logs.push(args.join(' ')), error() {}, warn() {} },
        ALLOWED_CHAT_IDS: ['111', '222'],
        lastSentMessageIdMap: new Map(),
        artifactWatchers: new Map(),
        artifactDebounceTimers: new Map(),
        lastUploadedMtimes: new Map(),
        path,
        fs: {
            existsSync: (file) => files.has(file) || file.endsWith(`${path.sep}conv-1`),
            readFileSync: (file) => {
                if (!files.has(file)) throw new Error(`missing ${file}`);
                return files.get(file);
            },
            statSync: (file) => ({ mtimeMs: files.has(file) ? 20 : 10 }),
            readdirSync: () => [],
            watch: (dir, options, callback) => {
                const watcher = { dir, callback, closed: false, close() { watcher.closed = true; } };
                watchers.push(watcher);
                return watcher;
            },
        },
        DriverFactory: { getDriver: () => ({ getConversationDir: (id) => path.join(os.tmpdir(), 'quiet-mode', id) }) },
        telegraphPublisher: {
            enabled: true,
            publishOrUpdateArtifact: async () => (context.telegraphPublisher.enabled ? 'https://telegra.ph/artifact' : null),
            getPageMapping: () => null,
        },
        bot: { telegram: {
            sendMessage: async (chatId, text, extra) => {
                sends.push({ chatId, text, extra });
                return { message_id: sends.length };
            },
            editMessageReplyMarkup: async (chatId, messageId, unused, markup) => {
                edits.push({ chatId, messageId, markup });
                return { ok: true };
            },
        } },
        getPathId: (file) => `path-${path.basename(file)}`,
        setTimeout: (fn) => { fn(); return 0; },
        clearTimeout() {},
    };
    context.escHtml = (value) => String(value);
    vm.createContext(context);
    vm.runInContext(`${extractFunction('formatMarkdownForTelegram')}\n${extractFunction('sendFormattedTelegramMessage')}\n${extractFunction('getArtifactButtons')}\n${extractFunction('watchArtifacts')}`, context);
    context.files = files;
    context.sends = sends;
    context.edits = edits;
    context.logs = logs;
    context.watchers = watchers;
    return context;
}

async function flush(context, filename, content) {
    const dir = path.join(os.tmpdir(), 'quiet-mode', 'conv-1');
    const file = path.join(dir, filename);
    context.files.set(file, content);
    context.watchers.at(-1).callback('change', filename);
    await new Promise((resolve) => setImmediate(resolve));
}

(async () => {
    const absent = createHarness();
    absent.watchArtifacts('conv-1');
    await flush(absent, 'plan.md', '# Plan');
    assert.deepStrictEqual(absent.sends, []);
    assert.deepStrictEqual(absent.edits, []);

    const other = createHarness();
    other.lastSentMessageIdMap.set('conv-other', { messageId: 9, chatId: '111', conversationId: 'conv-other' });
    other.watchArtifacts('conv-1');
    await flush(other, 'plan.md', '# Plan');
    assert.deepStrictEqual(other.sends, []);
    assert.deepStrictEqual(other.edits, []);

    const matchedOff = createHarness();
    matchedOff.telegraphPublisher.enabled = false;
    matchedOff.lastSentMessageIdMap.set('conv-1', { messageId: 7, chatId: '111', conversationId: 'conv-1' });
    matchedOff.watchArtifacts('conv-1');
    await flush(matchedOff, 'plan.md', '# Plan');
    assert.deepStrictEqual(matchedOff.sends, []);
    assert.strictEqual(matchedOff.edits.length, 1);
    assert.strictEqual(matchedOff.edits[0].chatId, '111');
    assert.strictEqual(matchedOff.edits[0].messageId, 7);
    assert.strictEqual(matchedOff.edits[0].markup.inline_keyboard[0][0].text, '📄 Download File');

    const matchedOn = createHarness();
    matchedOn.lastSentMessageIdMap.set('conv-1', { messageId: 7, chatId: '111', conversationId: 'conv-1' });
    matchedOn.watchArtifacts('conv-1');
    await flush(matchedOn, 'plan.md', '# Plan');
    assert.deepStrictEqual(matchedOn.sends, []);
    assert.strictEqual(matchedOn.edits.length, 1);
    assert.strictEqual(matchedOn.edits[0].chatId, '111');
    assert.strictEqual(matchedOn.edits[0].messageId, 7);

    const proactive = [];
    const notificationSource = extractNotification();
    new vm.Script(notificationSource);
    const notification = vm.runInNewContext(notificationSource, {
        console: { log() {}, error() {} },
        bot: { telegram: {
            sendMessage: async (...args) => proactive.push(args),
            editMessageText: async (...args) => proactive.push(args),
        } },
    });
    await notification({ conversationId: 'conv-1', text: 'IDE-only update that must stay inside the IDE', type: 'agent_proactive' });
    await notification({ conversationId: 'conv-1', text: 'IDE requested feedback without a Telegram message', type: 'agent_proactive_feedback' });
    assert.deepStrictEqual(proactive, []);

    console.log('quiet_mode tests passed');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
