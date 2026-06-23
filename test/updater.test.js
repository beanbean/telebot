const { isNewerVersion } = require('../src/updater');
const assert = require('assert');

console.log('🧪 Running updater tests...');

try {
    // Basic semver checks
    assert.strictEqual(isNewerVersion('3.5.2', '3.5.1'), true, '3.5.2 is newer than 3.5.1');
    assert.strictEqual(isNewerVersion('3.6.0', '3.5.2'), true, '3.6.0 is newer than 3.5.2');
    assert.strictEqual(isNewerVersion('4.0.0', '3.5.2'), true, '4.0.0 is newer than 3.5.2');
    
    // Equal versions
    assert.strictEqual(isNewerVersion('3.5.2', '3.5.2'), false, 'Equal versions should not be newer');
    
    // Older versions
    assert.strictEqual(isNewerVersion('3.5.1', '3.5.2'), false, '3.5.1 is not newer than 3.5.2');
    assert.strictEqual(isNewerVersion('3.4.9', '3.5.0'), false, '3.4.9 is not newer than 3.5.0');
    
    // Edge cases with missing parts
    assert.strictEqual(isNewerVersion('3.5', '3.5.1'), false, '3.5 (treated as 3.5.0) is not newer than 3.5.1');
    assert.strictEqual(isNewerVersion('3.5.1', '3.5'), true, '3.5.1 is newer than 3.5 (treated as 3.5.0)');
    
    // Null / empty cases
    assert.strictEqual(isNewerVersion(null, '3.5.1'), false, 'null is not newer');
    assert.strictEqual(isNewerVersion('3.5.1', null), false, 'local null is not newer');

    console.log('✅ All updater tests passed!');
} catch (error) {
    console.error('❌ Updater tests failed!');
    console.error(error);
    process.exit(1);
}
