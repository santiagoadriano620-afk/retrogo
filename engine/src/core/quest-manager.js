"use strict";

const fs = require("fs");
const path = require("path");

const QuestManager = function () {
    /*
     * Class QuestManager
     * Manages the definitions of quests and their states
     */

    this.quests = [];
    this.__loadQuests();
}

QuestManager.prototype.__loadQuests = function () {
    /*
     * Function QuestManager.__loadQuests
     * Loads the quest definitions from JSON
     */

    try {
        const filePath = path.join(__dirname, "../../../data/misc/quests.json");
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            this.quests = JSON.parse(data);
            console.log("Loaded [[ %s ]] quests definitions.".format(this.quests.length));
        } else {
            console.warn("No quests.json found in data directory.");
        }
    } catch (error) {
        console.error("Failed to load quests:", error);
    }
}

QuestManager.prototype.getQuestList = function (player) {
    /*
     * Function QuestManager.getQuestList
     * Returns ALL quests and their current status for a player.
     * Each quest shows completed if ALL missions are done, incomplete otherwise.
     */

    let playerQuests = [];

    this.quests.forEach(quest => {
        if (quest.missions.length === 0) return;

        let allDone = true;

        for (let i = 0; i < quest.missions.length; i++) {
            let mission = quest.missions[i];
            let storageValue = player.getStorage(mission.storageKey);
            let done = storageValue >= mission.storageValue;
            if (!done) allDone = false;
        }

        playerQuests.push({
            id: quest.id,
            name: quest.name,
            completed: allDone
        });
    });

    return playerQuests;
}

QuestManager.prototype.getQuestMissions = function (player, questId) {
    /*
     * Function QuestManager.getQuestMissions
     * Returns ALL missions for a quest, each with a completed flag
     */

    let quest = this.quests.find(q => q.id === questId);
    if (!quest) return [];

    let missions = [];

    quest.missions.forEach(mission => {
        let storageValue = player.getStorage(mission.storageKey);
        missions.push({
            name: mission.name,
            description: mission.description,
            completed: storageValue >= mission.storageValue
        });
    });

    return missions;
}

QuestManager.prototype.getQuestForStorage = function (storageKey) {
    /*
     * Function QuestManager.getQuestForStorage
     * Returns the quest associated with a storage key, or null
     */

    return this.quests.find(quest => {
        return quest.missions.some(mission => mission.storageKey === storageKey);
    }) || null;
}

module.exports = QuestManager;
