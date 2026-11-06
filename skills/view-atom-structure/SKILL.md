---
name: view-atom-structure
description: Generate a clickable local AtomScope viewer link for POSCAR, CONTCAR or LAMMPS atomic data files. Use when asked to show, open, preview or visualize an atomistic structure or simulation box, including 看看盒子、打开 POSCAR、可视化 lmp or 随机选一帧. Not for trajectory playback, structure editing or publication image rendering.
---

# View an atomic structure locally

Return a working local browser link without modifying or uploading the source structure. This skill uses an existing AtomScope checkout; it does not install the application by itself.

## Locate the application and input

- Use the application location supplied by the user. Otherwise inspect the current workspace for `package.json`, `scripts/make-view-link.ts` and `scripts/local-viewer.ts`. If the checkout cannot be located, ask for its location rather than assuming an author's personal directory. An installed skill folder is not necessarily the application root.
- Prefer the exact requested file. For a named file, search the requested directory or workspace with `rg --files`; use a scoped filesystem listing if ignored files are omitted. Do not scan unrelated drives by default.
- If the user allows an arbitrary example, select a supported file from the specified folder or the application's synthetic examples and identify your choice. Otherwise clarify materially ambiguous matches.
- Resolve the input to an absolute path before changing working directory. Treat paths as literal arguments; quote spaces and do not interpolate file contents into shell commands.

## Prepare metadata

- POSCAR/CONTCAR: VASP 5/6 element row, one positive scale, Direct or Cartesian, optional Selective dynamics. Direct coordinates outside `[0,1)` are valid; let the viewer wrap them rather than rewriting the source.
- LAMMPS: text data with explicit `Atoms # atomic`, orthogonal or restricted triclinic cell. Read element mapping from `Masses` comments or pass a verified user-supplied `--type-map`. Never guess a map from atom type numbers.
- LAMMPS units and boundaries are not recorded in the data file. Report the default angstrom/ppp assumptions; pass `--pbc` with three `p`/`f` characters when boundaries are known. Other unit systems are not automatically converted.
- Without a complete map, keep the viewable type-colored structure and explain that inferred bonds are disabled.

## Generate the link

Run from the AtomScope application root, substituting the resolved file path:

```sh
node --import tsx scripts/make-view-link.ts examples/structures/molecules.POSCAR
node --import tsx scripts/make-view-link.ts tests/fixtures/water.lmp --type-map 1:O,2:H --pbc ppp
```

- Prerequisites: Node.js 22.13+ and a built checkout. If dependencies or build are missing, follow the checkout README (`npm ci`, then `npm run build`) within the user's setup authorization; retry the link command once. Do not reinstall or rebuild for every structure.
- Keep this workflow loopback-only. Do not pass a remote `--base-url`. If `VIEWER_BASE_URL` or `MAKE_VIEW_BASE_URL` is set, unset it only for the child command/session or explicitly use the local base after verifying that service is running. Do not change persistent environment configuration.
- The CLI starts the background local viewer when needed, prints one URL to stdout, and writes warnings to stderr. Require a successful exit and a complete `http://127.0.0.1:<port>/#s=...` URL. Do not fabricate or shorten its encoded payload.
- Default port is 43117. If another program occupies it, do not terminate that program. Choose a free port via session-local `ATOM_VIEWER_PORT`, then regenerate the link. Use the returned port, not a hardcoded replacement.
- This workflow must run on the computer opening the link. Do not present a remote sandbox's loopback address as accessible on the user's computer.

## Deliver and verify

Return the URL as a Markdown link labelled **Open atomic structure** (or **打开原子结构**), followed by a concise verified filename/format summary. Add atom count, composition and cell dimensions only if checked from the parsed file. Omit absolute source paths unless needed to disambiguate.

The CLI checks service availability, not successful WebGL rendering. If browser access is available, check the loaded structure; otherwise say the link was generated without claiming visual verification. For a reported boundary regression or unwrapped structure, verify wrapped atoms, shortest-image bonds and matching short segments on opposite crossed faces/edges/corners. Long rays or one-sided segments are display-regression candidates, not proof of missing atoms.

Preserve the checkout's default appearance and display controls. Do not change style presets, bond cutoffs, coordinates or periodic logic as part of an ordinary viewing request. Measurements are geometric minimum-image distances and angles, not chemical validation.

## Limits and privacy

- Report unsupported formats and parser line numbers without silently reinterpreting columns: no VASP4, negative/three-component scales, CIF/XYZ/PDB, LAMMPS dump/restart, general triclinic or non-atomic styles.
- If the URL exceeds 100,000 characters, provide the verified local viewer home URL and instruct the user to open/drop the file. Do not upload it or introduce a public short-link service.
- Links contain decodable structure data and a filename; they are not encrypted. Do not include private links, paths, research structures or logs in a repository, issue or public screenshot. The viewer's local-only behavior does not establish the agent provider's privacy policy.
- If startup, parsing or visual verification still fails after the scoped retry, report the exact limitation. Do not weaken scientific or privacy safeguards to produce a success claim.
