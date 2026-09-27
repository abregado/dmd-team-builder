import {
  ABILITIES,
  generateTeam,
  isMatched,
  limitBreaches,
  reroll,
  rerollOptions,
} from "./generator.js";

const STORAGE_KEY = "dmd-team-builder";
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 5;
const LIMIT_MIN = 0;
const LIMIT_MAX = 5;

let characters = [];
let state = defaultState();
let picker = null; // { player, slot } while the ability dialog is open

const el = {
  main: document.getElementById("main-button"),
  limits: document.getElementById("limits"),
  players: document.getElementById("players"),
  addPlayer: document.getElementById("add-player"),
  dialog: document.getElementById("picker"),
  dialogTitle: document.getElementById("picker-title"),
  dialogOptions: document.getElementById("picker-options"),
};

function defaultState() {
  return {
    mode: "edit",
    limits: Object.fromEntries(ABILITIES.map((a) => [a, { min: LIMIT_MIN, max: LIMIT_MAX }])),
    players: Array.from({ length: MIN_PLAYERS }, newPlayer),
  };
}

function newPlayer() {
  return { desired: [null, null], character: null };
}

// ---------- persistence ----------

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable; the app still works for this visit
  }
}

function load() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultState();
  }
  if (!saved || typeof saved !== "object") return defaultState();

  const result = defaultState();
  const byName = new Map(characters.map((c) => [c.name, c]));
  const validLimit = (v) => Number.isInteger(v) && v >= LIMIT_MIN && v <= LIMIT_MAX;

  for (const a of ABILITIES) {
    const l = saved.limits?.[a];
    if (l && validLimit(l.min) && validLimit(l.max)) result.limits[a] = { min: l.min, max: l.max };
  }

  if (Array.isArray(saved.players) && saved.players.length >= MIN_PLAYERS && saved.players.length <= MAX_PLAYERS) {
    result.players = saved.players.map((p) => {
      let desired = Array.isArray(p?.desired) ? p.desired.slice(0, 2) : [];
      desired = [0, 1].map((i) => (ABILITIES.includes(desired[i]) ? desired[i] : null));
      if (desired[0] && desired[0] === desired[1]) desired[1] = null;
      return { desired, character: byName.has(p?.character) ? p.character : null };
    });
  }

  const complete = result.players.every((p) => p.character);
  const unique = new Set(result.players.map((p) => p.character)).size === result.players.length;
  if (saved.mode === "generated" && complete && unique) {
    result.mode = "generated";
  } else {
    result.players.forEach((p) => (p.character = null));
  }
  return result;
}

// ---------- helpers ----------

function team() {
  const byName = new Map(characters.map((c) => [c.name, c]));
  return state.players.map((p) => byName.get(p.character));
}

function desiredList() {
  return state.players.map((p) => p.desired);
}

function update() {
  save();
  render();
}

// ---------- actions ----------

function generate() {
  const result = generateTeam(characters, desiredList(), state.limits);
  result.forEach((c, i) => (state.players[i].character = c.name));
  state.mode = "generated";
  update();
}

function reset() {
  state.players.forEach((p) => (p.character = null));
  state.mode = "edit";
  update();
}

function rerollPlayer(index) {
  const c = reroll(characters, team(), index, desiredList(), state.limits);
  state.players[index].character = c.name;
  update();
}

function stepLimit(ability, field, delta) {
  const l = state.limits[ability];
  l[field] = Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, l[field] + delta));
  update();
}

function addPlayer() {
  if (state.players.length >= MAX_PLAYERS) return;
  state.players.push(newPlayer());
  update();
}

function removePlayer(index) {
  if (state.players.length <= MIN_PLAYERS) return;
  state.players.splice(index, 1);
  update();
}

function openPicker(player, slot) {
  picker = { player, slot };
  const desired = state.players[player].desired;
  const other = desired[1 - slot];
  el.dialogTitle.textContent = `Player ${player + 1} – ability ${slot + 1}`;
  el.dialogOptions.innerHTML =
    ABILITIES.map(
      (a) =>
        `<button type="button" class="pick${a === desired[slot] ? " selected" : ""}" data-ability="${a}"${
          a === other ? " disabled" : ""
        }>${a}</button>`
    ).join("") + `<button type="button" class="pick clear" data-ability="">Clear</button>`;
  el.dialog.showModal();
}

function choose(ability) {
  if (!picker) return;
  state.players[picker.player].desired[picker.slot] = ability || null;
  el.dialog.close();
  update();
}

