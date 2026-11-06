# Privacy and source distribution

Structure files are read in the browser. The default local launcher binds to loopback only; it does not expose the viewer to the local network. Installing dependencies requires network access. A URL fragment contains structure coordinates and the supplied filename: anyone who receives the full URL can decode them. Do not treat links as encrypted or anonymous.

This source distribution uses a fresh Git history. It excludes previous project history, development notes, research snapshots, screenshots, source-data fingerprints, private local paths and account-specific deployment identifiers. The included structure fixtures are synthetic regression examples, not research results.

Only descriptive style metadata was generalized. Numeric rendering settings, scientific parsing, inferred-bond rules, periodic geometry, measurements and UI behavior are preserved. `.openai/hosting.json` contains a neutral local placeholder, not a hosted project binding.

Generated dependencies, renderer bundles, application builds, caches and verification artifacts are ignored. Create a source ZIP with `git archive`, not by compressing the entire working directory after development: local build outputs can contain machine paths.

Do not assume future edits are sanitized. Inspect staged changes, author/committer identity and any new datasets before publishing. Automated pattern checks are useful but cannot prove the absence of every kind of sensitive information. Third-party attribution must be retained.
