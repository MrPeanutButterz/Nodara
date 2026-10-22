# Nodara

Every idea has a root. Nodara is a mind-mapping app that helps you start from
that root and grow your thinking into a clear, structured map.

## Features

- Create a central idea and branch out with nodes
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

## Keyboard shortcuts

On Windows and Linux, read `Cmd` as `Ctrl`.

| Key | Action |
| --- | --- |
| `Tab` | Add a child idea (inside a text box: save, then add a child) |
| `Enter` | Add a sibling idea (inside a text box: save) |
| `Space` or `F2` | Rename the selected idea |
| `Arrow keys` | Move the selection |
| `Alt` + `Up` / `Down` | Move the idea up or down among its siblings |
| `C` | Collapse or expand a branch |
| `Delete` | Delete the idea and its branch |
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
- `src/model/` is plain TypeScript with no UI in it: the tree operations,
  layout and file validation. Every operation returns a new map, which is what
  makes undo and redo a list of snapshots.
- The canvas is custom (pan, zoom, drag and drop) rather than a graph library,
  to keep the dependency list short.

## Status

Early development. Expect rapid changes.

## License

MIT
