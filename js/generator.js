export const ABILITIES = [
  "Arcane Mastery",
  "Stealth",
  "Marksman",
  "Brawling",
  "Swiftness",
  "Toughness",
];

const ATTEMPTS = 150;

// Number of a player's desired abilities that a character has.
export function matchCount(character, desired) {
  return desired.filter((d) => d && character.abilities.includes(d)).length;
}

// A player with no desired abilities is satisfied by anyone.
export function isMatched(character, desired) {
  return !desired.some(Boolean) || matchCount(character, desired) > 0;
}

export function abilityCounts(team) {
  const counts = Object.fromEntries(ABILITIES.map((a) => [a, 0]));
  for (const c of team) {
    if (!c) continue;
    for (const a of c.abilities) counts[a]++;
  }
  return counts;
}

// Per ability: whether the team count is below min / above max.
export function limitBreaches(team, limits) {
  const counts = abilityCounts(team);
  const result = {};
  for (const a of ABILITIES) {
    result[a] = { low: counts[a] < limits[a].min, high: counts[a] > limits[a].max };
  }
  return result;
}

function violation(team, limits) {
  const counts = abilityCounts(team);
  let total = 0;
  for (const a of ABILITIES) {
    const { min, max } = limits[a];
    total += Math.max(0, min - counts[a]) + Math.max(0, counts[a] - max);
  }
  return total;
}

// Lexicographic score: players matched, total matches, fewest min/max breaches.
function score(team, desiredList, limits) {
  let matched = 0;
  let total = 0;
  team.forEach((c, i) => {
    if (isMatched(c, desiredList[i])) matched++;
    total += matchCount(c, desiredList[i]);
  });
  return [matched, total, -violation(team, limits)];
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Each player, in random order, takes a random unused character from their best match tier.
function greedyTeam(characters, desiredList) {
  const team = new Array(desiredList.length).fill(null);
  const used = new Set();
  for (const i of shuffle([...desiredList.keys()])) {
    const pool = characters.filter((c) => !used.has(c));
    const best = Math.max(...pool.map((c) => matchCount(c, desiredList[i])));
    const choice = pickRandom(pool.filter((c) => matchCount(c, desiredList[i]) === best));
    team[i] = choice;
    used.add(choice);
  }
  return team;
}

// Hill climb: replace a character with an unused one, or swap two players, while the score improves.
function improve(team, characters, desiredList, limits) {
  let current = score(team, desiredList, limits);
  let improved = true;
  while (improved) {
    improved = false;
    for (const i of shuffle([...team.keys()])) {
      const used = new Set(team);
      for (const c of shuffle(characters)) {
        if (used.has(c)) continue;
        const candidate = team.slice();
        candidate[i] = c;
        const s = score(candidate, desiredList, limits);
        if (compare(s, current) > 0) {
          team = candidate;
          current = s;
          improved = true;
          break;
        }
      }
      for (let j = 0; j < team.length; j++) {
        if (j === i) continue;
        const candidate = team.slice();
        [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
        const s = score(candidate, desiredList, limits);
        if (compare(s, current) > 0) {
          team = candidate;
          current = s;
          improved = true;
        }
      }
    }
  }
  return { team, score: current };
}

export function generateTeam(characters, desiredList, limits) {
  let best = [];
  let bestScore = null;
  const seen = new Set();
  for (let n = 0; n < ATTEMPTS; n++) {
    const result = improve(greedyTeam(characters, desiredList), characters, desiredList, limits);
    const cmp = bestScore ? compare(result.score, bestScore) : 1;
    const key = result.team.map((c) => c.name).join("|");
    if (cmp > 0) {
      best = [result.team];
      bestScore = result.score;
      seen.clear();
      seen.add(key);
    } else if (cmp === 0 && !seen.has(key)) {
      best.push(result.team);
      seen.add(key);
    }
  }
  return pickRandom(best);
}

// Characters that would score best in slot `index`, with the rest of the team fixed.
export function rerollOptions(characters, team, index, desiredList, limits) {
  const others = new Set(team.filter((_, i) => i !== index));
  let bestScore = null;
  let options = [];
  for (const c of characters) {
    if (others.has(c)) continue;
    const candidate = team.slice();
    candidate[index] = c;
    const s = score(candidate, desiredList, limits);
    const cmp = bestScore ? compare(s, bestScore) : 1;
    if (cmp > 0) {
      bestScore = s;
      options = [c];
    } else if (cmp === 0) {
      options.push(c);
    }
  }
  return options.filter((c) => c !== team[index]);
}

export function reroll(characters, team, index, desiredList, limits) {
  const options = rerollOptions(characters, team, index, desiredList, limits);
  return options.length ? pickRandom(options) : team[index];
}
