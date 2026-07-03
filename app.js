//自分でいじったver
const STORAGE_KEY = "pad-multi-skill-sim";
const teamLabels = ["A", "B"];

const state = {
  activePlayer: 0,
  actionCount: 0,
  aTurnCount: 0,
  bTurnCount: 0,
  floorCount: 1,
  floorActions:{},
  teams: [],
  log: [],
  history: [],
  isBattleStarted: false,
  setupSnapshot: null,
};


const elements = {
  teams: document.querySelector("#teams"),
  activePlayerName: document.querySelector("#activePlayerName"),
  returnSetup:document.getElementById("returnSetup"),
  actionCount: document.querySelector("#actionCount"),
  floorCount: document.querySelector("#floorCount"),
  floorButton: document.querySelector("#floorButton"),
  floorDialog: document.querySelector("#floorDialog"),
  floorDialogTitle: document.querySelector("#floorDialogTitle"),
  floorDialogCancel: document.querySelector("#floorDialogCancel"),
  floorActionType: document.querySelector("#floorActionType"),
  floorActionValue: document.querySelector("#floorActionValue"),
  floorActionList:document.querySelector("#floorActionList"),
  saveFloorAction: document.querySelector("#saveFloorAction"),
  saveAndNextFloor:document.querySelector("#saveAndNextFloor"),
  floorEditTarget:document.querySelector("#floorEditTarget"),
  abTurnCount: document.querySelector("#abTurnCount"),
  enemyTurns: document.querySelector("#enemyTurns"),
  startBattle:document.getElementById("startBattle"),
  logList: document.querySelector("#logList"),
  memberDialog: document.querySelector("#memberDialog"),
  memberEditForm: document.querySelector("#memberEditForm"),
  dialogCancel: document.querySelector("#dialogCancel"),
  dialogSlot: document.querySelector("#dialogSlot"),
  editName: document.querySelector("#editName"),
  skillModePanel: document.querySelector("#skillModePanel"),
  editSkillMode: document.querySelector("#editSkillMode"),
  editPhaseCount: document.querySelector("#editPhaseCount"),
  editPhaseIndex: document.querySelector("#editPhaseIndex"),
  editMaxCd: document.querySelector("#editMaxCd"),
  editHaste: document.querySelector("#editHaste"),
  delayLatentPanel: document.querySelector("#delayLatentPanel"),
  editDelayLatent: document.querySelector("#editDelayLatent"),
  delayAwakeningPanel: document.querySelector("#delayAwakeningPanel"),
  editDelayAwakening: document.querySelector("#editDelayAwakening"),
};

const editTarget = {
  teamIndex: null,
  memberIndex: null,
  skillType: "member"
};

let editingFloor = 1;

function makeDefaultTeam(index) {
  const names = ["リーダー", "サブ1", "サブ2", "サブ3", "サブ4", "助っ人"];
  return {
    name: `マルチ${teamLabels[index]}`,
    boosts: 12,
    members: names.map((name, memberIndex) => ({
      name,
      maxCd: memberIndex === 0 ? 20 : 12 + memberIndex,
      currentCd: Math.max(0, (memberIndex === 0 ? 20 : 12 + memberIndex) - 12),
      haste: memberIndex === 0 ? 0 : 0,
      delayLatent: 0,
      delayAwakening: 0
    }))
  };
}

function makeDefaultAssist(memberIndex) {
  return {
    name: `アシスト${memberIndex + 1}`,
    maxCd: 10,
    currentCd: 10,
    haste: 0,
    delayLatent: 0,
    delayAwakening: 0
  };
}

function snapshot() {
  return JSON.stringify({
    activePlayer: state.activePlayer,
    actionCount: state.actionCount,
    floorCount: state.floorCount,
    enemyTurns: state.enemyTurns,
    aTurnCount: state.aTurnCount,
    bTurnCount: state.bTurnCount,
    teams: state.teams,
    log: state.log,
    floorActions: state.floorActions
  });
}

function restore(serialized) {
  const data = JSON.parse(serialized);
  state.activePlayer = data.activePlayer ?? 0;
  state.actionCount = data.actionCount ?? 0;
  state.floorCount = data.floorCount ?? 1;
  state.enemyTurns = data.enemyTurns ?? 3;
  state.aTurnCount = data.aTurnCount ?? 0;
  state.bTurnCount = data.bTurnCount ?? 0;
  state.teams = data.teams ?? [];
  state.log = data.log ?? [];
  state.floorActions = data.floorActions ?? {};
  state.history = [];
  ensureTeams();
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > 80) {
    state.history.shift();
  }
}

