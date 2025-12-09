import { Item } from './Item.js';

export class ItemFactory {
    static createSword() {
        return new Item("Sword", "⚔️", 25, 3000, 'sword', 0.1, 0);
    }
    
    static createWhetstone() {
        const item = new Item("Whetstone", "🪨", 0, 0, 'accessory', 0, 50);
        item.description = "Swords Crit Dmg -> 250%";
        return item;
    }

    static createGloves() {
        const item = new Item("Gloves", "🧤", 0, 0, 'accessory', 0, 50);
        item.description = "Swords Attack Speed +80%";
        return item;
    }

    static createLuckyCharm() {
        const item = new Item("Lucky Charm", "🍀", 0, 0, 'accessory', 0, 50);
        item.description = "Swords Crit Chance +25%";
        return item;
    }
    static createZeladSword() {
        return new Item("Zelad Sword", "🗡️", 40, 2500, 'sword', 0.15, 0);
    }

    static createDragonShield() {
        const item = new Item("Dragon Shield", "🛡️", 0, 1000, 'shield', 0, 0);
        item.description = "Adds 20 Shield per Sword Attack";
        return item;
    }

    static createRageStone() {
        const item = new Item("Rage Stone", "🔴", 0, 0, 'accessory', 0, 0);
        item.description = "Atk Spd, Dmg, Crit +1% per attack";
        item.onAttackEffect = [
            { type: 'speed_stack', value: 0.1 },
            { type: 'damage_stack', value: 0.1 },
            { type: 'crit_stack', value: 0.1 }
        ];
        return item;
    }
}
