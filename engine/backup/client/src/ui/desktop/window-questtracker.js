const QuestTrackerWindow = function (element) {
  InteractiveWindow.call(this, element);
  this.activeQuestId = null;
  this.activeQuestMissions = [];
  this.__renderContent();
}

QuestTrackerWindow.prototype = Object.create(InteractiveWindow.prototype);
QuestTrackerWindow.prototype.constructor = QuestTrackerWindow;

QuestTrackerWindow.prototype.setQuest = function (questId, questName, missions) {
  this.activeQuestId = questId;
  this.activeQuestName = questName;
  this.activeQuestMissions = missions || [];
  this.__renderContent();
}

QuestTrackerWindow.prototype.updateMissions = function (missions) {
  if (!this.activeQuestId) return;
  this.activeQuestMissions = missions || [];
  this.__renderContent();
}

QuestTrackerWindow.prototype.clear = function () {
  this.activeQuestId = null;
  this.activeQuestName = null;
  this.activeQuestMissions = [];
  this.__renderContent();
}

QuestTrackerWindow.prototype.__renderContent = function () {
  let questNameEl = this.getElement(".tracker-quest-name");
  let missionListEl = this.getElement(".tracker-mission-list");
  let emptyEl = this.getElement(".tracker-empty");

  if (!this.activeQuestId) {
    questNameEl.style.display = "none";
    missionListEl.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }

  questNameEl.style.display = "block";
  missionListEl.style.display = "flex";
  emptyEl.style.display = "none";

  questNameEl.innerText = this.activeQuestName;

  missionListEl.innerHTML = "";

  if (!this.activeQuestMissions || this.activeQuestMissions.length === 0) {
    let div = document.createElement("div");
    div.className = "tracker-mission";
    div.innerText = "No active missions.";
    missionListEl.appendChild(div);
    return;
  }

  this.activeQuestMissions.forEach(function (mission) {
    let div = document.createElement("div");
    div.className = "tracker-mission";
    div.innerHTML = '<span class="mission-name">' + mission.name + '</span>';
    if (mission.description) {
      div.innerHTML += '<span class="mission-desc">' + mission.description + '</span>';
    }
    missionListEl.appendChild(div);
  });
}
