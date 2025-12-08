export class BuffSystem {
    static calculateBuffs(slots) {
        let speedBonus = 0;
        let critDmg = 2.0;
        let critChance = 0;
        
        slots.forEach(item => {
            if (item) {
                if (item.name === "Gloves") speedBonus += 0.80;
                if (item.name === "Whetstone") critDmg = 2.5;
                if (item.name === "Lucky Charm") critChance += 0.25;
            }
        });
        return { speedBonus, critDmg, critChance };
    }
}
