"use strict";

const SHOP_CATEGORIES = [
  {
    name: __("modal.shop.category_training"),
    items: [
      { id: 3139, name: "Training Rod", desc: "Reduces spell mana cost by 10% while equipped.", price: 1 },
      { id: 3140, name: "Training Spear", desc: "For distance fighting training. Attack speed 20% faster.", price: 1 },
      { id: 3141, name: "Training Shield", desc: "For shielding training. Shielding skill 20% faster.", price: 1 },
      { id: 3142, name: "Training Club", desc: "For club fighting training. Attack speed 20% faster.", price: 1 },
      { id: 3143, name: "Training Sword", desc: "For sword fighting training. Attack speed 20% faster.", price: 1 },
      { id: 3144, name: "Training Axe", desc: "For axe fighting training. Attack speed 20% faster.", price: 1 },
      { id: 3138, name: "Training Dummy", desc: "A placeable training dummy for your house. Attack it with training weapons to gain skill.", price: 15 },
    ]
  },
  {
    name: __("modal.shop.category_tools"),
    items: [
      { id: 3145, name: "Keyring", desc: "A handy ring to keep all your keys organized. (5 slots)", price: 10 },
      { id: 3146, name: "Multitool", desc: "A versatile tool combining rope, shovel, and pick functions.", price: 10 },
    ]
  },
  {
    name: __("modal.shop.category_premium"),
    items: [
      { id: 64001, name: "30 Days Premium", desc: "30 days of premium account features.", price: 8 },
      { id: 64002, name: "90 Days Premium", desc: "90 days of premium account features.", price: 25 },
      { id: 64003, name: "180 Days Premium", desc: "180 days of premium account features.", price: 45 },
      { id: 64007, name: "365 Days Premium", desc: "365 days of premium account features.", price: 80 },
    ]
  },
  {
    name: __("modal.shop.category_outfits"),
    items: [
      { id: 65001, name: "Royal Nobleman Outfit", desc: "A regal attire fit for nobility.", price: 20 },
      { id: 65002, name: "Knight Commander Outfit", desc: "Command respect on the battlefield.", price: 20 },
      { id: 65003, name: "Jester Outfit", desc: "A playful ensemble for entertainers.", price: 20 },
      { id: 65004, name: "Sage Outfit", desc: "Wise robes for the scholarly.", price: 20 },
      { id: 65005, name: "Warrior Female", desc: "Fierce armor for the fearless.", price: 20 },
      { id: 65006, name: "Knight Commander", desc: "Lead your allies with pride.", price: 20 },
      { id: 65007, name: "Alchemist", desc: "Gear for brewing and experimenting.", price: 20 },
      { id: 65008, name: "Mademoiselle", desc: "An elegant dress for distinguished ladies.", price: 20 },
    ]
  },
  {
    name: __("modal.shop.category_boosts"),
    items: [
      { id: 64004, name: "EXP Boost", desc: "All players receive +10% experience for 2 hours.", price: 5 },
      { id: 64005, name: "Drop Boost", desc: "All players receive +20% loot rate for 2 hours.", price: 5 },
      { id: 64006, name: "Skills Boost", desc: "All players receive +10% skill rate for 2 hours.", price: 5 },
    ]
  }
];
