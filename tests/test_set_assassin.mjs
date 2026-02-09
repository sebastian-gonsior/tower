/**
 * Assassin Set Tests
 * - 2pc: +30% Crit Chance
 * - 3pc: 2x Poison Damage
 * - 4pc: +1.0x Crit Damage
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

    const test = new TestRunner('Assassin Set Tests');
    console.log('\n🗡️ ASSASSIN SET TESTS\n');

    const assassinItems = getSetItems(dataManager.items, 'assassin');
    console.log(`Found ${assassinItems.length} assassin items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (+30% Crit Chance)');
    gameState.activeSlots = [null, null, null, null, null, null];
    gameState.activeSlots[0] = ItemFactory.createItem(assassinItems[0].id);
    gameState.activeSlots[1] = ItemFactory.createItem(assassinItems[1].id);

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'assassin_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 assassin items');
    test.assertApproxEqual(buffs.critChance, 0.3, 0.05, 'Crit chance is ~30%');

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Poison Dmg)');
    gameState.activeSlots[2] = ItemFactory.createItem(assassinItems[2].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'assassin_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 assassin items');

    const poisonItem = gameState.activeSlots.find(i => i && i.effects && i.effects.poison);
    if (poisonItem) {
        const combined = BuffSystem.getItemCombinedStats(poisonItem, gameState.activeSlots);
        const poisonMod = combined.modifiedEffects.poison;
        test.assert(poisonMod && poisonMod.isModified, 'Poison effect is modified by set bonus');
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+1.0x Crit Dmg)');
    gameState.activeSlots[3] = ItemFactory.createItem(assassinItems[3].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'assassin_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 assassin items');
    test.assertGreaterThan(buffs.critDmg, 0, 'Crit damage bonus increased');

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
