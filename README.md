# DMD Team Builder

A small mobile-friendly web app that generates a team of characters for *Cthulhu: Death May Die*.

**Live app:** https://abregado.github.io/dmd-team-builder/

## How it works

- Set a min/max for how many team members should have each of the six common abilities.
- Add 3–5 players and optionally pick up to two desired abilities for each.
- Press **Generate** to assign a unique character to every player. Player preferences are prioritised over the team min/max values.
  - Highlighted abilities match what the player asked for; red abilities mean no match was possible.
  - A red min/max value means that limit could not be met (or is invalid).
- Use **⟳** to reroll a single player, or **Reset** to return to editing.

Settings are saved in the browser's localStorage.

## Development

Plain HTML, CSS, JavaScript and Claude Code. Serve the folder with any static server, e.g.:

```bash
python -m http.server 8123
```

Then open http://localhost:8123. Character data lives in [`data/characters.json`](data/characters.json).

## Deployment

Pushing to `main` deploys to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). In the repo settings, set **Pages → Source** to **GitHub Actions**.
