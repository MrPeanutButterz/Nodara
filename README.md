# Nodara

Every idea has a root. Nodara is a mind-mapping app that helps you start from
that root and grow your thinking into a clear, structured map.

## Features

- Create a central idea and branch out with nodes
- Four kinds of map: mind map, concept map, flowchart and timeline
- Five layouts for tree maps: right, left and right, top down (org chart), radial and timeline
- Drag, reorder and nest ideas freely
- Fast keyboard-first workflow
- Clean, distraction-free canvas
- Command palette (`Cmd/Ctrl+K`) for everything the keyboard shortcuts don't cover
- Undo and redo
- Maps are saved automatically; save or open them as `.nodara` files
- Export a map as a Markdown outline

## Getting started

Requires Node.js 20.19 or newer (22 recommended).

```sh
npm install
npm run dev        # desktop app with hot reload
npm run dev:web    # the same UI in a browser, no Electron
npm run build      # typecheck and build the UI into dist/
npm run start      # build, then run the desktop app
npm run dist       # build an installer into release/
```

## Kinds of map

Pick the kind from **New map** in the sidebar (or the command palette).

| Kind | What it is |
| --- | --- |
| Mind map | One root with ideas branching from it. Switch the layout at any time from **Layout** in the top bar: right, left and right, top down, radial. Switching is one undo step. |
| Timeline | A tree drawn along an axis: top-level ideas are events, ideas below them are details. |
| Concept map | Ideas placed anywhere, joined by links that can carry a label ("causes", "is part of"). |
| Flowchart | Like a concept map, with steps, decisions and start/end shapes, and arrows on the links. |

In concept maps and flowcharts: double-click empty canvas to add an idea, drag
an idea to move it (it snaps to a grid), and drag the handle on a selected idea
onto another idea to link them, or onto empty space to make a new linked idea.
Click a link to select it, double-click it to give it a label. Double-click the
map name in the top bar to rename the map.

## Keyboard shortcuts

On Windows and Linux, read `Cmd` as `Ctrl`.

| Key | Action |
| --- | --- |
| `Tab` | Add a child idea, or in a concept map or flowchart an idea linked to the selected one (inside a text box: save, then add) |
| `Enter` | Add a sibling idea, or in a concept map or flowchart an idea below the selected one (inside a text box: save) |
| `Space` or `F2` | Rename the selected idea, or edit the selected link's label |
| `Arrow keys` | Move the selection |
| `Alt` + `Up` / `Down` | Move the idea up or down among its siblings (`Left` / `Right` in the top-down layout) |
| `Alt` + `Arrow keys` | In concept maps and flowcharts: nudge the idea |
| `S` | Flowchart: change the shape of the selected idea |
| `C` | Collapse or expand a branch |
| `Delete` | Delete the idea and its branch, or the selected link |
| `Esc` | Cancel editing, or clear the selection |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / redo |
| `Cmd+K` | Command palette |
| `Cmd+N` | New map |
| `Cmd+0` | Fit the map to the screen |
| `Cmd+\` | Show or hide the sidebar |

With the mouse: drag an idea onto another to nest it, or onto its top or
bottom edge to place it before or after. Drag the background to pan, scroll to
pan, and pinch or `Cmd+scroll` to zoom. Double-click an idea to rename it.

## How it is built

- Electron shell (`electron/`) with a sandboxed renderer. The only things the
  page can ask the system for are two file dialogs.
- React and TypeScript on Vite (`src/`).
- `src/model/` is plain TypeScript with no UI in it: the tree and graph
  operations, the layouts and file validation. Every operation returns a new map, which is what
  makes undo and redo a list of snapshots.
- The canvas is custom (pan, zoom, drag and drop) rather than a graph library,
  to keep the dependency list short.

## Status

Early development. Expect rapid changes.

## License

MIT
