const assert = require('assert');
const { JSDOM } = require('jsdom');

function loadExpr(app) {
    process.env.ANTIGRAVITY_PREFERRED_APP = app;
    const controllerPath = require.resolve('../src/cdp_controller');
    const driversPath = require.resolve('../src/drivers');
    delete require.cache[controllerPath];
    delete require.cache[driversPath];
    return require('../src/cdp_controller').getChatExtractExpr();
}

function dom(html) {
    return new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
        pretendToBeVisual: true,
        runScripts: 'outside-only'
    }).window;
}

function extract(html, app = 'ide') {
    const window = dom(html);
    return window.eval(loadExpr(app));
}

function stopButton(html) {
    const window = dom(html);
    const { IDE_LOCATORS_SCRIPT } = require('../src/locators/ide_locators');
    window.eval(IDE_LOCATORS_SCRIPT);
    window.AG_UI.isVisible = () => true;
    const button = window.AG_UI.getStopButton();
    return button ? button.getAttribute('aria-label') || button.textContent.trim() : null;
}

const panelChrome = `
<div class="interactive-session">
  <button>nexmeOS</button>
  <div>[caption]</div>
  <div>See all</div>
  <div>AI may make mistakes. Verify important info.</div>
  <div role="article" aria-label="User message" data-testid="user-input-step">latest caption question</div>
  <div class="interactive-input-editor"><textarea placeholder="Ask"></textarea></div>
</div>`;

const staleThenNewUser = `
<div class="interactive-session">
  <button>nexmeOS</button>
  <div>[caption]See all AI may make mistakes</div>
  <div role="article" aria-label="User message">older question</div>
  <div role="article" aria-label="Agent response" data-quotable="true">
    <button data-testid="worked-for-collapsible">Worked for 1m</button>
    <div class="reasoning">hidden reasoning</div>
    <div class="leading-relaxed select-text">OLD ANSWER must not be returned</div>
  </div>
  <div role="article" aria-label="User message">newest question</div>
  <div class="interactive-input-editor"><textarea placeholder="Ask"></textarea></div>
</div>`;

const finalBody = 'F'.repeat(1918);
const completed = `
<div class="interactive-session">
  <button>nexmeOS</button>
  <div>[caption]</div>
  <div>See all AI may make mistakes</div>
  <div role="article" aria-label="User message">please answer</div>
  <div role="article" aria-label="Agent response" data-quotable="true">
    <button data-testid="worked-for-collapsible">Worked for 1m</button>
    <div class="reasoning">hidden reasoning</div>
    <div class="leading-relaxed select-text">${finalBody}</div>
  </div>
  <div class="interactive-input-editor"><textarea placeholder="Ask"></textarea></div>
</div>`;

const shortReply = `
<div class="interactive-session">
  <div role="article" aria-label="User message">hi</div>
  <div role="article" aria-label="Agent response" data-quotable="true">
    <div class="leading-relaxed select-text">OK</div>
  </div>
  <div class="interactive-input-editor"><textarea placeholder="Ask"></textarea></div>
</div>`;

const legacy = `
<div id="conversation" class="chat-container">
  <div class="chat-messages">
    <div class="rounded-2xl bg-card-border"><div class="prose">legacy agent text here</div></div>
  </div>
  <div class="interactive-input-editor"><textarea placeholder="Ask"></textarea></div>
</div>`;

const generating = `
<button aria-label="Close unrelated">Cancel later</button>
<div class="interactive-session">
  <div role="article" aria-label="User message">working</div>
  <div role="article" aria-label="Agent response"><div class="leading-relaxed select-text">partial</div></div>
  <div class="interactive-input-editor">
    <textarea placeholder="Ask"></textarea>
    <button aria-label="Cancel (⌃C)"></button>
  </div>
</div>`;

const idle = `
<button aria-label="Cancel subscription elsewhere"></button>
<div class="interactive-session">
  <div role="article" aria-label="User message">done</div>
  <div role="article" aria-label="Agent response"><div class="leading-relaxed select-text">finished</div></div>
  <div class="interactive-input-editor"><textarea placeholder="Ask"></textarea></div>
</div>`;

