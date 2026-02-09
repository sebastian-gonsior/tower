/**
 * Elf Set Tests
 * - 2pc: +15% Speed
 * - 3pc: 2x Poison Damage
 * - 4pc: Poison tick interval reduced to 500ms (2x speed)
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

    const test = new TestRunner('Elf Set Tests');
    console.log('\n🏹 ELF SET TESTS\n');

    const elfItems = getSetItems(dataManager.items, 'elf');
    console.log(`Found ${elfItems.length} elf items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (+15% Speed)');
    gameState.activeSlots = [null, null, null, null, null, null];
    gameState.activeSlots[0] = ItemFactory.createItem(elfItems[0].id);
    gameState.activeSlots[1] = ItemFactory.createItem(elfItems[1].id);

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'elf_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 elf items');
    test.assertApproxEqual(buffs.speedBonus, 0.15, 0.01, 'Speed bonus is +15%');

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Poison Dmg)');
    gameState.activeSlots[2] = ItemFactory.createItem(elfItems[2].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'elf_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 elf items');

    const poisonItem = gameState.activeSlots.find(i => i && i.effects && i.effects.poison);
    if (poisonItem) {
        const combined = BuffSystem.getItemCombinedStats(poisonItem, gameState.activeSlots);
        const poisonMod = combined.modifiedEffects.poison;
        test.assert(poisonMod && poisonMod.isModified, 'Poison effect is modified by set bonus');
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+50% Poison Speed)');
    gameState.activeSlots[3] = ItemFactory.createItem(elfItems[3].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'elf_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 elf items');

    if (poisonItem) {
        const combined = BuffSystem.getItemCombinedStats(poisonItem, gameState.activeSlots);
        const poisonMod = combined.modifiedEffects.poison;
        test.assertEqual(poisonMod?.tickInterval, 500, 'Poison tick interval set to 500ms');
    }

    // Test combat
    console.log('\n📋 Test: Combat Integration');
    gameState.level = 1;
    gameState.configureBoss();
    const initialBossHp = gameState.enemy.hp;

    gameState.setPhase(PHASES.COMBAT);
    combatSystem.startFight();

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
