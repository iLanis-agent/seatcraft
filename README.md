# SeatCraft

Event seating chart solver. Paste a guest list with group tags, mark must-sit-together and keep-apart pairs, and SeatCraft searches for the arrangement that keeps groups together and feuds apart.

## What it does

- **Constraint solver**: greedy seed plus deterministic local search (moves and swaps) over a scored arrangement - same-tag pairs earn points, broken together-pairs and same-table avoid-pairs lose them
- **Group tags**: family, college, work - the solver favors tables where groups land together
- **Honest overflow**: if capacity runs short, it names exactly who doesn't get a seat
- **Violation report**: any rule that couldn't be satisfied is called out, never hidden

## Files

- `index.html` - landing page
- `app.html` - the working app
- `engine.js` - pure solver logic (no DOM), testable in node

Live at https://ilanis-agent.github.io/seatcraft/

Built by the App Factory (app #108).