function getUnconfiguredMembers() {
  const warnings = [];

  state.teams.forEach((team) => {
    team.members.forEach((member, index) => {
      const defaultName =
        !member.name ||
        member.name === `キャラ${index + 1}`;

      const defaultSkill =
        getSkillMaxCd(member) === 20;

      if (defaultName && defaultSkill) {
        warnings.push(
          `${team.name} ${index + 1}`
        );
      }
    });
  });

  return warnings;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureTeams() {
  while (state.teams.length < 2) {
    state.teams.push(makeDefaultTeam(state.teams.length));
  }
  state.teams = state.teams.slice(0, 2);
  state.teams.forEach((team) => {
    team.members.forEach((member, memberIndex) => {
      if (!member.assist) {
        member.assist = makeDefaultAssist(memberIndex);
      }
      normalizeSkill(member, member.name || `枠${memberIndex + 1}`);
      normalizeSkill(member.assist, member.assist.name || `アシスト${memberIndex + 1}`);
    });
  });
  if (state.activePlayer >= 2) {
    state.activePlayer = 0;
  }
}

function clampNumber(value, min = -99, max = 99) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function createPhaseFromSkill(skill, index = 0) {
  return {
    name: skill.name || `スキル${index + 1}`,
    maxCd: clampNumber(skill.maxCd ?? 0),
    haste: clampNumber(skill.haste ?? 0)
  };
}

function normalizeSkill(skill, fallbackName = "スキル") {
  skill.mode = skill.mode || "normal";
  if (!Array.isArray(skill.phases) || skill.phases.length === 0) {
    skill.phases = [createPhaseFromSkill({ ...skill, name: skill.name || fallbackName }, 0)];
  }
  skill.phases = skill.phases.map((phase, index) => ({
    name: phase.name || `${fallbackName}${index + 1}`,
    maxCd: clampNumber(phase.maxCd),
    haste: clampNumber(phase.haste)
  }));
  skill.phaseIndex = clampNumber(skill.phaseIndex ?? 0, 0, skill.phases.length - 1);
  const activePhase = getActivePhase(skill);
  skill.name = activePhase.name;
  skill.maxCd = activePhase.maxCd;
  skill.haste = activePhase.haste;
  skill.currentCd = clampNumber(skill.currentCd, 0, activePhase.maxCd);
}

function getActivePhase(skill) {
  return skill.phases?.[skill.phaseIndex ?? 0] || createPhaseFromSkill(skill, 0);
}

function getSkillName(skill) {
  return getActivePhase(skill).name;
}

function getSkillMaxCd(skill) {
  return getActivePhase(skill).maxCd;
}

function getSkillHaste(skill) {
  return getActivePhase(skill).haste;
}

function resetMemberCd(member, boosts) {
  let remainBoost = boosts;

  const mainMaxCd = getSkillMaxCd(member);
  const assistMaxCd = getSkillMaxCd(member.assist);

  const consumeMain =
    Math.min(mainMaxCd, remainBoost);

  member.currentCd =
    mainMaxCd - consumeMain;

  remainBoost -= consumeMain;

  member.assist.currentCd =
    Math.max(0, assistMaxCd - remainBoost);
}

function resizeSkillPhases(skill, count) {
  const phaseCount = clampNumber(count, 1, 9);
  normalizeSkill(skill, skill.name || "スキル");
  while (skill.phases.length < phaseCount) {
    const previous = skill.phases[skill.phases.length - 1];
    skill.phases.push({
      name: `スキル${skill.phases.length + 1}`,
      maxCd: previous.maxCd,
      haste: previous.haste
    });
  }
  skill.phases = skill.phases.slice(0, phaseCount);
  skill.phaseIndex = clampNumber(skill.phaseIndex, 0, skill.phases.length - 1);
}

function advanceSkillPhase(skill) {
  normalizeSkill(skill, skill.name || "スキル");
  if (skill.mode === "normal" || skill.phases.length <= 1) {
    skill.currentCd = getSkillMaxCd(skill);
    return;
  }
  if (skill.mode === "loop") {
    skill.phaseIndex = (skill.phaseIndex + 1) % skill.phases.length;
  } else if (skill.phaseIndex < skill.phases.length - 1) {
    skill.phaseIndex += 1;
  }
  const activePhase = getActivePhase(skill);
  skill.name = activePhase.name;
  skill.maxCd = activePhase.maxCd;
  skill.haste = activePhase.haste;
  skill.currentCd = activePhase.maxCd;
}

function resetSkillToFirstPhase(skill) {
  normalizeSkill(skill);

  skill.phaseIndex = 0;

  const phase = getActivePhase(skill);

  skill.name = phase.name;
  skill.maxCd = phase.maxCd;
  skill.haste = phase.haste;
  skill.currentCd = phase.maxCd;
}

function resetAllSkillsToFirstPhase() {
  state.teams.forEach((team) => {
    team.members.forEach((member) => {

      resetSkillToFirstPhase(member);
      resetSkillToFirstPhase(member.assist);

    });
  });
}

function getVisibleMemberIndices(teamIndex) {
  if (teamIndex === 0) {
    return [0, 1, 2, 3, 4];
  }
  if (teamIndex === 1) {
    return [1, 2, 3, 4, 5];
  }
  return [0, 1, 2, 3, 4, 5];
}

function getLeaderIndex(teamIndex) {
  return teamIndex === 0 ? 0 : 5;
}

function isLeaderSlot(teamIndex, memberIndex) {
  return memberIndex === getLeaderIndex(teamIndex);
}

function isMemberVisible(teamIndex, memberIndex) {
  return getVisibleMemberIndices(teamIndex).includes(memberIndex);
}

function getSkillData(member, skillType) {
  return skillType === "assist" ? member.assist : member;
}

function isAssistReady(member) {
  return member.currentCd === 0 && member.assist.currentCd === 0;
}

function isMemberSkillReady(member) {
  return member.currentCd === 0 && !isAssistReady(member);
}

function getAssistRemaining(member) {
  return member.currentCd + member.assist.currentCd;
}

function getAssistPercent(member) {
  const totalMax = getSkillMaxCd(member) + getSkillMaxCd(member.assist);
  if (totalMax <= 0) return 100;
  const charged = totalMax - getAssistRemaining(member);
  return Math.max(0, Math.min(100, Math.round((charged / totalMax) * 100)));
}

function getDisplayMemberName(teamIndex, memberIndex, member) {
  if (teamIndex === 1 && memberIndex === 5) {
    return "リーダー";
  }
  return getSkillName(member);
}

function chargeMember(member, amount) {
  let remaining = amount;
  if (member.currentCd > 0) {
    const used = Math.min(member.currentCd, remaining);
    member.currentCd -= used;
    remaining -= used;
  }
  if (remaining > 0) {
    member.assist.currentCd = Math.max(0, member.assist.currentCd - remaining);
  }
}

function delayMember(member,amount){
  const resist = getTotalDelayResist(member);

  const actualDelay = Math.max(0, amount - resist);
   Math.max(0,amount - resist);

  member.currentCd += actualDelay;
}

function delayAssist(assist, amount) {
  const resist =
    (assist.delayAwakening ?? 0) * 2;

  const actualDelay =
    Math.max(0, amount - resist);

  assist.currentCd += actualDelay;
}

function delayTeam(teamIndex, amount){
    const team = state.teams[teamIndex];
    team.members.forEach((member) => {
      delayMember(member, amount);
    });
}

function applyPreemptiveDelay(amount) {
  const breakerTeam = (state.activePlayer + 1) % 2;
  const otherTeam = (breakerTeam + 1) % 2;

  state.teams[breakerTeam].members.forEach(member => {
    delayMember(member, amount);
    delayAssist(member.assist, amount);
  });

  const otherLeader = getLeaderIndex(otherTeam);

  delayMember(state.teams[otherTeam].members[otherLeader], amount);
  delayAssist(state.teams[otherTeam].members[otherLeader].assist, amount);
}

function getTotalDelayResist(member) {
  return (
    (member.delayLatent ?? 0)
    + (member.delayAwakening ?? 0) * 2
    + (member.assist.delayAwakening ?? 0) * 2
  );
}



function applyPreemptiveHaste(amount) {
  const breakerTeam = (state.activePlayer + 1) % 2;
  const otherTeam = (breakerTeam + 1) % 2;

  state.teams[breakerTeam].members.forEach(member => {
    chargeMember(member, amount);
    chargeMember(member.assist, amount);
  });

  const otherLeader = getLeaderIndex(otherTeam);

  chargeMember(
    state.teams[otherTeam].members[otherLeader],
    amount
  );

  chargeMember(
    state.teams[otherTeam].members[otherLeader].assist,
    amount
  );
}

function chargeTeam(teamIndex, amount) {
  const team = state.teams[teamIndex];
  team.members.forEach((member) => {
    chargeMember(member, amount);
  });
}

function chargeTeamWithoutLeader(teamIndex, amount) {
  const team = state.teams[teamIndex];
  team.members.forEach((member, memberIndex) => {
    if (!isLeaderSlot(teamIndex, memberIndex)) {
      chargeMember(member, amount);
    }
  });
}

function chargeLeaders(amount) {
  state.teams.forEach((team, teamIndex) => {
    chargeMember(team.members[getLeaderIndex(teamIndex)], amount);
  });
}

function chargeForTurn(teamIndex, amount) {
  chargeTeamWithoutLeader(teamIndex, amount);
  chargeLeaders(amount);
}

function applyHaste(sourceTeamIndex, amount) {
  chargeTeamWithoutLeader(sourceTeamIndex, amount);
  chargeLeaders(amount);
}

function addToTeam(teamIndex, amount) {
  const team = state.teams[teamIndex];
  team.members.forEach((member) => {
    let remaining = amount;
    const assistMaxCd = getSkillMaxCd(member.assist);
    if (member.assist.currentCd < assistMaxCd) {
      const room = assistMaxCd - member.assist.currentCd;
      const used = Math.min(room, remaining);
      member.assist.currentCd += used;
      remaining -= used;
    }
    if (remaining > 0) {
      member.currentCd = Math.min(getSkillMaxCd(member), member.currentCd + remaining);
    }
  });
}

function addLog(message) {
  state.log.push(message);
  state.log = state.log.slice(0, 60);
}

function advanceTurnCore() {
  console.log("advanceTurnCore 実行");
  if (state.activePlayer === 0) {
    state.aTurnCount++;
  } else {
    state.bTurnCount++;
  }
  state.activePlayer = (state.activePlayer + 1) % 2;
  state.actionCount += 1;
  state.enemyTurns = Math.max(0, state.enemyTurns - 1);
}

function advanceTurn() {
  pushHistory();

  chargeForTurn(state.activePlayer, 1);

  advanceTurnCore();

  render();
}

function breakthroughTurn() {
  pushHistory();

  chargeForTurn(state.activePlayer, 1);

  state.floorCount += 1;
  addLog(`----- ${state.floorCount}F -----`);

  const action =
    state.floorActions[state.floorCount];

  if (action) {

    if (action.type === "haste") {
      addLog(`先制: ${action.value}ヘイスト`);
      applyPreemptiveHaste(action.value);
    }

    if (action.type === "delay") {
      addLog(`先制: スキル遅延 ${action.value}`);
      applyPreemptiveDelay(action.value);
    }

  }

  advanceTurnCore();
  render();
}

function passTurn() {
  pushHistory();
  state.activePlayer = (state.activePlayer + 1) % 2;
  addLog(`${state.teams[state.activePlayer].name} パス`);
  render();
}

function useSkill(teamIndex, memberIndex, skillType = "member") {
  const team = state.teams[teamIndex];
  const member = team.members[memberIndex];
  const skill = getSkillData(member, skillType);
  const canUseMember = skillType === "member" && isMemberSkillReady(member);
  const canUseAssist = skillType === "assist" && isAssistReady(member);
  if (!canUseMember && !canUseAssist) return;

  pushHistory();
  const usedName = skillType === "assist" 
  ? getSkillName(skill) 
  : getDisplayMemberName(teamIndex, memberIndex, member);
  let logName = usedName;

  if (
    skillType !== "assist" &&
    skill.phases &&
    skill.phases.length > 1
  ) {
  const phaseMarks = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

  logName =
    `${member.name}${phaseMarks[skill.phaseIndex] ?? `(${skill.phaseIndex + 1})`}`;
  }
  const usedHaste = getSkillHaste(skill);
  if (skillType === "assist") {
    advanceSkillPhase(member);
    advanceSkillPhase(member.assist);
  } else {
    advanceSkillPhase(member);
  }
  if (usedHaste !== 0) {
    applyHaste(teamIndex, usedHaste);
  }
  let effectText = "";

  if (usedHaste > 0) {
    effectText = ` ${usedHaste}ヘイスト`;
  } else if (usedHaste < 0) {
    effectText = ` ${Math.abs(usedHaste)}遅延`;
  }

  addLog(
    `${team.name} ${logName}${effectText}`
  );
  render();
}

function applyTeamBoosts(teamIndex) {
  const team = state.teams[teamIndex];

  team.members.forEach((member) => {
    resetMemberCd(member,team.boosts);
  });
}

function applyBoosts(teamIndex) {
  const sharedBoosts = state.teams[teamIndex].boosts;
  state.teams.forEach((team, index) => {
    team.boosts = sharedBoosts;
    applyTeamBoosts(index);
  });
}

function setSharedBoosts(boosts) {
  state.teams.forEach((team) => {
    team.boosts = boosts;
  });
}

function readSharedBoostInput() {
  const input = document.querySelector("#sharedBoosts");
  return input ? clampNumber(input.value, 0, 60) : state.teams[0]?.boosts ?? 0;
}

function createSharedBoostControl() {
  const wrapper = document.createElement("label");
  wrapper.className = "shared-boost-control";
  wrapper.textContent = "スキブ数";

  const input = document.createElement("input");
  input.id = "sharedBoosts";
  input.className = "skill-boosts";
  input.type = "number";
  input.min = "0";
  input.max = "999";
  input.value = state.teams[0]?.boosts ?? 0;
  input.disabled = state.isBattleStarted;
  input.addEventListener("change", () => {
   pushHistory();

   const newBoost =
     clampNumber(input.value, 0, 60);

   setSharedBoosts(newBoost);

   applyBoosts(0);

   render();
  });


  wrapper.append(input);
  return wrapper;
}

function findNextReady() {
  const ready = [];
  state.teams.forEach((team, teamIndex) => {
    getVisibleMemberIndices(teamIndex).forEach((memberIndex) => {
      const member = team.members[memberIndex];
      const displayName = getDisplayMemberName(teamIndex, memberIndex, member);
      if (isAssistReady(member)) {
        ready.push(`${team.name} ${getSkillName(member.assist)}`);
      } else if (isMemberSkillReady(member)) {
        ready.push(`${team.name} ${displayName}`);
      }
    });
  });
  if (ready.length > 0) return ready[0];

  let best = null;
  state.teams.forEach((team, teamIndex) => {
    getVisibleMemberIndices(teamIndex).forEach((memberIndex) => {
      const member = team.members[memberIndex];
      const displayName = getDisplayMemberName(teamIndex, memberIndex, member);
      const remaining = isMemberSkillReady(member) ? 0 : Math.min(member.currentCd, getAssistRemaining(member));
      const nextName = member.currentCd > 0 ? displayName : getSkillName(member.assist);
      if (!best || remaining < best.cd) {
        best = { name: `${team.name} ${nextName}`, cd: remaining };
      }
    });
  });
  return best ? `${best.name} あと${best.cd}` : "-";
}

function getInitial(name) {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}

function getCooldownPercent(member) {
  const maxCd = getSkillMaxCd(member);
  if (maxCd <= 0) return 100;
  const charged = maxCd - member.currentCd;
  return Math.max(0, Math.min(100, Math.round((charged / maxCd) * 100)));
}

function populatePhaseOptions(skill) {
  elements.editPhaseIndex.textContent = "";
  skill.phases.forEach((_, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `スキル${index + 1}`;
    elements.editPhaseIndex.append(option);
  });
  elements.editPhaseIndex.value = String(skill.phaseIndex ?? 0);
}

function loadPhaseIntoEditor(skill, phaseIndex) {
  const phase = skill.phases[phaseIndex];
  elements.editName.value = phase.name;
  elements.editMaxCd.value = phase.maxCd;
  elements.editHaste.value = phase.haste;
}

function openFloorEditor() {
  elements.floorEditTarget.value =
    state.floorCount;

  elements.floorDialog.showModal();
}

function closeFloorEditor() {
  elements.floorDialog.close();
}

function saveCurrentFloorAction() {
  const floor =
    Number(elements.floorEditTarget.value);

  const type =
    elements.floorActionType.value;

  const value =
    Number(elements.floorActionValue.value);

  state.floorActions[floor] = {
    type,
    value
  };
  render();
}

function saveFloorAction(){
  console.log("saveFloorAction開始")

  saveCurrentFloorAction();
  console.log("保存完了");

  closeFloorEditor();
}

function saveAndNextFloor() {
  console.log("saveAndNextFloor開始");
  saveCurrentFloorAction();
  console.log("保存完了");

  const nextFloor =
    Number(elements.floorEditTarget.value) + 1;

  elements.floorEditTarget.value =nextFloor;

  elements.floorDialogTitle.textContent =
    `${nextFloor}F 先制行動`;

  console.log("次階層へ移動");
}

function openMemberEditor(teamIndex, memberIndex, skillType = "member") {
  const team = state.teams[teamIndex];
  const member = team.members[memberIndex];
  const skill = getSkillData(member, skillType);
  normalizeSkill(skill, skill.name || "スキル");
  const visibleSlot = getVisibleMemberIndices(teamIndex).indexOf(memberIndex) + 1;
  editTarget.teamIndex = teamIndex;
  editTarget.memberIndex = memberIndex;
  editTarget.skillType = skillType;
  elements.dialogSlot.textContent = `${team.name} / ${skillType === "assist" ? "アシスト" : "キャラ"}枠${visibleSlot}`;
  if (skillType === "assist") {
    skill.mode = "normal";
    resizeSkillPhases(skill, 1);
    elements.skillModePanel.hidden = true;
  } else {
    elements.skillModePanel.hidden = false;
  }
  elements.editSkillMode.value = skill.mode;
  elements.editPhaseCount.value = skill.phases.length;
  populatePhaseOptions(skill);
  loadPhaseIntoEditor(skill, skill.phaseIndex ?? 0);
  elements.editDelayLatent.value = skill.delayLatent ?? 0;
  elements.editDelayAwakening.value = skill.delayAwakening ?? 0;
  if (skillType === "assist") {
    elements.delayLatentPanel.hidden = true;
    elements.editDelayLatent.disabled = true;
    elements.editDelayLatent.value = 0;
  } else {
    elements.delayLatentPanel.hidden = false;
    elements.editDelayLatent.disabled = false;
  }
  if (typeof elements.memberDialog.showModal === "function") {
    elements.memberDialog.showModal();
  } else {
    elements.memberDialog.setAttribute("open", "");
  }


  elements.editName.focus();
  elements.editName.select();
}

function closeMemberEditor() {
  if (typeof elements.memberDialog.close === "function") {
    elements.memberDialog.close();
  } else {
    elements.memberDialog.removeAttribute("open");
  }
}

elements.returnSetup.addEventListener("click", () => {

  if (!state.setupSnapshot) {
    return;
  }

  const ok = confirm(
    "戦闘開始前の状態に戻りますか？"
  );

  if (!ok) {
    return;
  }

  pushHistory();

  state.teams = deepClone(
    state.setupSnapshot
  );

  state.isBattleStarted = false;

  render();
});

function updateFromInputs() {
  state.enemyTurns = clampNumber(elements.enemyTurns.value);

  document.querySelectorAll(".team-card").forEach((teamCard, teamIndex) => {
    const team = state.teams[teamIndex];
    team.name = teamCard.querySelector(".team-name").value.trim() || `マルチ${teamLabels[teamIndex]}`;
    const boostInput = teamCard.querySelector(".skill-boosts");
    if (boostInput) {
      team.boosts = clampNumber(boostInput.value, 0, 60);
    }
    teamCard.querySelectorAll(".member-row").forEach((row) => {
      const memberIndex = Number(row.dataset.memberIndex);
      const member = team.members[memberIndex];
      const skillType = row.dataset.skillType || "member";
      const skill = getSkillData(member, skillType);
      normalizeSkill(skill, skill.name || `枠${memberIndex + 1}`);
      const activePhase = getActivePhase(skill);
      activePhase.name = row.querySelector(".member-name").value.trim() || `枠${memberIndex + 1}`;
      activePhase.maxCd = clampNumber(row.querySelector(".max-cd").value);
      activePhase.haste = clampNumber(row.querySelector(".haste-cd").value);
      skill.currentCd = clampNumber(row.querySelector(".current-cd").value, 0, activePhase.maxCd);
      skill.name = activePhase.name;
      skill.maxCd = activePhase.maxCd;
      skill.haste = activePhase.haste;
    });
  });
  if (state.teams.length >= 2) {
    setSharedBoosts(readSharedBoostInput());
  }
}

function createSkillRow(memberTemplate, teamIndex, memberIndex, visibleIndex, skillType) {
  const member = state.teams[teamIndex].members[memberIndex];
  const isAssist = skillType === "assist";
  const skill = getSkillData(member, skillType);
  normalizeSkill(skill, skill.name || "スキル");
  const skillName = getSkillName(skill);
  const skillMaxCd = getSkillMaxCd(skill);
  const displayName = isAssist ? skillName : getDisplayMemberName(teamIndex, memberIndex, member);
  const row = memberTemplate.content.firstElementChild.cloneNode(true);
  const ready = isAssist ? isAssistReady(member) : isMemberSkillReady(member);
  const blocked = !isAssist && isAssistReady(member);
  const turnText = isAssist
    ? (ready ? "使用可能":`あと${getAssistRemaining(member)}ターン`)
    : (ready ? "使用可能" : `あと${skill.currentCd}ターン`);
  const editButton = row.querySelector(".edit-member");  
  row.dataset.memberIndex = String(memberIndex);
  row.dataset.skillType = skillType;
  row.classList.toggle("assist-row", isAssist);
  row.classList.toggle("ready", ready);
  row.classList.toggle("blocked", blocked);
  row.style.setProperty("--charge", `${isAssist ? getAssistPercent(member) : getCooldownPercent(member)}%`);
  row.style.setProperty("--slot-hue", `${(teamIndex * 72 + memberIndex * 31 + (isAssist ? 18 : 0)) % 360}`);
  row.querySelector(".slot-number").textContent = visibleIndex + 1;
  row.querySelector(".character-initial").textContent = getInitial(displayName);
  row.querySelector(".character-name").textContent = displayName;
  row.querySelector(".turn-text").textContent = turnText;
  row.querySelector(".member-name").value = skillName;
  row.querySelector(".max-cd").value = skillMaxCd;
  row.querySelector(".current-cd").value = skill.currentCd;
  row.querySelector(".haste-cd").value = getSkillHaste(skill);
  row.querySelector(".edit-member").addEventListener("click", () => openMemberEditor(teamIndex, memberIndex, skillType));
  editButton.disabled = state.isBattleStarted;
  editButton.addEventListener("click",()=>openMemberEditor(teamIndex,memberIndex,skillType));
  const useButton = row.querySelector(".use-skill");
  useButton.disabled = !ready;
  useButton.textContent = ready ? (isAssist ? "継承" : "使用") : blocked ? "継承中" : "待機中";
  useButton.addEventListener("click", () => useSkill(teamIndex, memberIndex, skillType));
  return row;
}

function renderTeams() {
  const teamTemplate = document.querySelector("#teamTemplate");
  const memberTemplate = document.querySelector("#memberTemplate");
  elements.teams.textContent = "";

  state.teams.forEach((team, teamIndex) => {
    const teamNode = teamTemplate.content.firstElementChild.cloneNode(true);
    teamNode.classList.toggle("active", teamIndex === state.activePlayer);
    teamNode.querySelector(".team-name").value = team.name;

    const memberList = teamNode.querySelector(".member-list");
    const assistList = document.createElement("div");
    assistList.className = "assist-list";
    if (teamIndex === 1) {
      [assistList, memberList].forEach((list) => {
        const spacer = document.createElement("div");
        spacer.className = "member-spacer";
        spacer.setAttribute("aria-hidden", "true");
        list.append(spacer);
      });
    }
    getVisibleMemberIndices(teamIndex).forEach((memberIndex, visibleIndex) => {
      assistList.append(createSkillRow(memberTemplate, teamIndex, memberIndex, visibleIndex, "assist"));
      memberList.append(createSkillRow(memberTemplate, teamIndex, memberIndex, visibleIndex, "member"));
    });
    if (teamIndex === 1) {
      assistList.style.gridRow = "2";
      memberList.style.gridRow = "1";
    }
    teamNode.insertBefore(assistList, memberList);

    teamNode.querySelector(".team-name").addEventListener("change", () => {
      pushHistory();
      updateFromInputs();
      render();
    });

    elements.teams.append(teamNode);
  });
}

function renderLog() {
  elements.logList.textContent = "";
  if (state.log.length === 0) {
    const item = document.createElement("li");
    item.textContent = "-----1F-----";
    elements.logList.append(item);
    return;
  }
  state.log.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    elements.logList.append(item);
  });
}

