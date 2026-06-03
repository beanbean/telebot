const { getFullLatestResponse, resolveTargets } = require('./src/cdp_controller');
async function run() {
    const candidates = await resolveTargets(9334, false);
    for (const t of candidates) {
        console.log(`Checking ${t.title}...`);
        const res = await getFullLatestResponse(9334, t.id);
        console.log("Result:", typeof res === 'string' ? res : JSON.stringify(res).substring(0, 500));
    }
    process.exit(0);
}
run();
