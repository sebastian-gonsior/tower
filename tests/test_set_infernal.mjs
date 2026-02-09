/**
 * Infernal Set Tests
 * - 2pc: +20 Damage
 * - 3pc: 2x Fire Damage
 * - 4pc: Fire tick interval reduced to 500ms (2x speed)
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

    const test = new TestRunner('Infernal Set Tests');
    console.log('\n🔥 INFERNAL SET TESTS\n');

    const infernalItems = getSetItems(dataManager.items, 'infernal');
    console.log(`Found ${infernalItems.length} infernal items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (+20 Damage)');
    gameState.activeSlots = [null, null, null, null, null, null];
    gameState.activeSlots[0] = ItemFactory.createItem(infernalItems[0].id);
    gameState.activeSlots[1] = ItemFactory.createItem(infernalItems[1].id);

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'infernal_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 infernal items');
    test.assertGreaterThan(buffs.damageBonus, 0, 'Damage bonus increased');

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Fire Dmg)');
    gameState.activeSlots[2] = ItemFactory.createItem(infernalItems[2].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'infernal_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 infernal items');

    const fireItem = gameState.activeSlots.find(i => i && i.effects && i.effects.fire);
    if (fireItem) {
        const combined = BuffSystem.getItemCombinedStats(fireItem, gameState.activeSlots);
        const fireMod = combined.modifiedEffects.fire;
        test.assert(fireMod && fireMod.isModified, 'Fire effect is modified by set bonus');
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+50% Fire Speed)');
    gameState.activeSlots[3] = ItemFactory.createItem(infernalItems[3].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'infernal_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 infernal items');

    if (fireItem) {
        const combined = BuffSystem.getItemCombinedStats(fireItem, gameState.activeSlots);
        const fireMod = combined.modifiedEffects.fire;
        test.assertEqual(fireMod?.tickInterval, 500, 'Fire tick interval set to 500ms');
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