assert.strictEqual(extract(panelChrome), '', 'panel chrome and unanswered user must not become the reply');
assert.strictEqual(extract(staleThenNewUser), '', 'an older assistant article must not answer the latest user');
assert.strictEqual(extract(completed), `🤖 Agent:\n${finalBody}`);
assert.strictEqual(extract(shortReply), '🤖 Agent:\nOK');
assert.strictEqual(
    extract(shortReply.replace('>OK<', '>See all means expand. AI may make mistakes means verify.<')),
    '🤖 Agent:\nSee all means expand. AI may make mistakes means verify.',
    'legitimate assistant text must not be filtered by UI vocabulary'
);
assert.strictEqual(extract(legacy), '🤖 Agent:\nlegacy agent text here');
assert.strictEqual(extract(legacy, 'agent'), '🤖 Agent:\nlegacy agent text here');
assert.strictEqual(stopButton(generating), 'Cancel (⌃C)');
assert.strictEqual(stopButton(idle), null);

const codeAnswer = `
<div class="interactive-session">
  <div role="article" aria-label="User message">show the command</div>
  <div role="article" aria-label="Agent response" data-quotable="true">
    <div class="leading-relaxed select-text">Run <button>npm test -- --grep chat</button> then read src/app.js</div>
    <button aria-label="Copy">copy</button>
    <button aria-label="Good response"><svg></svg></button>
  </div>
  <div class="interactive-input-editor"><textarea placeholder="Ask"></textarea></div>
</div>`;
const codeText = extract(codeAnswer);
assert.ok(codeText.includes('npm test -- --grep chat'), 'answer text inside a content button must survive');
assert.ok(codeText.includes('src/app.js'), 'surrounding answer text must survive');
assert.ok(!/\bcopy\b/i.test(codeText), 'copy control must not become answer text');

function loadController(app) {
    process.env.ANTIGRAVITY_PREFERRED_APP = app;
    const controllerPath = require.resolve('../src/cdp_controller');
    delete require.cache[controllerPath];
    delete require.cache[require.resolve('../src/drivers')];
    return require('../src/cdp_controller');
}

async function withMockedCdp(domValue, fn) {
    const http = require('http');
    const CDP = require('chrome-remote-interface');
    const fs = require('fs');
    const originalGet = http.get;
    const originalCDP = CDP;
    const reads = [];
    const originalExists = fs.existsSync;
    const originalRead = fs.readFileSync;
    const originalOpen = fs.openSync;
    const originalReaddir = fs.readdirSync;
    http.get = (url, cb) => {
        const res = { on(event, handler) { if (event === 'data') handler(JSON.stringify([{ id: 'T1', type: 'page', title: 'nexmeOS', url: 'vscode-webview://chat', webSocketDebuggerUrl: 'ws://mock' }])); if (event === 'end') handler(); return this; } };
        cb(res);
        return { on() { return this; }, setTimeout() {}, destroy() {} };
    };
    require.cache[require.resolve('chrome-remote-interface')].exports = async () => ({
        Runtime: {
            enable: async () => {},
            evaluate: async (params) => ({ result: { value: String(params.expression || '').includes('__TB_SEMANTIC_EMPTY__') || String(params.expression || '').includes('extractedText') ? domValue : null } })
        },
        close: async () => {}
    });
    const mark = (file) => { if (String(file).includes('transcript') || String(file).includes('overview') || String(file).includes('/brain/')) reads.push(String(file)); };
    fs.existsSync = (file) => { mark(file); return false; };
    fs.readFileSync = (file, ...args) => { mark(file); return originalRead(file, ...args); };
    fs.openSync = (file, ...args) => { mark(file); return originalOpen(file, ...args); };
    fs.readdirSync = (file, ...args) => { mark(file); return originalReaddir(file, ...args); };
    try {
        return await fn(reads);
    } finally {
        http.get = originalGet;
        require.cache[require.resolve('chrome-remote-interface')].exports = originalCDP;
        fs.existsSync = originalExists;
        fs.readFileSync = originalRead;
        fs.openSync = originalOpen;
        fs.readdirSync = originalReaddir;
        delete require.cache[require.resolve('../src/cdp_controller')];
    }
}

(async () => {
    const empty = await withMockedCdp('__TB_SEMANTIC_EMPTY__', async (reads) => {
        const { getFullLatestResponse } = loadController('ide');
        const result = await getFullLatestResponse(9334, 'T1');
        assert.deepStrictEqual(reads, [], 'authoritative semantic empty must not read transcripts');
        return result;
    });
    assert.deepStrictEqual(empty, { text: '', buttons: null });

    const absent = await withMockedCdp('', async () => {
        const { getFullLatestResponse } = loadController('ide');
        return getFullLatestResponse(9334, 'T1');
    });
    assert.deepStrictEqual(absent, { text: 'latest.not_found_active', buttons: null }, 'absent DOM keeps the filesystem fallback');
    console.log('✅ chat extract tests passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
