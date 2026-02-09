/**
 * Celestial Set Tests
 * - 2pc: +1 Multihit
 * - 3pc: 2x Holy Heal
 * - 4pc: +1 Multihit (Total +2)
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

    const test = new TestRunner('Celestial Set Tests');
    console.log('\n☀️ CELESTIAL SET TESTS\n');

    const celestialItems = getSetItems(dataManager.items, 'celestial');
    console.log(`Found ${celestialItems.length} celestial items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (+1 Multihit)');
    gameState.activeSlots = [null, null, null, null, null, null];
    gameState.activeSlots[0] = ItemFactory.createItem(celestialItems[0].id);
    gameState.activeSlots[1] = ItemFactory.createItem(celestialItems[1].id);

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'celestial_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 celestial items');
    test.assertGreaterThan(buffs.multihitCount, 0, 'Multihit count increased');

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Holy Heal)');
    gameState.activeSlots[2] = ItemFactory.createItem(celestialItems[2].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'celestial_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 celestial items');

    const holyItem = gameState.activeSlots.find(i => i && i.effects && i.effects.holy);
    if (holyItem) {
        const combined = BuffSystem.getItemCombinedStats(holyItem, gameState.activeSlots);
        const holyMod = combined.modifiedEffects.holy;
        test.assert(holyMod && holyMod.isModified, 'Holy effect is modified by set bonus');
        if (holyMod && holyMod.original && holyMod.original.heal) {
            test.assertEqual(holyMod.heal, holyMod.original.heal * 2, 'Holy heal doubled');
        }
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+2 Total Multihit)');
    gameState.activeSlots[3] = ItemFactory.createItem(celestialItems[3].id);

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'celestial_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 celestial items');
    test.assertGreaterThan(buffs.multihitCount, 1, 'Multihit count is at least 2');

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
