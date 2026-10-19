# three-maze-explorer

Procedurally generated 3D maze explorer built with Three.js + Vite. Collect all
orbs, then reach the portal to escape.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Controls

- `WASD` / arrows — move cell by cell
- `R` or click — restart (new maze each time)

Maze is generated with recursive backtracking plus a few carved loops, so every
run is different.
