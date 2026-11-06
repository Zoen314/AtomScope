# Source export validation

Verified locally on Windows with a fresh dependency installation:

- `npm ci --no-audit --no-fund`: installation completed from the lockfile.
- `npm test`: 80 tests passed across 12 files.
- `npx tsc --noEmit` and targeted UI ESLint: passed.
- `npm run build`: passed. Existing public/output-directory overlap and route-classification warnings remain informational.
- `npm run check:privacy`: no findings in tracked source. Additional export-time checks found no original personal identity markers or deployment identifiers.
- Numeric style settings were compared with the functional baseline and are identical. UI, parser, bond inference, PBC, measurement and URL implementation files were copied without edits.
- The standalone build was opened on a separate loopback port. The six-atom POSCAR fixture measured a periodic distance of 1.000000 angstrom and a periodic angle of 90.0000 degrees.
- The LAMMPS water fixture loaded as three atoms and two inferred bonds; its O1–H2 distance was 0.960000 angstrom. Copying its link and reloading restored the structure.
- The generalized paired-file audit passed for the synthetic POSCAR/LAMMPS water pair without a private dataset path.

No original development history or private research files are included. The initial commit uses a neutral author/committer identity. No remote push or deployment was performed.

These are bounded software checks, not scientific validation, a full security audit, or a guarantee against every future privacy leak. GitHub-hosted CI and non-Windows runtime compatibility have not been verified in this pass.