function renderFloorActions() {

  elements.floorActionList.textContent = "";

  const floors =
    Object.keys(state.floorActions)
      .map(Number)
      .sort((a,b) => a - b);

  if (floors.length === 0) {

    const div =
      document.createElement("div");

    div.textContent =
      "先制は登録されていません";

    elements.floorActionList.append(div);

    return;
  }

  floors.forEach((floor) => {

    const action = state.floorActions[floor];
    console.log(floor,action);

    const row =
      document.createElement("div");

    row.className =
      "floor-action-row";

    row.innerHTML = `
      <span>
        ${floor}F :
        ${
          action.type === "delay"
            ? `遅延 ${action.value}`
            : `ヘイスト ${action.value}`
        }
      </span>

      <button
        class="delete-floor-action"
        data-floor="${floor}"
      >
        削除
      </button>
    `;

    row
      .querySelector(".delete-floor-action")
      .addEventListener(
        "click",
        () => {

          pushHistory();

          delete state.floorActions[floor];

          render();
        }
      );

    elements.floorActionList.append(row);
  });
}

function copyLog(){
  const logs = state.log.slice().reverse();
  let text = "";
  logs.forEach((entry) =>{

    if(entry.includes("階層")){
      text += "\n" + entry + "\n\n";
    } else {
      text += entry + "\n";
    }
  });

  navigator.clipboard.writeText(text)
   .then(() => {
    renderLog();
  })
   .catch(() => {
    alert("履歴のコピーに失敗しました");
  });
}

