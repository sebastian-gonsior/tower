/**
 * Master Test Runner - Runs all set tests and reports results.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
    'test_set_dwarf.mjs',
    'test_set_elf.mjs',
    'test_set_undead.mjs',
    'test_set_celestial.mjs',
    'test_set_infernal.mjs',
    'test_set_oceanic.mjs',
    'test_set_assassin.mjs',
    'test_set_paladin.mjs',
    'test_set_warlock.mjs',
    'test_set_titan.mjs'
];

async function runTest(testFile) {
    return new Promise((resolve) => {
        const testPath = path.join(__dirname, testFile);
        const child = spawn('node', [testPath], {
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            resolve({ file: testFile, passed: code === 0 });
        });

        child.on('error', (err) => {
            console.error(`Error running ${testFile}:`, err);
            resolve({ file: testFile, passed: false });
        });
    });
}

async function runAllTests() {
    console.log('═'.repeat(60));
    console.log('🏰 TOWER SET TESTS - MASTER RUNNER');
    console.log('═'.repeat(60));
    console.log(`Running ${testFiles.length} test suites...\n`);

    const results = [];

    for (const testFile of testFiles) {
        console.log('─'.repeat(60));
        const result = await runTest(testFile);
        results.push(result);
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));

    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);

    console.log(`\n✅ Passed: ${passed.length}/${results.length}`);
    passed.forEach(r => console.log(`   - ${r.file}`));

    if (failed.length > 0) {
        console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
        failed.forEach(r => console.log(`   - ${r.file}`));
    }

    console.log('\n' + '═'.repeat(60));

    if (failed.length === 0) {
        console.log('🎉 ALL TESTS PASSED!');
    } else {
        console.log('⚠️  SOME TESTS FAILED');
    }

    process.exit(failed.length > 0 ? 1 : 0);
}

runAllTests();
