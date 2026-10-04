//自分でいじったver
const STORAGE_KEY = "pad-multi-skill-sim";
const TEAM_PRESET_KEY = "pad-team-presets";
const PRESET_SLOT_COUNT = 5;
const teamLabels = ["A", "B"];

let mobileTeamIndex = 0;

const state = {
  activePlayer: 0,
  actionCount: 0,
  aTurnCount: 0,
  bTurnCount: 0,
  floorCount: 1,
  floorActions:{},
  superResolveUses:{},
  teams: [],
  leaderIndices:[0,5],
  log: [],
  history: [],
  isBattleStarted: false,
  setupSnapshot: null,
};


const elements = {
  teams: document.querySelector("#teams"),
  activePlayerName: document.querySelector("#activePlayerName"),
  returnSetup:document.getElementById("returnSetup"),
  saveTeamPreset: document.getElementById("saveTeamPreset"),
  teamPresetDialog: document.getElementById("teamPresetDialog"),
  teamPresetDialogClose: document.getElementById("teamPresetDialogClose"),
  teamPresetList: document.getElementById("teamPresetList"),
  resetDialog: document.getElementById("resetDialog"),
  resetForm: document.getElementById("resetForm"),
  resetDialogClose: document.getElementById("resetDialogClose"),
  resetTeams: document.getElementById("resetTeams"),
  resetProgress: document.getElementById("resetProgress"),
  resetLog: document.getElementById("resetLog"),
  resetFloorActions: document.getElementById("resetFloorActions"),
  resetSavedTeams: document.getElementById("resetSavedTeams"),
  actionCount: document.querySelector("#actionCount"),
  floorCount: document.querySelector("#floorCount"),
  floorButton: document.querySelector("#floorButton"),
  floorDialog: document.querySelector("#floorDialog"),
  floorDialogTitle: document.querySelector("#floorDialogTitle"),
  floorDialogCancel: document.querySelector("#floorDialogCancel"),
  floorActionType: document.querySelector("#floorActionType"),
  floorActionTarget: document.querySelector("#floorActionTarget"),
  floorActionValue: document.querySelector("#floorActionValue"),
  floorSuperResolve: document.querySelector("#floorSuperResolve"),
  floorSuperResolveCount: document.querySelector("#floorSuperResolveCount"),
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
  editSkillName: document.querySelector("#editSkillName"),
  skillModePanel: document.querySelector("#skillModePanel"),
  editSkillMode: document.querySelector("#editSkillMode"),
  editPhaseCount: document.querySelector("#editPhaseCount"),
  editPhaseIndex: document.querySelector("#editPhaseIndex"),
  editMaxCd: document.querySelector("#editMaxCd"),
  editHaste: document.querySelector("#editHaste"),
  editSkillEffect:document.querySelector("#editSkillEffect"),
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
  const names =
    index === 0
      ? ["Aリーダー", "Aサブ1", "Aサブ2", "Aサブ3", "Aサブ4", "助っ人"]
      : ["助っ人","Bサブ1", "Bサブ2", "Bサブ3", "Bサブ4", "Bリーダー"];

  return {
    name: `マルチ${teamLabels[index]}`,
    boosts: 12,
    members: names.map((name, memberIndex) => ({
      name,
      characterName: name,
      maxCd: memberIndex === 0 ? 20 : 12 + memberIndex,
      currentCd: Math.max(
        0,
        (memberIndex === 0 ? 20 : 12 + memberIndex) - 12
      ),
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
    leaderIndices: state.leaderIndices,
    log: state.log,
    floorActions: state.floorActions,
    superResolveUses: state.superResolveUses,
    isBattleStarted: state.isBattleStarted,
    setupSnapshot: state.setupSnapshot
  });
}

function createTeamPresetData() {
  return {
    teams: structuredClone(state.teams),
    leaderIndices: structuredClone(state.leaderIndices)
  };
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
  state.leaderIndices = data.leaderIndices ?? [0, 5];
  state.log = data.log ?? [];
  state.floorActions = data.floorActions ?? {};
  state.superResolveUses = data.superResolveUses ?? {};
  state.isBattleStarted = data.isBattleStarted ?? false;
  state.setupSnapshot = data.setupSnapshot ?? null;
  state.history = [];
  ensureTeams();
}

function autoSaveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      snapshot()
    );
  } catch (error) {
    console.error(
      "自動保存に失敗しました",
      error
    );
  }
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

      if (!member.assist) {
       member.assist = makeDefaultAssist(memberIndex);
     }

      if (!member.characterName) {
        member.characterName =
          member.phases?.[0]?.name ||
          member.name ||
          `枠${memberIndex + 1}`;
      }

      normalizeSkill(member, member.name || `枠${memberIndex + 1}`);

      normalizeSkill(member, member.characterName || `枠${memberIndex + 1}`);
      normalizeSkill(
        member.assist,
        member.assist.name || `アシスト${memberIndex + 1}`
      );
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
    haste: clampNumber(skill.haste ?? 0),
    effect:skill.effect||"none"
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
    haste: clampNumber(phase.haste),
    effect:phase.effect||"none"
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
      haste: previous.haste,
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
  return state.leaderIndices[teamIndex]??(teamIndex === 0 ? 0 : 5);
}