function render() {
  ensureTeams();
  elements.enemyTurns.value = state.enemyTurns;
  elements.activePlayerName.textContent = state.teams[state.activePlayer].name;
  elements.actionCount.textContent = state.actionCount;
  elements.floorCount.textContent = state.floorCount;
  elements.abTurnCount.textContent =
  `A ${state.aTurnCount} / B ${state.bTurnCount}`;
  renderTeams();
  elements.startBattle.hidden =
  state.isBattleStarted;

  elements.returnSetup.hidden =
  !state.isBattleStarted;
  renderLog();
  renderFloorActions();
}

function savePreset() {
  updateFromInputs();
  localStorage.setItem(STORAGE_KEY, snapshot());
  render();
}

function loadPreset() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    renderLog();
    return;
  }
  restore(saved);
  render();
}

function resetAll() {
  pushHistory();
  state.activePlayer = 0;
  state.actionCount = 0;
  state.floorCount = 1;
  state.aTurnCount = 0;
  state.bTurnCount = 0;
  state.enemyTurns = 3;
  state.floorActions = {};
  state.teams = [makeDefaultTeam(0), makeDefaultTeam(1)];
  state.log = ["-----1F-----"];
  render();
}

document.querySelector("#advanceTurn").addEventListener("click", advanceTurn);
document.querySelector("#passTurn").addEventListener("click", passTurn);
document.querySelector("#breakthroughTurn").addEventListener("click", breakthroughTurn);
document.querySelector("#undoTurn").addEventListener("click", () => {
  const previous = state.history.pop();
  if (previous) {
    restore(previous);
    render();
  }
});
document.querySelector("#savePreset").addEventListener("click", savePreset);
document.querySelector("#loadPreset").addEventListener("click", loadPreset);
document.querySelector("#resetAll").addEventListener("click", resetAll);
document.querySelector("#copyLog").addEventListener("click", copyLog);
document.querySelector("#clearLog").addEventListener("click", () => {
  pushHistory();
  state.log = [];
  renderLog();
});
document.querySelector("#addFloorAction")
const addFloorButton =
  document.querySelector("#addFloorAction");

