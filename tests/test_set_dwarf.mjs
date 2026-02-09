/**
 * Dwarf Set Tests
 * - 2pc: +25% Crit Chance
 * - 3pc: 2x Bleed Damage
 * - 4pc: Bleed tick interval reduced to 500ms (2x speed)
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

    const test = new TestRunner('Dwarf Set Tests');
    console.log('\n🪓 DWARF SET TESTS\n');

    // Get dwarf items
    const dwarfItems = getSetItems(dataManager.items, 'dwarf');
    console.log(`Found ${dwarfItems.length} dwarf items`);

    // Test 2pc bonus
    console.log('\n📋 Test: 2pc Bonus (+25% Crit)');
    gameState.activeSlots = [null, null, null, null, null, null];
    const item1 = ItemFactory.createItem(dwarfItems[0].id);
    const item2 = ItemFactory.createItem(dwarfItems[1].id);
    gameState.activeSlots[0] = item1;
    gameState.activeSlots[1] = item2;

    let buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus2pc = buffs.setBonuses.find(b => b.id === 'dwarf_2');
    test.assert(bonus2pc && bonus2pc.active, '2pc bonus activates with 2 dwarf items');
    test.assertApproxEqual(buffs.critChance, 0.25, 0.01, 'Crit chance increased by 25%');

    // Test 3pc bonus
    console.log('\n📋 Test: 3pc Bonus (2x Bleed Dmg)');
    const item3 = ItemFactory.createItem(dwarfItems[2].id);
    gameState.activeSlots[2] = item3;

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus3pc = buffs.setBonuses.find(b => b.id === 'dwarf_3');
    test.assert(bonus3pc && bonus3pc.active, '3pc bonus activates with 3 dwarf items');

    // Check bleed effect modification
    const weaponItem = gameState.activeSlots.find(i => i && i.effects && i.effects.bleed);
    if (weaponItem) {
        const combined = BuffSystem.getItemCombinedStats(weaponItem, gameState.activeSlots);
        const bleedMod = combined.modifiedEffects.bleed;
        test.assert(bleedMod && bleedMod.isModified, 'Bleed effect is modified by set bonus');
        if (bleedMod && bleedMod.original) {
            test.assertEqual(bleedMod.damagePerTick, bleedMod.original.damagePerTick * 2, 'Bleed damage doubled');
        }
    } else {
        console.log('  ⚠️ No bleed weapon found to test damage multiplier');
    }

    // Test 4pc bonus
    console.log('\n📋 Test: 4pc Bonus (+50% Bleed Speed)');
    const item4 = ItemFactory.createItem(dwarfItems[3].id);
    gameState.activeSlots[3] = item4;

    buffs = BuffSystem.calculateGlobalBonuses(gameState.activeSlots);
    let bonus4pc = buffs.setBonuses.find(b => b.id === 'dwarf_4');
    test.assert(bonus4pc && bonus4pc.active, '4pc bonus activates with 4 dwarf items');

    if (weaponItem) {
        const combined = BuffSystem.getItemCombinedStats(weaponItem, gameState.activeSlots);
        const bleedMod = combined.modifiedEffects.bleed;
        test.assertEqual(bleedMod?.tickInterval, 500, 'Bleed tick interval set to 500ms');
    }

    // Test combat integration
    console.log('\n📋 Test: Combat Integration');
    gameState.level = 1;
    gameState.configureBoss();
    const initialBossHp = gameState.enemy.hp;

    gameState.setPhase(PHASES.COMBAT);
    combatSystem.startFight();

    // Simulate combat
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
