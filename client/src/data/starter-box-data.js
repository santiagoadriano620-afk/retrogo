"use strict";

const STARTER_BOX_DATA = {
  3135: {
    name: "Bronze Starter Box",
    price: 15,
    autoGrant: [
      { type: "premiumDays", label: "30 Days Premium Account", count: 30 }
    ],
    choices: [
      {
        type: "trainingWeapon",
        label: "Choose 2 Training Weapons",
        max: 2,
        options: [
          { id: 3139, name: "Training Rod" },
          { id: 3140, name: "Training Spear" },
          { id: 3141, name: "Training Shield" },
          { id: 3142, name: "Training Club" },
          { id: 3143, name: "Training Sword" },
          { id: 3144, name: "Training Axe" }
        ]
      }
    ]
  },
  3136: {
    name: "Silver Starter Box",
    price: 70,
    autoGrant: [
      { type: "premiumDays", label: "90 Days Premium Account", count: 90 },
      { type: "item", id: 3138, label: "Training Dummy" }
    ],
    choices: [
      {
        type: "trainingWeapon",
        label: "Choose 5 Training Weapons",
        max: 5,
        allowDuplicates: true,
        options: [
          { id: 3139, name: "Training Rod" },
          { id: 3140, name: "Training Spear" },
          { id: 3141, name: "Training Shield" },
          { id: 3142, name: "Training Club" },
          { id: 3143, name: "Training Sword" },
          { id: 3144, name: "Training Axe" }
        ]
      },
      {
        type: "tool",
        label: "Choose 1 Tool",
        max: 1,
        options: [
          { id: 3145, name: "Keyring" },
          { id: 3146, name: "Multitool" }
        ]
      },
      {
        type: "outfit",
        label: "Choose 1 Outfit",
        max: 1,
        genderFilter: true,
        options: [
          { id: 65001, name: "Royal Nobleman" },
          { id: 65002, name: "Knight Commander" },
          { id: 65003, name: "Jester" },
          { id: 65004, name: "Sage" },
          { id: 65005, name: "Warrior Female" },
          { id: 65006, name: "Knight Commander" },
          { id: 65007, name: "Alchemist" },
          { id: 65008, name: "Mademoiselle" }
        ]
      }
    ]
  },
  3137: {
    name: "Golden Starter Box",
    price: 140,
    autoGrant: [
      { type: "premiumDays", label: "180 Days Premium Account", count: 180 },
      { type: "premiumPoints", label: "+50 Premium Points", count: 50 }
    ],
    choices: [
      {
        type: "trainingWeapon",
        label: "Choose 10 Training Weapons",
        max: 10,
        allowDuplicates: true,
        options: [
          { id: 3139, name: "Training Rod" },
          { id: 3140, name: "Training Spear" },
          { id: 3141, name: "Training Shield" },
          { id: 3142, name: "Training Club" },
          { id: 3143, name: "Training Sword" },
          { id: 3144, name: "Training Axe" }
        ]
      },
      {
        type: "tool",
        label: "Choose 2 Tools (can be same)",
        max: 2,
        allowDuplicates: true,
        options: [
          { id: 3145, name: "Keyring" },
          { id: 3146, name: "Multitool" }
        ]
      },
      {
        type: "outfit",
        label: "Choose 2 Outfits",
        max: 2,
        genderFilter: true,
        options: [
          { id: 65001, name: "Royal Nobleman" },
          { id: 65002, name: "Knight Commander" },
          { id: 65003, name: "Jester" },
          { id: 65004, name: "Sage" },
          { id: 65005, name: "Warrior Female" },
          { id: 65006, name: "Knight Commander" },
          { id: 65007, name: "Alchemist" },
          { id: 65008, name: "Mademoiselle" }
        ]
      }
    ]
  }
};
