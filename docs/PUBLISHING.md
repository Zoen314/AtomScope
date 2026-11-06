# Publishing checklist

- Choose a license for original application code; third-party licenses do not automatically license the application.
- Keep the lockfile, third-party notices and required dependency attribution.
- Run `npm ci`, `npm run check:privacy`, `npm test`, `npx tsc --noEmit`, `npx eslint app lib/ui-text.ts`, and `npm run build`.
- Review `git diff --cached` and `git log --format=fuller` before a push. Use your GitHub-provided privacy email if you want commits associated with your account without disclosing a personal address.
- The initial source export uses the neutral identity `AtomScope Contributors <maintainers@example.invalid>`. It is not a contact address or a verified GitHub account. No original development commits are included.
- Keep credentials, local logs, screenshots, private structures and encoded structure URLs out of the repository. Ignoring a path does not untrack existing files.
- Package only the reviewed commit: `git archive --format=zip --prefix=AtomScope/ --output=../AtomScope-source.zip HEAD`.
- Public hosting is optional and separate from local use. The local placeholder configuration is not a public deployment. No remote repository or deployment is configured by this export.

See [PRIVACY.md](PRIVACY.md) for data-handling boundaries.
