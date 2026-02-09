/**
 * Shared test utilities for set testing.
 * Provides mocks, helpers for equipping items, simulating combat, and assertions.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== MOCKS ====================
function setupMocks() {
    global.window = {};
    const mockElement = {
        style: {},
        classList: { add: () => { }, remove: () => { }, contains: () => false },
        innerText: "",
        innerHTML: "",
        value: "",
        addEventListener: () => { },
        appendChild: () => { },
        children: [],
        querySelectorAll: () => [],
        querySelector: () => null,
        setAttribute: () => { },
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        remove: () => { }
    };

    global.document = {
        getElementById: () => mockElement,
        createElement: () => mockElement,
        querySelector: () => mockElement, // Return mock by default
        querySelectorAll: () => [],
        body: { appendChild: () => { } }
    };

    global.fetch = async (url) => {
        try {
            const projectRoot = path.join(__dirname, '..');
            const filePath = path.join(projectRoot, url);
            const content = fs.readFileSync(filePath, 'utf8');
            return { json: async () => JSON.parse(content) };
        } catch (e) {
            console.error(`Fetch mock failed for ${url}: ${e.message}`);
            return { json: async () => ({}) };
        }
    };

    global.Audio = class { play() { } pause() { } };
}

// ==================== HELPERS ====================

/**
 * Get all items belonging to a specific set.
 * @param {Map} itemsMap - dataManager.items
 * @param {string} setId - e.g., 'dwarf', 'elf'
 * @returns {Array} Array of item templates
 */
function getSetItems(itemsMap, setId) {
    const items = [];
    for (const [id, item] of itemsMap) {
        if (item.set === setId) {
            items.push(item);
        }
    }
    return items;
}

/**
 * Create an Item instance from a template.
 * @param {Object} ItemFactory - The ItemFactory class
 * @param {Object} template - Item template from dataManager
 * @param {number} starLevel - Star level (0-10)
 * @returns {Item}
 */
function createItem(ItemFactory, template, starLevel = 0) {
    const item = ItemFactory.createItem(template.id, starLevel);
    item.starLevel = starLevel;
    return item;
}

/**
 * Equip items into player active slots.
 * @param {Object} gameState - The game state
 * @param {Array} items - Array of Item instances
 */
function equipItems(gameState, items) {
    items.forEach((item, index) => {
        if (index < gameState.activeSlots.length && item) {
            gameState.activeSlots[index] = item;
        }
    });
}

/**
 * Simulate combat for a number of ticks.
 * @param {Object} combatSystem - The combat system
 * @param {number} ticks - Number of update calls
 * @param {number} deltaTime - Time per tick in ms
 */
function simulateCombat(combatSystem, ticks, deltaTime = 100) {
    for (let i = 0; i < ticks; i++) {
        combatSystem.update(deltaTime);
    }
}

// ==================== ASSERTIONS ====================

class TestRunner {
    constructor(name) {
        this.name = name;
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    }

    assert(condition, message) {
        if (condition) {
            this.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            this.failed++;
            this.errors.push(message);
            console.log(`  ❌ ${message}`);
        }
    }

    assertEqual(actual, expected, message) {
        if (actual === expected) {
            this.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            this.failed++;
            this.errors.push(`${message} (expected: ${expected}, got: ${actual})`);
            console.log(`  ❌ ${message} (expected: ${expected}, got: ${actual})`);
        }
    }

    assertGreaterThan(actual, threshold, message) {
        if (actual > threshold) {
            this.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            this.failed++;
            this.errors.push(`${message} (expected > ${threshold}, got: ${actual})`);
            console.log(`  ❌ ${message} (expected > ${threshold}, got: ${actual})`);
        }
    }

    assertApproxEqual(actual, expected, tolerance, message) {
        if (Math.abs(actual - expected) <= tolerance) {
            this.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            this.failed++;
            this.errors.push(`${message} (expected ~${expected} ±${tolerance}, got: ${actual})`);
            console.log(`  ❌ ${message} (expected ~${expected} ±${tolerance}, got: ${actual})`);
        }
    }

    summary() {
        console.log(`\n${this.name}: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }
}

export {
    setupMocks,
    getSetItems,
    createItem,
    equipItems,
    simulateCombat,
    TestRunner
};
