export class Item {
    constructor(name, icon, damage, cooldown, type = 'generic', critChance = 0, price = 0) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.name = name;
        this.icon = icon;
        this.damage = damage;
        this.cooldown = cooldown; // in ms
        this.currentCooldown = 0;
        this.type = type; // 'sword', 'accessory', etc.
        this.description = "";
        this.critChance = critChance;
        this.price = price;
    }
}
