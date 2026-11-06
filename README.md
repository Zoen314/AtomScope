# AtomScope

A local-first atomic structure viewer for **POSCAR** and **LAMMPS data**. Rotate periodic cells and measure distances and angles in your browser. No database or file upload service.

## Quick start

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run build
npm run local:viewer
```

Open **http://127.0.0.1:43117/** and choose or drop a structure. The launcher binds only to loopback. For development: `npm run dev`.

## Controls

| Control | Action |
| --- | --- |
| Drag / scroll / right-drag | Rotate / zoom / pan |
| Atoms / Cell / Inferred bonds | Toggle visibility |
| Distance | Pick A and B, or enter source-file atom IDs |
| Angle | Pick A, B, C; **B is the vertex** |
| Clear | Clear the measurement |
| Reset view | Restore the camera |
| Settings | Display sizes and geometric bond cutoffs |
| Copy link | Encode the structure in the URL fragment |

IDs start at 1. Click a selected atom to deselect it. After completion, pick a new atom to start again. Distances (angstroms) and angles (degrees) use periodic minimum-image geometry. Blue guides are measurements, not bonds.

The accepted rendering is locked independently in `web-components/approved-viewer-style.json`. UI updates must not change its colors, lighting or ball-and-stick proportions.

## Supported formats

- POSCAR: VASP 5/6 element row, one positive scale, Direct/Cartesian, Selective dynamics, nonsingular cells.
- LAMMPS text data: explicit `Atoms # atomic`, orthogonal/restricted triclinic boxes, optional image flags.
- Unsupported: VASP4, negative/three-component scale, dump/restart, full/charge/molecular styles and general triclinic data.

LAMMPS defaults to angstrom units and ppp boundaries, labeled as assumptions. Missing element mappings disable inferred bonds, not atom display.

## Local links

```sh
npm run make-view-link -- /absolute/path/to/POSCAR
npm run make-view-link -- /absolute/path/to/conf.lmp --type-map 1:P,2:O,3:H
```

Windows also supports `make-view-link.cmd`. The command starts the local production viewer if needed. Use `--pbc ppp` for boundary metadata; `ATOM_VIEWER_PORT` changes the local port.

The fragment contains normalized coordinates, not source paths or original comments, and is not sent in the HTTP request. **Anyone with the full link can decode it. It is not encryption.** Loopback links require the server on the same computer. Links over 100,000 characters are rejected. Measurements and display-size settings are session-local.

## Scientific scope

Inferred bonds use Blue Obelisk covalent radii: `0.40 Å ≤ d < 1.15 × (rA + rB)`, with optional pair overrides. They are geometric display hints, not chemical bond orders or scientific validation. No VESTA program files or bond tables are bundled.

## Development

```sh
npm test
npx tsc --noEmit
npx eslint app lib/ui-text.ts
npm run build
```

MatterViz 0.4.4 is compiled through guarded local adapters. Tests cover parsing, sharing, periodic bonds, measurements and the fixed rendering preset. Generated bundles are excluded from the source distribution and rebuilt by `npm run build`.

To compare your own paired POSCAR / `conf.lmp` files, run `npm run audit:local -- /path/to/paired-data`. This optional audit never selects a hard-coded dataset and is not part of CI.

## Before publishing

Read [PUBLISHING.md](docs/PUBLISHING.md) and [PRIVACY.md](docs/PRIVACY.md). This source distribution excludes private datasets, original development history and account-specific deployment configuration. No application license has been selected yet; choose one before advertising the project as open source.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for [MatterViz](https://github.com/janosh/matterviz), [BODR](https://github.com/BlueObelisk/bodr) and other attribution.