if (addFloorButton) {
  addFloorButton.addEventListener("click", () => {

    const floor =
      Number(document.querySelector("#floorInput").value);

    const type =
      document.querySelector("#actionType").value;

    const value =
      Number(document.querySelector("#actionValue").value);

    if (!state.floorActions[floor]) {
      state.floorActions[floor] = [];
    }

    state.floorActions[floor] = {
      type: actionType,
      value: actionValue
    };
  });
}

elements.dialogCancel.addEventListener("click", closeMemberEditor);
elements.floorButton.addEventListener("click",openFloorEditor);
elements.saveFloorAction.addEventListener("click",saveFloorAction);
elements.floorDialogCancel.addEventListener("click",closeFloorEditor);
elements.memberDialog.addEventListener("click", (event) => {
  if (event.target === elements.memberDialog) {
    closeMemberEditor();
  }
});
elements.memberEditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (editTarget.teamIndex === null || editTarget.memberIndex === null) return;

  pushHistory();
  const member = state.teams[editTarget.teamIndex].members[editTarget.memberIndex];
  const skill = getSkillData(member, editTarget.skillType);
  normalizeSkill(skill, skill.name || `枠${editTarget.memberIndex + 1}`);
  skill.mode = editTarget.skillType === "assist" ? "normal" : elements.editSkillMode.value;
  resizeSkillPhases(skill, editTarget.skillType === "assist" ? 1 : elements.editPhaseCount.value);
  const phaseIndex = clampNumber(elements.editPhaseIndex.value, 0, skill.phases.length - 1);
  const phase = skill.phases[phaseIndex];
  phase.name = elements.editName.value.trim() || `スキル${phaseIndex + 1}`;
  phase.maxCd = clampNumber(elements.editMaxCd.value, 1, 99);
  phase.haste = clampNumber(elements.editHaste.value, -99, 99);

  skill.phaseIndex = phaseIndex;
  skill.currentCd = Math.min(
    skill.currentCd,
    phase.maxCd
  );
  skill.name = phase.name;
  skill.maxCd = phase.maxCd;
  skill.haste = phase.haste;

  skill.delayLatent = clampNumber(elements.editDelayLatent.value, 0, 8);
  skill.delayAwakening = clampNumber(elements.editDelayAwakening.value, 0, 99);
  closeMemberEditor();

  render();
});
elements.saveFloorAction.addEventListener("click",saveFloorAction);
elements.saveAndNextFloor.addEventListener("click",saveAndNextFloor);
elements.editSkillMode.addEventListener("change", () => {
  if (elements.editSkillMode.value === "normal") {
    elements.editPhaseCount.value = 1;
  } else if (Number(elements.editPhaseCount.value) < 2) {
    elements.editPhaseCount.value = 2;
  }
});

