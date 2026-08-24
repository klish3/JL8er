# JL8 — a better reader

A fast, modern, mobile-friendly reader for **[JL8](https://www.yalestewart.com/)**, the webcomic
by **Yale Stewart** in which the Justice League are eight-year-olds.

This is an unofficial fan project — a rebuild of the classic reader at
[limbero.org/jl8](https://limbero.org/jl8) that aims to be quicker and nicer to use.
The comic images are still served from the original host; this project only adds a better
front-end on top.

## Why it's better

The original renders one page per server round-trip with bare `‹ ›` links. This reader
indexes the **entire catalog up front** (a small `comics.json`), so:

- **Instant navigation** — no page reload between comics; the next/previous pages
  **preload** while you read.
- **Resume where you left off** — your last position is remembered, and read comics are
  tracked locally.
- **Real archive** — a searchable thumbnail grid of all 270 entries with a "jump to #" box,
  an unread filter, and read indicators.
- **Keyboard-first** — arrows to flip, `Home`/`End`, `G` to jump, `A` archive, `W` fit,
  `T` theme, `?` help.
- **Touch-friendly** — swipe left/right to flip pages on mobile.
- **Dark & light themes**, following your system preference by default.
- **Robust to the comic's quirks** — multi-panel strips and the multi-part finale (#270,
  8 parts / 46 panels, with a deliberately missing panel) are all handled correctly,
  with per-panel retry on load failure.
- **Zero dependencies, zero build step** — plain HTML/CSS/JS. Deploy anywhere static.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `←` / `→` (or `Space`) | Previous / next comic |
| `Home` / `End` | First / latest |
| `G` | Jump to a number |
| `A` | Archive |
| `W` | Toggle fit-width / actual size |
| `T` | Toggle light / dark theme |
| `?` | Help · `Esc` closes dialogs |

## How it works

`comics.json` maps every comic id to its ordered list of panel image filenames. It's a
static snapshot built by probing the original image host — JL8 is complete, so the index is
stable. The reader (`app.js`) fetches it once and drives everything client-side: routing via
the URL hash (`#/c/42`, `#/archive`), preloading, read-tracking and resume via
`localStorage`, and lazy-loaded archive thumbnails via `IntersectionObserver`.

### Files

```
index.html     markup + meta
styles.css     theming (CSS variables), layout, components
app.js         reader logic, routing, preloading, archive
comics.json    prebuilt index of all comics → panel images
scripts/       build + test tooling (not needed to run the site)
```

### Regenerating the index

If new pages are ever added, rebuild the manifest:

```bash
python3 scripts/build_manifest.py
```

It probes the host (handling single-image, multi-panel, and chaptered comics, tolerating
gaps in panel numbering) and writes `comics.json`.

## Running locally

It's a static site — serve the repo root with anything:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Credits

Characters © DC Comics. Creative content © **[Yale Stewart](https://www.yalestewart.com/)**.
Comic images are served from the original reader at
[limbero.org/jl8](https://limbero.org/jl8) (site by Axel Samuelsson).
This reader is a tribute and claims no ownership of the comic.

## Also in this repo

This repo also carries **[Jira Data Bridge](jira-data-bridge/README.md)**, a self-contained
React + Vite tool for pulling data out of Jira — JQL search with CSV/JSON export, a project
browser, and a read-only API explorer. It lives entirely in `jira-data-bridge/` with its own
toolchain; the comic reader remains dependency-free.

Alongside it, **[bridge-consumer](bridge-consumer/README.md)** is a small starter project
that fetches its Jira and Confluence data *through* the bridge (a TypeScript helper plus a
`CLAUDE.md` that routes Atlassian data needs to the bridge automatically). Both are separate
from the reader and from each other.