function changeLeader(teamIndex, targetIndex) {
  const team = state.teams[teamIndex];

  const oldLeaderIndex = getLeaderIndex(teamIndex);

  if (oldLeaderIndex === targetIndex) {
    return false;
  }

  const oldLeader = team.members[oldLeaderIndex];
  const targetMember = team.members[targetIndex];

  team.members[oldLeaderIndex] = targetMember;
  team.members[targetIndex] = oldLeader;

  state.leaderIndices[teamIndex] = targetIndex;

  return true;
}

function selectLeaderChangeTarget(teamIndex) {
  const team = state.teams[teamIndex];

  const leaderIndex = getLeaderIndex(teamIndex);

  const visibleIndices = getVisibleMemberIndices(teamIndex)
    .filter(index => index !== leaderIndex);

  const choices = visibleIndices.map((index, i) => {
    const member = team.members[index];

    return `${i + 1}: ${getDisplayMemberName(teamIndex, index, member)}`;
  }).join("\n");

  const answer = prompt(
    `リダチェンするキャラを選択してください\n\n${choices}\n\n番号を入力してください`
  );

  if (answer === null) {
    return null;
  }

  // 全角数字を半角数字に変換
  const normalizedAnswer = answer.replace(/[０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });

  const selectedNumber = Number(normalizedAnswer);

  if (
    Number.isNaN(selectedNumber) ||
    selectedNumber < 1 ||
    selectedNumber > visibleIndices.length
  ) {
    alert("正しい番号を入力してください。");
    return null;
  }

  const targetIndex = visibleIndices[selectedNumber - 1];

  return targetIndex;
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

function getSkillEffect(skill) {
  const phase = getActivePhase(skill);

  return phase?.effect ?? "none";
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
  // A編成のリーダー
  if (teamIndex === 0 && isLeaderSlot(teamIndex, memberIndex)) {
    return "Aリーダー";
  }

  // B編成のリーダー
  if (teamIndex === 1 && isLeaderSlot(teamIndex, memberIndex)) {
    return "Bリーダー";
  }

  // それ以外は設定したキャラ名を表示
  return member.characterName || getSkillName(member);
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

function applyPreemptiveDelay(amount, target = "breaker") {
  const breakerTeam = (state.activePlayer + 1) % 2;
  const otherTeam = (breakerTeam + 1) % 2;

  // 両チーム全員
  if (target === "all") {
    state.teams.forEach(team => {
      team.members.forEach(member => {
        delayMember(member, amount);
        delayAssist(member.assist, amount);
      });
    });

    return;
  }

  // 突破側の全員
  if (target === "breaker") {
    state.teams[breakerTeam].members.forEach(member => {
      delayMember(member, amount);
      delayAssist(member.assist, amount);
    });

    return;
  }

  // 突破側のリーダー
  if (target === "breakerLeader") {
    const leaderIndex = getLeaderIndex(breakerTeam);
    const leader = state.teams[breakerTeam].members[leaderIndex];

    delayMember(leader, amount);
    delayAssist(leader.assist, amount);

    return;
  }

  // もう一方のリーダー
  if (target === "otherLeader") {
    const leaderIndex = getLeaderIndex(otherTeam);
    const leader = state.teams[otherTeam].members[leaderIndex];

    delayMember(leader, amount);
    delayAssist(leader.assist, amount);
  }
}

function getTotalDelayResist(member) {
  return (
    (member.delayLatent ?? 0)
    + (member.delayAwakening ?? 0) * 2
    + (member.assist.delayAwakening ?? 0) * 2
  );
}



function applyPreemptiveHaste(amount, target = "breaker") {
  const breakerTeam = (state.activePlayer + 1) % 2;
  const otherTeam = (breakerTeam + 1) % 2;

  // 両チーム全員
  if (target === "all") {
    state.teams.forEach(team => {
      team.members.forEach(member => {
        chargeMember(member, amount);
      });
    });

    return;
  }

  // 突破側の全員
  if (target === "breaker") {
    state.teams[breakerTeam].members.forEach(member => {
      chargeMember(member, amount);
    });

    return;
  }

  // 突破側のリーダー
  if (target === "breakerLeader") {
    const leaderIndex = getLeaderIndex(breakerTeam);
    const leader = state.teams[breakerTeam].members[leaderIndex];

    chargeMember(leader, amount);

    return;
  }

  // もう一方のリーダー
  if (target === "otherLeader") {
    const leaderIndex = getLeaderIndex(otherTeam);
    const leader = state.teams[otherTeam].members[leaderIndex];

    chargeMember(leader, amount);
  }
}

function getSuperResolveCount(action) {
  if (!action?.superResolve) return 0;
  return clampNumber(action.superResolveCount ?? 1, 1, 9);
}

function hasRemainingSuperResolve(floor, action) {
  const total = getSuperResolveCount(action);
  const used = state.superResolveUses[floor] ?? 0;
  return total > used;
}

function useSuperResolve(floor, action) {
  const total = getSuperResolveCount(action);
  const used = (state.superResolveUses[floor] ?? 0) + 1;
  state.superResolveUses[floor] = used;
  addLog(`${floor}F 超根性発動 ${used}/${total}`);
}

function applyFloorAction(floor, action, prefix = "先制") {
  if (!action) return;

  if (action.superResolve) {
    addLog(`${floor}F 超根性 ${getSuperResolveCount(action)}回`);
  }

  if (action.type === "haste") {
    addLog(`${prefix}: ${action.value}ヘイスト`);

    applyPreemptiveHaste(
      action.value,
      action.target ?? "breaker"
    );
  }

  if (action.type === "delay") {
    addLog(`${prefix}: スキル遅延 ${action.value}`);

    applyPreemptiveDelay(
      action.value,
      action.target ?? "breaker"
    );
  }
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

  // 現在のプレイヤーのスキルを1ターン進める
  chargeForTurn(state.activePlayer, 1);

  // プレイヤー交代
  advanceTurnCore();

  // 次の階層へ
  state.floorCount += 1;

  console.log(
    "突破",
    state.floorCount
  );

  // 階層変更
  addLog(
    `----- ${state.floorCount}F -----`
  );

  // 次の階層の先制を取得
  const action =
    state.floorActions[state.floorCount];

  console.log(
    "先制行動",
    action
  );

  // 登録されていれば先制を実行
  if (action) {

    applyFloorAction(
      state.floorCount,
      action,
      `${state.floorCount}F先制`
    );

  }

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

  const canUseMember =
    skillType === "member" && isMemberSkillReady(member);

  const canUseAssist =
    skillType === "assist" && isAssistReady(member);

  if (!canUseMember && !canUseAssist) {
    return;
  }

  // スキル効果を取得
  const skillEffect = getSkillEffect(skill);

  // リダチェンの場合は、先に交換先を選択する
  let leaderChangeTarget = null;

  if (skillEffect === "leaderChange") {
    leaderChangeTarget = selectLeaderChangeTarget(teamIndex);

    // キャンセルされた場合はスキルを使わない
    if (leaderChangeTarget === null) {
      return;
    }
  }

  // ここから実際にスキルを使用
  pushHistory();

  const usedName =
    skillType === "assist"
      ? getSkillName(skill)
      : getDisplayMemberName(
          teamIndex,
          memberIndex,
          member
        );

  let logName = usedName;

  if (
    skillType !== "assist" &&
    skill.phases &&
    skill.phases.length > 1
  ) {
    const phaseMarks = [
      "①",
      "②",
      "③",
      "④",
      "⑤",
      "⑥",
      "⑦",
      "⑧",
      "⑨",
      "⑩"
    ];

    logName =
      `${member.name}${
        phaseMarks[skill.phaseIndex]
        ?? `(${skill.phaseIndex + 1})`
      }`;
  }

  const usedHaste = getSkillHaste(skill);

  // スキルの段階を進める
  if (skillType === "assist") {
    advanceSkillPhase(member);
    advanceSkillPhase(member.assist);
  } else {
    advanceSkillPhase(member);
  }

  // ヘイスト・遅延
  if (usedHaste !== 0) {
    applyHaste(teamIndex, usedHaste);
  }

  // リダチェン
  if (
    skillEffect === "leaderChange" &&
    leaderChangeTarget !== null
  ) {
    changeLeader(teamIndex, leaderChangeTarget);
  }

  let effectText = "";

  if (usedHaste > 0) {
    effectText = ` ${usedHaste}ヘイスト`;
  } else if (usedHaste < 0) {
    effectText = ` ${Math.abs(usedHaste)}遅延`;
  }

  if (skillEffect === "leaderChange") {
    effectText += " リダチェン";
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

  if (editTarget.skillType === "member") {
    const member =
      state.teams[editTarget.teamIndex]
        .members[editTarget.memberIndex];

    elements.editName.value =
      member.characterName ||
      skill.phases?.[0]?.name ||
      skill.name ||
      "";
  } else {
    elements.editName.value = phase.name;
  }

  if (elements.editSkillName) {
    elements.editSkillName.value =
      phase.name || `スキル${phaseIndex + 1}`;
  }

  elements.editMaxCd.value = phase.maxCd;
  elements.editHaste.value = phase.haste;
  elements.editSkillEffect.value =
    phase.effect ?? "none";
}

function openFloorEditor(floor = null) {

  // floorが指定されていなければ現在の階層を使う
  const targetFloor =
    floor !== null && !Number.isNaN(Number(floor))
      ? Number(floor)
      : state.floorCount;

  editingFloor = targetFloor;

  elements.floorEditTarget.value = targetFloor;

  // その階層に登録されている先制を取得
  const action =
    state.floorActions[targetFloor];

  // 登録済みなら内容を表示
  elements.floorActionType.value =
    action?.type ?? "none";

  elements.floorActionValue.value =
    action?.value ?? 1;

  elements.floorSuperResolve.checked =
    !!action?.superResolve;

  elements.floorSuperResolveCount.value =
    getSuperResolveCount(action) || 1;

  elements.floorDialogTitle.textContent =
    `${targetFloor}F 先制行動`;

  elements.floorDialog.showModal();
}

function loadFloorActionToEditor(floor) {
  const targetFloor = Number(floor);

  if (!Number.isInteger(targetFloor) || targetFloor < 1) {
    return;
  }

  const action = state.floorActions[targetFloor];

  elements.floorActionType.value =
    action?.type ?? "none";

  elements.floorActionTarget.value =
    action?.target ?? "breaker";

  elements.floorActionValue.value =
    action?.value ?? 1;

  elements.floorSuperResolve.checked =
    !!action?.superResolve;

  elements.floorSuperResolveCount.value =
    getSuperResolveCount(action) || 1;

  elements.floorDialogTitle.textContent =
    `${targetFloor}F 先制行動`;
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
      target: elements.floorActionTarget.value,
      value,
      superResolve: elements.floorSuperResolve.checked,
      superResolveCount: clampNumber(
        elements.floorSuperResolveCount.value,
        1,
        9
      )
    }; 
  delete state.superResolveUses[floor];
  render();
}

function saveFloorAction(){
  console.log("saveFloorAction開始")

  saveCurrentFloorAction();
  console.log("保存完了");

  closeFloorEditor();
}

function saveAndNextFloor() {

  // 現在の階層を保存
  saveCurrentFloorAction();

  // 次の階層へ
  const nextFloor =
    Number(elements.floorEditTarget.value) + 1;

  editingFloor = nextFloor;

  elements.floorEditTarget.value =
    nextFloor;

  // 次の階層に登録済みの先制を読み込む
  const action =
    state.floorActions[nextFloor];

  elements.floorActionType.value =
    action?.type ?? "none";

  elements.floorActionValue.value =
    action?.value ?? 1;

  elements.floorSuperResolve.checked =
    !!action?.superResolve;

  elements.floorSuperResolveCount.value =
    getSuperResolveCount(action) || 1;

  elements.floorDialogTitle.textContent =
    `${nextFloor}F 先制行動`;

  render();
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
    state.setupSnapshot.teams
  );
  state.leaderIndices = deepClone(
    state.setupSnapshot.leaderIndices
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
    teamCard.querySelectorAll(".member-row:not(.mobile-skill-row)").forEach((row) => {
      const memberIndex = Number(row.dataset.memberIndex);
      const member = team.members[memberIndex];
      const skillType = row.dataset.skillType || "member";
      const skill = getSkillData(member, skillType);
      normalizeSkill(skill, skill.name || `枠${memberIndex + 1}`);
      const activePhase = getActivePhase(skill);

      const nameInput =
        row.querySelector(".member-name");

      if (skillType === "assist") {
        activePhase.name =
          nameInput.value.trim() ||
          `アシスト${memberIndex + 1}`;
      } else {
        member.characterName =
          nameInput.value.trim() ||
          member.characterName ||
          `枠${memberIndex + 1}`;
      }
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
  row.querySelector(".member-name").value =
    isAssist
    ? skillName
    : (member.characterName || getSkillName(member));
  row.querySelector(".max-cd").value = skillMaxCd;
  row.querySelector(".current-cd").value = skill.currentCd;
  row.querySelector(".haste-cd").value = getSkillHaste(skill);
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

  /*
   * ==========================
   * スマホ用表示
   * ==========================
   */

  const mobileContainer = document.createElement("div");
  mobileContainer.className = "mobile-team-container";

  // A編成 / B編成 切り替えボタン
  const mobileSwitch = document.createElement("div");
  mobileSwitch.className = "mobile-team-switch";

  state.teams.forEach((team, teamIndex) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "mobile-team-button";
    button.textContent = `${teamLabels[teamIndex]}編成`;

    button.classList.toggle(
      "active",
      teamIndex === mobileTeamIndex
    );

    button.addEventListener("click", () => {
      mobileTeamIndex = teamIndex;

      document
        .querySelectorAll(".mobile-team-button")
        .forEach((button, index) => {
          button.classList.toggle(
            "active",
            index === mobileTeamIndex
          );
        });

      document
        .querySelectorAll(".mobile-sub-list")
        .forEach((subList, index) => {
          subList.classList.toggle(
            "mobile-selected",
            index === mobileTeamIndex
          );
        });
    });

    mobileSwitch.append(button);
  });

  mobileContainer.append(mobileSwitch);


  // キャラ / アシストの見出し
  const mobileHeader = document.createElement("div");
  mobileHeader.className = "mobile-member-header";

  mobileHeader.innerHTML = `
    <span>キャラ</span>
    <span>アシスト</span>
  `;

  mobileContainer.append(mobileHeader);

  const mobileALeader = document.createElement("div");
  mobileALeader.className = "mobile-leader-block";

  const mobileALeaderRow = document.createElement("div");
  mobileALeaderRow.className = "mobile-member-pair";

  const aLeaderIndex = getLeaderIndex(0);

  const aLeaderMember = createSkillRow(
    memberTemplate,
    0,
    aLeaderIndex,
    0,
    "member"
  );

  const aLeaderAssist = createSkillRow(
    memberTemplate,
    0,
    aLeaderIndex,
    0,
    "assist"
  );

  mobileALeaderRow.append(
    aLeaderMember,
    aLeaderAssist
  );

  mobileALeader.append(mobileALeaderRow);
  mobileContainer.append(mobileALeader);


  /*
   * ==========================
   * A/Bサブ切り替え部分
   * ==========================
   */

  state.teams.forEach((team, teamIndex) => {
    const mobileSubList = document.createElement("div");

    mobileSubList.className = "mobile-sub-list";

    mobileSubList.classList.toggle(
      "mobile-selected",
      teamIndex === mobileTeamIndex
    );

    const subIndices = [1, 2, 3, 4];

    subIndices.forEach((memberIndex, subIndex) => {
      const mobileRow =
        document.createElement("div");

      mobileRow.className = "mobile-member-pair";

      const mobileMember = createSkillRow(
        memberTemplate,
        teamIndex,
        memberIndex,
        subIndex,
        "member"
      );

      const mobileAssist = createSkillRow(
        memberTemplate,
        teamIndex,
        memberIndex,
        subIndex,
        "assist"
      );

      mobileRow.append(
        mobileMember,
        mobileAssist
      );

      mobileSubList.append(mobileRow);
    });

    mobileContainer.append(mobileSubList);
  });

  const mobileBLeader = document.createElement("div");
  mobileBLeader.className = "mobile-leader-block";

  const mobileBLeaderRow = document.createElement("div");
  mobileBLeaderRow.className = "mobile-member-pair";

  const bLeaderIndex = getLeaderIndex(1);

  const bLeaderMember = createSkillRow(
    memberTemplate,
    1,
    bLeaderIndex,
    0,
    "member"
  );

  const bLeaderAssist = createSkillRow(
    memberTemplate,
    1,
    bLeaderIndex,
    0,
    "assist"
  );

  mobileBLeaderRow.append(
    bLeaderMember,
    bLeaderAssist
  );

  mobileBLeader.append(mobileBLeaderRow);
  mobileContainer.append(mobileBLeader);


  // スマホ用UIを先に追加
  elements.teams.append(mobileContainer);


  /*
   * ==========================
   * PC・タブレット用表示
   * ==========================
   */

  state.teams.forEach((team, teamIndex) => {
    const teamNode =
      teamTemplate.content.firstElementChild.cloneNode(true);

    teamNode.classList.toggle(
      "active",
      teamIndex === state.activePlayer
    );

    teamNode.querySelector(".team-name").value =
      team.name;

    const memberList =
      teamNode.querySelector(".member-list");

    const assistList =
      document.createElement("div");

    assistList.className =
      "assist-list";


    // B編成だけ先頭に空白を入れる
    if (teamIndex === 1) {
      [assistList, memberList].forEach((list) => {
        const spacer =
          document.createElement("div");

        spacer.className =
          "member-spacer";

        spacer.setAttribute(
          "aria-hidden",
          "true"
        );

        list.append(spacer);
      });
    }


    getVisibleMemberIndices(teamIndex).forEach(
      (memberIndex, visibleIndex) => {

        // アシスト
        assistList.append(
          createSkillRow(
            memberTemplate,
            teamIndex,
            memberIndex,
            visibleIndex,
            "assist"
          )
        );

        // キャラ
        memberList.append(
          createSkillRow(
            memberTemplate,
            teamIndex,
            memberIndex,
            visibleIndex,
            "member"
          )
        );
      }
    );


    if (teamIndex === 1) {
      assistList.style.gridRow = "2";
      memberList.style.gridRow = "1";
    }


    teamNode.insertBefore(
      assistList,
      memberList
    );


    teamNode
      .querySelector(".team-name")
      .addEventListener("change", () => {
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
      .sort((a, b) => a - b);

  if (floors.length === 0) {

    const div = document.createElement("div");

    div.textContent =
      "先制は登録されていません";

    elements.floorActionList.append(div);

    return;
  }

  floors.forEach((floor) => {

    const action = state.floorActions[floor];

    const actionText =
      action.type === "delay"
        ? `遅延 ${action.value}ターン`
        : action.type === "haste"
          ? `ヘイスト ${action.value}ターン`
          : "先制なし";

    const superResolveText =
      action.superResolve
        ? ` / 超根性 ${getSuperResolveCount(action)}回`
        : "";

    const row =
      document.createElement("div");

    row.className =
      "floor-action-row";

    // 階層名
    const text =
      document.createElement("span");

    text.textContent =
      `${floor}F：${actionText}${superResolveText}`;

    // 編集ボタン
    const editButton =
      document.createElement("button");

    editButton.type = "button";
    editButton.textContent = "編集";
    editButton.className =
      "edit-floor-action";

    editButton.addEventListener(
      "click",
      () => {

        openFloorEditor(floor);

      }
    );

    const deleteButton =
      document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.className =
      "delete-floor-action";

    deleteButton.addEventListener(
      "click",
      () => {

        pushHistory();

        delete state.floorActions[floor];

        render();

      }
    );

    row.append(
      text,
      editButton,
      deleteButton
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
  autoSaveState();
}

function savePreset() {
  updateFromInputs();
  localStorage.setItem(STORAGE_KEY, snapshot());
  render();
}

function loadPreset() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    alert("保存データがありません");
    return;
  }

  pushHistory();
  restore(saved);
  render();
}

function saveTeamPreset() {
  updateFromInputs();

  let slot = prompt(
    "保存先を入力してください（1～5）"
  );

  if (!slot)return;
  slot = slot.replace(/[0-9]/g,s =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );

  const presets = JSON.parse(
    localStorage.getItem(TEAM_PRESET_KEY) || "{}"
  );

  const name = prompt(
   "編成名を入力してください",
   presets[slot]?.name || `編成${slot}`
  );

  presets[slot] = {
   name: name || `編成${slot}`,
   teams: structuredClone(state.teams)
  };

  localStorage.setItem(
    TEAM_PRESET_KEY,
    JSON.stringify(presets)
  );

  alert(`「${name || `編成${slot}`}」を編成${slot}に保存しました`);
}

function loadTeamPreset() {
  const presets = JSON.parse(
    localStorage.getItem(TEAM_PRESET_KEY) || "{}"
  );

  const slotList = Array.from({ length: 5 }, (_, i) => {
    const slot = i + 1;
    return `${slot}: ${presets[slot]?.name || "空き"}`;
  }).join("\n");

  const slot = prompt(
    `読み込む編成番号を入力してください\n\n${slotList}`
  );

  if (!slot) return;
    slot = slot.replace(/[0-9]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  );

  if (!presets[slot]) {
    alert("そのスロットには保存されていません");
    return;
  }

  pushHistory();

  state.teams = structuredClone(
    presets[slot].teams
  );

  render();

  alert(`「${presets[slot].name}」を読み込みました`);
}

function getTeamPresets() {
  try {
    return JSON.parse(localStorage.getItem(TEAM_PRESET_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function setTeamPresets(presets) {
  localStorage.setItem(TEAM_PRESET_KEY, JSON.stringify(presets));
}

function getPresetDefaultName(slot) {
  return `編成${slot}`;
}

function renderTeamPresetList() {
  if (!elements.teamPresetList) return;

  const presets = getTeamPresets();
  elements.teamPresetList.textContent = "";

  for (let slot = 1; slot <= PRESET_SLOT_COUNT; slot++) {
    const preset = presets[slot];
    const row = document.createElement("div");
    row.className = "team-preset-row";

    const name = document.createElement("input");
    name.className = "team-preset-name team-preset-name-input";
    name.dataset.slot = String(slot);
    name.type = "text";
    name.value = preset?.name || getPresetDefaultName(slot);
    name.placeholder = `${slot} 未使用`;

    const buttons = document.createElement("div");
    buttons.className = "team-preset-buttons";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "保存";
    saveButton.addEventListener("click", () => saveTeamPresetSlot(slot));

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "読込";
    loadButton.disabled = !preset;
    loadButton.addEventListener("click", () => loadTeamPresetSlot(slot));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.disabled = !preset;
    deleteButton.addEventListener("click", () => deleteTeamPresetSlot(slot));

    buttons.append(saveButton, loadButton, deleteButton);
    row.append(name, buttons);
    elements.teamPresetList.append(row);
  }
}

function openTeamPresetDialog() {
  renderTeamPresetList();
  elements.teamPresetDialog.showModal();
}

function closeTeamPresetDialog() {
  elements.teamPresetDialog.close();
}

function saveTeamPresetSlot(slot) {
  updateFromInputs();

  const presets = getTeamPresets();
  const input = elements.teamPresetList.querySelector(
    `.team-preset-name-input[data-slot="${slot}"]`
  );
  const presetName = input?.value.trim() || getPresetDefaultName(slot);

  presets[slot] = {
    name: presetName,
    savedAt: new Date().toISOString(),
    teams: deepClone(state.teams),
    leaderIndices:deepClone(state.leaderIndices)
  };

  setTeamPresets(presets);
  renderTeamPresetList();
  alert(`「${presetName}」を編成${slot}に保存しました`);
}

function loadTeamPresetSlot(slot) {
  const presets = getTeamPresets();
  const preset = presets[slot];

  if (!preset) {
    alert("このスロットには保存データがありません");
    return;
  }

  pushHistory();
  state.teams = deepClone(preset.teams);
  state.leaderIndices = deepClone(
    preset.leaderIndices ?? [0,5]
  )
  state.isBattleStarted = false;
  state.setupSnapshot = null;
  ensureTeams();
  render();
  closeTeamPresetDialog();
}

function deleteTeamPresetSlot(slot) {
  const presets = getTeamPresets();

  if (!presets[slot]) return;

  delete presets[slot];
  setTeamPresets(presets);
  renderTeamPresetList();
}

function saveTeamPreset() {
  openTeamPresetDialog();
}

function loadTeamPreset() {
  openTeamPresetDialog();
}

function resetProgressState() {
  state.activePlayer = 0;
  state.actionCount = 0;
  state.floorCount = 1;
  state.aTurnCount = 0;
  state.bTurnCount = 0;
  state.enemyTurns = 3;
  state.superResolveUses = {};
  state.leaderIndices = [0, 5];

  state.isBattleStarted = false;
  state.setupSnapshot = null;
}

function resetAllState() {
  resetProgressState();
  state.floorActions = {};
  state.teams = [makeDefaultTeam(0), makeDefaultTeam(1)];
  state.log = ["-----1F-----"];
}

function openResetDialog() {
  elements.resetTeams.checked = true;
  elements.resetProgress.checked = true;
  elements.resetLog.checked = true;
  elements.resetFloorActions.checked = true;
  elements.resetSavedTeams.checked = false;
  elements.resetDialog.showModal();
}

function closeResetDialog() {
  elements.resetDialog.close();
}

function resetSelectedSections(event) {
  event.preventDefault();

  const shouldResetTeams = elements.resetTeams.checked;
  const shouldResetProgress = elements.resetProgress.checked;
  const shouldResetLog = elements.resetLog.checked;
  const shouldResetFloorActions = elements.resetFloorActions.checked;
  const shouldResetSavedTeams = elements.resetSavedTeams.checked;

  if (
    !shouldResetTeams &&
    !shouldResetProgress &&
    !shouldResetLog &&
    !shouldResetFloorActions &&
    !shouldResetSavedTeams
  ) {
    closeResetDialog();
    return;
  }

  pushHistory();

  if (shouldResetTeams) {
    state.teams = [makeDefaultTeam(0), makeDefaultTeam(1)];
    state.setupSnapshot = null;
    state.isBattleStarted = false;
  }

  if (shouldResetProgress) {
    resetProgressState();
  }

  if (shouldResetLog) {
    state.log = ["-----1F-----"];
  }

  if (shouldResetFloorActions) {
    state.floorActions = {};
    state.superResolveUses = {};
  }

  if (shouldResetSavedTeams) {
    localStorage.removeItem(TEAM_PRESET_KEY);
  }

  render();
  closeResetDialog();
}

function resetAll() {
  openResetDialog();
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
document.querySelector("#resetAll").addEventListener("click", resetAll);
document.querySelector("#copyLog").addEventListener("click", copyLog);
elements.resetDialogClose.addEventListener("click", closeResetDialog);
elements.resetForm.addEventListener("submit", resetSelectedSections);
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
  if (editTarget.skillType === "member") {
    member.characterName =
      elements.editName.value.trim() ||
      member.characterName ||
      `枠${editTarget.memberIndex + 1}`;
  }
  if (editTarget.skillType === "member") {


  member.characterName =
    elements.editName.value.trim() ||
    member.characterName ||
    `枠${editTarget.memberIndex + 1}`;
  if (editTarget.skillType === "member") {

  member.characterName =
    elements.editName.value.trim() ||
    member.characterName ||
    `枠${editTarget.memberIndex + 1}`;

  phase.name =
    elements.editSkillName.value.trim() ||
    `スキル${phaseIndex + 1}`;

} else {

  phase.name =
    elements.editName.value.trim() ||
    `スキル${phaseIndex + 1}`;
}
  } else {
    phase.name =
      elements.editName.value.trim() ||
      `スキル${phaseIndex + 1}`;
  }
  phase.maxCd = clampNumber(elements.editMaxCd.value, 1, 99);
  phase.haste = clampNumber(elements.editHaste.value, -99, 99);
  phase.effect = elements.editSkillEffect.value;

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
elements.saveTeamPreset.addEventListener("click", saveTeamPreset);
elements.teamPresetDialogClose.addEventListener("click", closeTeamPresetDialog);
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

elements.floorEditTarget.addEventListener(
  "change",
  () => {
    loadFloorActionToEditor(
      elements.floorEditTarget.value
    );
  }
);

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

   state.setupSnapshot = {
    teams: deepClone(state.teams),
    leaderIndices:deepClone(state.leaderIndices),
   };

   applyBoosts(0);

   state.isBattleStarted = true;
   state.superResolveUses = {};

   const action = state.floorActions[1];

    applyFloorAction(1, action, "1F先制");

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

const autoSavedState =
  localStorage.getItem(STORAGE_KEY);

if (autoSavedState) {
  try {
    restore(autoSavedState);
  } catch (error) {
    console.error(
      "自動保存データの読み込みに失敗しました",
      error
    );

    resetAllState();
  }
} else {
  resetAllState();
}

render();