elements.editPhaseCount.addEventListener("change", () => {
  if (editTarget.teamIndex === null || editTarget.memberIndex === null) return;
  const member = state.teams[editTarget.teamIndex].members[editTarget.memberIndex];
  const skill = getSkillData(member, editTarget.skillType);
  resizeSkillPhases(skill, elements.editPhaseCount.value);
  populatePhaseOptions(skill);
  loadPhaseIntoEditor(skill, skill.phaseIndex ?? 0);
});

elements.editPhaseIndex.addEventListener("change", () => {
  if (editTarget.teamIndex === null || editTarget.memberIndex === null) return;
  const member = state.teams[editTarget.teamIndex].members[editTarget.memberIndex];
  const skill = getSkillData(member, editTarget.skillType);
  normalizeSkill(skill, skill.name || "スキル");
  loadPhaseIntoEditor(skill, clampNumber(elements.editPhaseIndex.value, 0, skill.phases.length - 1));
});

[elements.enemyTurns].forEach((element) => {
  element.addEventListener("change", () => {
    pushHistory();
    updateFromInputs();
    render();
  });
});

elements.startBattle.addEventListener(
  "click",
  () => {

    const warnings =
      getUnconfiguredMembers();

    if (warnings.length) {

      const ok = confirm(
        "未設定キャラがあります\n\n" +
        warnings.join("\n") +
        "\n\n開始しますか？"
      );

      if (!ok) {
        return;
      }
    }

   resetAllSkillsToFirstPhase();

   state.setupSnapshot = deepClone(state.teams);

   applyBoosts(0);

   state.isBattleStarted = true;

   const action = state.floorActions[1];

    if (action) {
      if (action.type === "haste") {
        addLog(`1F先制: ${action.value}ヘイスト`);
        applyPreemptiveHaste(action.value);
      }

      if (action.type === "delay") {
        addLog(`1F先制: ${action.value}ターン遅延`);
        applyPreemptiveDelay(action.value);
      }
    }

    render();

    alert("戦闘開始");
  }
);
const sharedBoostContainer =
  document.querySelector("#sharedBoostContainer");

if (sharedBoostContainer) {
  sharedBoostContainer.append(
    createSharedBoostControl()
  );
}

resetAll();
