/**
 * Warlock Set Tests
 * - 2pc: 2x Curse Damage
 * - 3pc: 2x Shadow Damage
 * - 4pc: Curse tick interval reduced to 500ms (2x speed)
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

    const test = new TestRunner('Warlock Set Tests');
    console.log('\n🔮 WARLOCK SET TESTS\n');

    const warlockItems = getSetItems(dataManager.items, 'warlock');
    console.log(`Found ${warlockItems.length} warlock items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (2x Curse Dmg)');
    gameState.activeSlots = [null, null, null, null, null, null];
    gameState.activeSlots[0] = ItemFactory.createItem(warlockItems[0].id);
    gameState.activeSlots[1] = ItemFactory.createItem(warlockItems[1].id);

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'warlock_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 warlock items');

    const curseItem = gameState.activeSlots.find(i => i && i.effects && i.effects.curse);
    if (curseItem) {
        const combined = BuffSystem.getItemCombinedStats(curseItem, gameState.activeSlots);
        const curseMod = combined.modifiedEffects.curse;
        test.assert(curseMod && curseMod.isModified, 'Curse effect is modified by set bonus');
    }

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Shadow Dmg)');
    gameState.activeSlots[2] = ItemFactory.createItem(warlockItems[2].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'warlock_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 warlock items');

    const shadowItem = gameState.activeSlots.find(i => i && i.effects && i.effects.shadow);
    if (shadowItem) {
        const combined = BuffSystem.getItemCombinedStats(shadowItem, gameState.activeSlots);
        const shadowMod = combined.modifiedEffects.shadow;
        test.assert(shadowMod && shadowMod.isModified, 'Shadow effect is modified by set bonus');
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+50% Curse Speed)');
    gameState.activeSlots[3] = ItemFactory.createItem(warlockItems[3].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'warlock_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 warlock items');

    if (curseItem) {
        const combined = BuffSystem.getItemCombinedStats(curseItem, gameState.activeSlots);
        const curseMod = combined.modifiedEffects.curse;
        test.assertEqual(curseMod?.tickInterval, 500, 'Curse tick interval set to 500ms');
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
