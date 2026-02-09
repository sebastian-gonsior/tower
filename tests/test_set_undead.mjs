/**
 * Undead Set Tests
 * - 2pc: +10% Lifesteal
 * - 3pc: 2x Shadow Damage
 * - 4pc: Shadow tick interval reduced to 500ms (2x speed)
 */
import { setupMocks, getSetItems, TestRunner } from './set_test_utils.mjs';

setupMocks();

async function runTests() {
    const { gameState, PHASES } = await import('../js/state/GameState.js');
    const { dataManager } = await import('../js/managers/DataManager.js');
    const { combatSystem } = await import('../js/systems/CombatSystem.js');
    const { ItemFactory } = await import('../js/models/ItemFactory.js');
    const { BuffSystem } = await import('../js/systems/BuffSystem.js');

    await dataManager.loadData();
    gameState.init();
    gameState.startGame('Tester');

    const test = new TestRunner('Undead Set Tests');
    console.log('\n💀 UNDEAD SET TESTS\n');

    const undeadItems = getSetItems(dataManager.items, 'undead');
    console.log(`Found ${undeadItems.length} undead items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (+10% Lifesteal)');
    gameState.activeSlots = [null, null, null, null, null, null];
    gameState.activeSlots[0] = ItemFactory.createItem(undeadItems[0].id);
    gameState.activeSlots[1] = ItemFactory.createItem(undeadItems[1].id);

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'undead_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 undead items');
    test.assertApproxEqual(buffs.lifesteal, 0.1, 0.01, 'Lifesteal is +10%');

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Shadow Dmg)');
    gameState.activeSlots[2] = ItemFactory.createItem(undeadItems[2].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'undead_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 undead items');

    const shadowItem = gameState.activeSlots.find(i => i && i.effects && i.effects.shadow);
    if (shadowItem) {
        const combined = BuffSystem.getItemCombinedStats(shadowItem, gameState.activeSlots);
        const shadowMod = combined.modifiedEffects.shadow;
        test.assert(shadowMod && shadowMod.isModified, 'Shadow effect is modified by set bonus');
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+50% Shadow Speed)');
    gameState.activeSlots[3] = ItemFactory.createItem(undeadItems[3].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'undead_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 undead items');

    if (shadowItem) {
        const combined = BuffSystem.getItemCombinedStats(shadowItem, gameState.activeSlots);
        const shadowMod = combined.modifiedEffects.shadow;
        test.assertEqual(shadowMod?.tickInterval, 500, 'Shadow tick interval set to 500ms');
    }

    // Test combat
    console.log('\n📋 Test: Combat Integration');
    gameState.level = 1;
    gameState.configureBoss();
    gameState.setPhase(PHASES.COMBAT);
    combatSystem.startFight();

    const initialBossHp = gameState.enemy.hp;
    for (let i = 0; i < 50; i++) {
        combatSystem.update(100);
    }

    test.assertGreaterThan(initialBossHp - gameState.enemy.hp, 0, 'Enemy takes damage during combat');

    return test.summary();
}

runTests().then(passed => {
    process.exit(passed ? 0 : 1);
}).catch(e => {
    console.error('Test error:', e);
    process.exit(1);
});
