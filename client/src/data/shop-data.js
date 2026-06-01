"use strict";

const SHOP_CATEGORIES = [
  {
    name: "Training Weapons",
    items: [
      { id: 3139, name: "Training Rod", desc: "Reduces spell mana cost by 10% while equipped.", price: 25 },
      { id: 3140, name: "Training Spear", desc: "For distance fighting training. Attack speed 20% faster.", price: 25 },
      { id: 3141, name: "Training Shield", desc: "For shielding training. Shielding skill 20% faster.", price: 20 },
      { id: 3142, name: "Training Club", desc: "For club fighting training. Attack speed 20% faster.", price: 25 },
      { id: 3143, name: "Training Sword", desc: "For sword fighting training. Attack speed 20% faster.", price: 25 },
      { id: 3144, name: "Training Axe", desc: "For axe fighting training. Attack speed 20% faster.", price: 25 },
      { id: 3138, name: "Training Dummy", desc: "A placeable training dummy for your house. Attack it with training weapons to gain skill.", price: 30 },
    ]
  },
  {
    name: "Tools",
    items: [
      { id: 3145, name: "Keyring", desc: "A handy ring to keep all your keys organized. (5 slots)", price: 20 },
      { id: 3150, name: "Multitool", desc: "A versatile tool combining rope, shovel, and pick functions.", price: 25 },
    ]
  },
  {
    name: "Premium Days",
    items: [
      { id: 64001, name: "30 Days Premium", desc: "30 days of premium account features.", price: 100 },
      { id: 64002, name: "90 Days Premium", desc: "90 days of premium account features.", price: 250 },
      { id: 64003, name: "180 Days Premium", desc: "180 days of premium account features.", price: 450 },
    ]
  },
  {
    name: "Outfits",
    items: [
      { id: 2671, name: "Warrior Outfit", desc: "A complete warrior outfit set.", price: 75 },
      { id: 2672, name: "Mage Outfit", desc: "A complete mage outfit set.", price: 75 },
      { id: 2673, name: "Hunter Outfit", desc: "A complete hunter outfit set.", price: 50 },
    ]
  },
  {
    name: "Global Boost",
    items: [
      { id: 64004, name: "EXP Boost", desc: "All players receive +10% experience for 2 hours.", price: 80 },
      { id: 64005, name: "Drop Boost", desc: "All players receive +20% loot rate for 2 hours.", price: 120 },
      { id: 64006, name: "Skills Boost", desc: "All players receive +10% skill rate for 2 hours.", price: 80 },
    ]
  }
];
