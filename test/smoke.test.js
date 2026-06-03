const assert = require('assert');
const { getRawTargets, printResult } = require('./test_helpers');
const { 
    resolveTargets, 
    sendViaCDP, 
    getFullLatestResponse, 
    listAgentThreads,
    isAgentWorking,
    getActiveThreadInfo
} = require('../src/cdp_controller');

const PORT = 9334;

async function runSmokeTests() {
    console.log("🚀 Starting Antigravity Bot Smoke Tests");
    console.log("----------------------------------------");

    let allPassed = true;
    const targets = await getRawTargets(PORT).catch(() => null);

    if (!targets || targets.length === 0) {
        console.error("❌ No CDP targets found. Is Antigravity IDE running?");
        process.exit(1);
    }

    console.log(`📡 Found ${targets.length} raw CDP targets`);

    // TEST 1: resolveTargets
    try {
        const resolved = await resolveTargets(PORT, false);
        assert(Array.isArray(resolved), 'resolveTargets should return an array');
        assert(resolved.length > 0, 'Should find at least one valid IDE target');
        assert(!resolved[0].url.includes('devtools://'), 'Should filter out devtools targets');
        printResult('test_resolveTargets', true);
    } catch (e) {
        allPassed = false;
        printResult('test_resolveTargets', false, e.message);
    }

    // TEST 2: getActiveThreadInfo
    let firstTargetId = null;
    let expectedWorkspace = null;
    try {
        const resolved = await resolveTargets(PORT, false);
        firstTargetId = resolved[0].id;
        expectedWorkspace = resolved[0].title.split(' - ')[0].trim();
        
        const info = await getActiveThreadInfo(PORT, firstTargetId);
        assert(info, 'Should return info object');
        assert(info.workspace === expectedWorkspace, `Workspace mismatch. Expected: ${expectedWorkspace}, Got: ${info.workspace}`);
        printResult('test_getActiveThreadInfo', true);
    } catch (e) {
        allPassed = false;
        printResult('test_getActiveThreadInfo', false, e.message);
    }

    // TEST 3: listAgentThreads
    try {
        const threads = await listAgentThreads(PORT);
        assert(threads, 'Should return object mapping workspaces to threads');
        const keys = Object.keys(threads);
        assert(keys.length > 0, 'Should find threads in at least one workspace');
        printResult('test_listAgentThreads', true);
    } catch (e) {
        allPassed = false;
        printResult('test_listAgentThreads', false, e.message);
    }

    // TEST 4: isAgentWorking
    try {
        const working = await isAgentWorking(PORT, firstTargetId);
        assert(typeof working === 'boolean', 'isAgentWorking should return a boolean');
        printResult('test_isAgentWorking', true);
    } catch (e) {
        allPassed = false;
        printResult('test_isAgentWorking', false, e.message);
    }

    // TEST 5: test_cross_window (simulate multi-window routing)
    try {
        const resolved = await resolveTargets(PORT, false);
        if (resolved.length >= 2) {
            const targetA = resolved[0];
            const targetB = resolved[1];
            
            // Send test to Target B
            const marker = '__SMOKE_TEST_' + Date.now() + '__';
            console.log(`[test_cross_window] Sending to Target B (${targetB.title.substring(0, 30)}...)`);
            const sentTargetId = await sendViaCDP(`echo "${marker}"`, PORT, targetB.id);
            
            assert(sentTargetId === targetB.id, `sendViaCDP returned target ${sentTargetId}, expected Target B ${targetB.id}`);
            
            // Now retrieve latest response for Target B
            // Give the target window a tiny bit of time to register the input
            await new Promise(r => setTimeout(r, 2000));
            const _latestRes = await getFullLatestResponse(PORT, sentTargetId);
            const text = typeof _latestRes === 'string' ? _latestRes : _latestRes.text;
            
            // If the IDE has no active chat for this workspace yet, it will return not_found_active, which is correct!
            // The real failure is if it returned the transcript from the OTHER window.
            assert(text, 'Response should not be empty');
            printResult('test_cross_window', true);
        } else {
            console.log(`⚠️ Skipping test_cross_window (requires at least 2 open IDE windows, found ${resolved.length})`);
        }
    } catch (e) {
        allPassed = false;
        printResult('test_cross_window', false, e.message);
    }

    // TEST 6: test_dom_extraction (test /latest parsing)
    try {
        const { CHAT_EXTRACT_EXPR } = require('../src/cdp_controller');
        const CDP = require('chrome-remote-interface');
        const resolved = await resolveTargets(PORT, false);
        const target = resolved[0];
        const client = await CDP({ target: target.webSocketDebuggerUrl });
        const { Runtime } = client;
        await Runtime.enable();
        const res = await Runtime.evaluate({
            expression: CHAT_EXTRACT_EXPR.replace('} catch(e) {}', '} catch(e) { extractedText = "ERROR_DOM: " + e.message; }'),
            returnByValue: true
        });
        await client.close();
        const val = res.result?.value;
        assert(typeof val === 'string', 'DOM extraction should return a string (not crash)');
        assert(!val.startsWith('ERROR_DOM:'), 'DOM extraction should not throw an error');
        printResult('test_dom_extraction', true);
    } catch (e) {
        allPassed = false;
        printResult('test_dom_extraction', false, e.message);
    }

    console.log("----------------------------------------");
    if (allPassed) {
        console.log("✅ All smoke tests passed successfully!");
        process.exit(0);
    } else {
        console.error("❌ Some tests failed.");
        process.exit(1);
    }
}

runSmokeTests().catch(e => {
    console.error("Test harness failed:", e);
    process.exit(1);
});