// ---------- rendering ----------

function render() {
  const generated = state.mode === "generated";
  document.body.classList.toggle("generated", generated);

  el.main.textContent = generated ? "Reset" : "Generate";
  el.main.classList.toggle("reset", generated);

  renderLimits(generated);
  renderPlayers(generated);

  el.addPlayer.hidden = generated || state.players.length >= MAX_PLAYERS;
}

function renderLimits(generated) {
  const breaches = generated ? limitBreaches(team(), state.limits) : null;
  el.limits.innerHTML = ABILITIES.map((a) => {
    const { min, max } = state.limits[a];
    const invalid = min > max;
    const minBad = invalid || breaches?.[a].low;
    const maxBad = invalid || breaches?.[a].high;
    return `
      <div class="limit">
        <div class="limit-name">${a}</div>
        <div class="limit-values">
          ${stepper(a, "min", min, minBad, generated)}
          <span class="dash">–</span>
          ${stepper(a, "max", max, maxBad, generated)}
        </div>
      </div>`;
  }).join("");
}

function stepper(ability, field, value, bad, locked) {
  const dis = (cond) => (locked || cond ? " disabled" : "");
  return `
    <div class="stepper" aria-label="${ability} ${field}">
      <button type="button" data-action="step" data-ability="${ability}" data-field="${field}" data-delta="-1"
        aria-label="Decrease ${ability} ${field}"${dis(value <= LIMIT_MIN)}>−</button>
      <span class="value${bad ? " bad" : ""}">${value}</span>
      <button type="button" data-action="step" data-ability="${ability}" data-field="${field}" data-delta="1"
        aria-label="Increase ${ability} ${field}"${dis(value >= LIMIT_MAX)}>+</button>
    </div>`;
}

function renderPlayers(generated) {
  const t = generated ? team() : null;
  const desired = desiredList();
  el.players.innerHTML = state.players
    .map((p, i) => {
      const label = `<div class="player-label">P${i + 1}</div>`;
      if (!generated) {
        const slots = p.desired
          .map(
            (d, s) =>
              `<button type="button" class="slot${d ? "" : " empty"}" data-action="pick" data-player="${i}" data-slot="${s}">${
                d ?? "Any"
              }</button>`
          )
          .join("");
        return `
          <li class="player">
            ${label}
            <div class="slots">${slots}</div>
            <button type="button" class="icon" data-action="remove" data-player="${i}" aria-label="Remove player ${i + 1}"${
              state.players.length <= MIN_PLAYERS ? " disabled" : ""
            }>🗑</button>
          </li>`;
      }

      const c = t[i];
      const miss = !isMatched(c, p.desired);
      const chips = c.abilities
        .map((a) => {
          const cls = miss ? " miss" : p.desired.includes(a) ? " match" : "";
          return `<span class="chip${cls}">${a}</span>`;
        })
        .join("");
      const canReroll = rerollOptions(characters, t, i, desired, state.limits).length > 0;
      return `
        <li class="player">
          ${label}
          <div class="character">
            <div class="character-name">${c.name}</div>
            <div class="chips">${chips}</div>
          </div>
          <button type="button" class="icon" data-action="reroll" data-player="${i}" aria-label="Reroll player ${i + 1}"${
            canReroll ? "" : " disabled"
          }>⟳</button>
        </li>`;
    })
    .join("");
}

// ---------- events ----------

el.main.addEventListener("click", () => (state.mode === "generated" ? reset() : generate()));
el.addPlayer.addEventListener("click", addPlayer);

el.limits.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action='step']");
  if (b) stepLimit(b.dataset.ability, b.dataset.field, Number(b.dataset.delta));
});

el.players.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  const i = Number(b.dataset.player);
  if (b.dataset.action === "pick") openPicker(i, Number(b.dataset.slot));
  else if (b.dataset.action === "remove") removePlayer(i);
  else if (b.dataset.action === "reroll") rerollPlayer(i);
});

el.dialogOptions.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-ability]");
  if (b) choose(b.dataset.ability);
});

// Close when tapping the backdrop.
el.dialog.addEventListener("click", (e) => {
  if (e.target === el.dialog) el.dialog.close();
});
el.dialog.addEventListener("close", () => (picker = null));

// ---------- start ----------

async function init() {
  try {
    const res = await fetch("data/characters.json");
    characters = await res.json();
  } catch {
    el.main.textContent = "Failed to load characters";
    el.main.disabled = true;
    return;
  }
  state = load();
  el.main.disabled = false;
  render();
}

init();
