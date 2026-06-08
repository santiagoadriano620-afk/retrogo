const WindowQuestLog = function (id) {
  /*
   * Class WindowQuestLog
   * Container for the Quest Log (Modal)
   */

  // Inherit from Modal
  Modal.call(this, id);

  // Content body
  this.body = this.element.querySelector(".modal-body");

  // Custom layout with Tibia-style two-panel design + Footer
  // We override flex-direction to column to stack the main content and footer
  // Note: We use the existing body element
  this.body.innerHTML = `
    <div class="quest-log-window">
      
      <!-- Main Content Row -->
      <div style="display: flex; flex-direction: row; flex: 1; overflow: hidden;">
        <div class="quest-list-container">
          <div class="section-header">${__("questlog.quest_lines")}</div>
          <div class="quest-list" id="quest-log-list">
            <div class="empty-state">${__("common.loading")}</div>
          </div>
        </div>
        <div class="quest-details-container">
          <div class="section-header quest-details-header" id="quest-details-title">${__("questlog.select_quest")}</div>
          <div class="quest-details" id="quest-log-details">
            <div class="empty-state">${__("questlog.select_quest")}</div>
          </div>
        </div>
      </div>

      <!-- Footer Panel -->
      <div class="footer-panel">
        <div class="footer-left">
           <select class="tibia-select">
              <option>${__("questlog.sort_alpha")}</option>
           </select>
           
           <input type="text" class="tibia-input" placeholder="${__("common.search")}">

           <div class="tibia-checkbox-group">
              <label class="tibia-checkbox">
                <input type="checkbox" checked> ${__("questlog.show_completed")}
              </label>
              <div style="flex:1"></div>
           </div>
        </div>

        <div class="footer-right">
           <label class="tibia-checkbox text-right" style="margin-bottom: 4px;">
              <input type="checkbox" action="tracker-check"> ${__("questlog.show_tracker")}
           </label>
           
           <div class="tibia-btn-group">
              <button class="tibia-button" action="tracker">${__("window.questtracker.title")}</button>
              <button class="tibia-button" action="close">${__("common.close")}</button>
           </div>
        </div>
      </div>

    </div>
  `;

  this.listContainer = this.body.querySelector("#quest-log-list");
  this.detailsContainer = this.body.querySelector("#quest-log-details");
  this.detailsHeader = this.body.querySelector("#quest-details-title");

  // Bind close button
  const closeBtn = this.body.querySelector('button[action="close"]');
  if (closeBtn) {
    closeBtn.onclick = () => gameClient.interface.modalManager.close();
  }

  // Bind Tracker Button
  const trackerBtn = this.body.querySelector('button[action="tracker"]');
  if (trackerBtn) {
    trackerBtn.onclick = this.handleTrackerClick.bind(this);
  }

  // Bind Tracker Checkbox
  this.trackerCheckbox = this.body.querySelector('input[action="tracker-check"]');
  if (this.trackerCheckbox) {
    this.trackerCheckbox.onchange = this.handleTrackerClick.bind(this);
  }

  this.currentQuests = [];
  this.selectedQuestId = null;
}

WindowQuestLog.prototype = Object.create(Modal.prototype);
WindowQuestLog.prototype.constructor = WindowQuestLog;

WindowQuestLog.prototype.handleTrackerClick = function () {
  let tracker = gameClient.interface.windowManager.getWindow("quest-tracker-window");
  if (!tracker) return;

  if (this.selectedQuestId !== null) {
    let quest = this.currentQuests.find(q => q.id === this.selectedQuestId);
    if (quest) {
      tracker.setQuest(this.selectedQuestId, quest.name, this.currentMissions || []);
      if (this.trackerCheckbox) this.trackerCheckbox.checked = true;
    }
  }

  tracker.toggle();
}

WindowQuestLog.prototype.handleOpen = function () {
  /*
   * Function WindowQuestLog.handleOpen
   * Callback fired when the modal is opened
   */

  // Request initial list
  if (gameClient && gameClient.isConnected()) {
    gameClient.send(new QuestLogPacket(0));
  }
}

WindowQuestLog.prototype.setQuests = function (quests) {
  /*
   * Function WindowQuestLog.setQuests
   * Populates the quest list
   */

  this.currentQuests = quests;
  this.listContainer.innerHTML = "";

  if (quests.length === 0) {
    this.listContainer.innerHTML = '<div class="empty-state">' + __("questlog.no_quests") + '</div>';
    return;
  }

  quests.forEach(quest => {
    let div = document.createElement("div");
    div.className = "quest-entry";
    if (quest.completed) div.classList.add("completed");

    // Create checkmark span
    let checkSpan = document.createElement("span");
    checkSpan.className = "quest-check";
    div.appendChild(checkSpan);

    // Create name span
    let nameSpan = document.createElement("span");
    nameSpan.className = "quest-name";
    nameSpan.innerText = quest.name;
    div.appendChild(nameSpan);

    div.onclick = () => {
      // Highlight selection
      Array.from(this.listContainer.children).forEach(c => c.classList.remove("selected"));
      div.classList.add("selected");

      this.selectedQuestId = quest.id;
      this.currentMissions = null; // Reset until loaded

      // Update header with quest name
      this.detailsHeader.innerText = quest.name;

      // Update checkbox based on if this quest is being tracked
      if (this.trackerCheckbox) {
        let tracker = gameClient.interface.questTracker;
        this.trackerCheckbox.checked = (tracker && tracker.activeQuestId === quest.id);
      }

      // Request details
      this.requestQuestDetails(quest.id);
    };

    this.listContainer.appendChild(div);
  });
}

WindowQuestLog.prototype.requestQuestDetails = function (questId) {
  /*
   * Function WindowQuestLog.requestQuestDetails
   * Sends packet to request quest details
   */

  this.detailsContainer.innerHTML = '<div class="empty-state">' + __("questlog.loading_missions") + '</div>';

  gameClient.send(new QuestLogPacket(questId));
}

WindowQuestLog.prototype.setQuestDetails = function (questId, missions) {
  /*
   * Function WindowQuestLog.setQuestDetails
   * Displays the missions for a quest
   */

  this.detailsContainer.innerHTML = "";

  let questName = "Quest";
  let quest = this.currentQuests.find(q => q.id === questId);
  if (quest) {
    questName = quest.name;
    this.detailsHeader.innerText = questName;
  }

  // Store for tracker usage
  if (questId === this.selectedQuestId) {
    this.currentMissions = missions;
  }

  if (missions.length === 0) {
    this.detailsContainer.innerHTML = '<div class="empty-state">' + __("questlog.no_missions") + '</div>';
    return;
  }

  missions.forEach((mission, index) => {
    let div = document.createElement("div");
    div.className = "mission-entry";
    if (mission.completed) {
      div.classList.add("completed");
    } else {
      div.classList.add("incomplete");
    }

    let title = document.createElement("div");
    title.className = "mission-name";

    // Add checkmark for mission
    let checkSpan = document.createElement("span");
    checkSpan.className = "mission-check";
    checkSpan.innerText = mission.completed ? "✓" : "○";
    title.appendChild(checkSpan);

    let nameText = document.createElement("span");
    nameText.innerText = mission.name;
    title.appendChild(nameText);

    let desc = document.createElement("div");
    desc.className = "mission-description";
    desc.innerText = mission.description;

    div.appendChild(title);
    div.appendChild(desc);
    this.detailsContainer.appendChild(div);
  });
}
