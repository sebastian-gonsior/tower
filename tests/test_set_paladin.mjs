/**
 * Paladin Set Tests
 * - 2pc: +150 Shield
 * - 3pc: 2x Holy Heal
 * - 4pc: +20% Crit Chance, +10% Block
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

    const test = new TestRunner('Paladin Set Tests');
    console.log('\n⚔️ PALADIN SET TESTS\n');

    const paladinItems = getSetItems(dataManager.items, 'paladin');
    console.log(`Found ${paladinItems.length} paladin items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (+150 Shield)');
    gameState.activeSlots = [null, null, null, null, null, null];
    gameState.activeSlots[0] = ItemFactory.createItem(paladinItems[0].id);
    gameState.activeSlots[1] = ItemFactory.createItem(paladinItems[1].id);

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'paladin_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 paladin items');
    test.assertGreaterThan(buffs.shieldBonus, 0, 'Shield bonus increased');

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Holy Heal)');
    gameState.activeSlots[2] = ItemFactory.createItem(paladinItems[2].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'paladin_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 paladin items');

    const holyItem = gameState.activeSlots.find(i => i && i.effects && i.effects.holy);
    if (holyItem) {
        const combined = BuffSystem.getItemCombinedStats(holyItem, gameState.activeSlots);
        const holyMod = combined.modifiedEffects.holy;
        test.assert(holyMod && holyMod.isModified, 'Holy effect is modified by set bonus');
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+20% Crit, +10% Block)');
    gameState.activeSlots[3] = ItemFactory.createItem(paladinItems[3].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'paladin_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 paladin items');
    test.assertGreaterThan(buffs.critChance, 0, 'Crit chance increased');
    test.assertGreaterThan(buffs.blockChance, 0, 'Block chance increased');

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
