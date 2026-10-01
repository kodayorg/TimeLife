# TimeLife public release — direct EXE distribution

Current candidate: 0.1.17. Publisher alias: Koda Yorg. Contact: kodayorg@gmail.com. Intended audience: worldwide. Publisher residence: Russia. Worldwide availability is not a legal certification for every jurisdiction.

## Completed in the project

- MIT license for our own source; preserved licenses for dependencies, fonts, Electron and Chromium.
- Russian and English terms/privacy documents, component notices and preferred ical.js source outside ASAR, accessible in Settings.
- Account disconnect cleans cloud data from current and backup JSON, temporary credentials and memory caches; local events stay intact.
- Public build requires reviewed documents, a public repository, signing configuration/approval and valid timestamped signatures. Preview installers have a different name.

## Remaining external steps

1. Review distribution/legal/terms.html, terms-en.html, privacy.html and privacy-en.html. Confirm the legal publisher details and relevant obligations for the actual publisher and target markets. Koda Yorg is an alias and is not automatically a verified certificate identity. Set documentsApproved in release-publisher.json only after review.
2. The clean source is published at https://github.com/kodayorg/TimeLife. Keep node_modules, release binaries, QA profiles, logs, caches and credentials out of the source repository. Record the reviewed source revision and add a source release/tag when preparing a release.
3. Apply to SignPath Foundation at https://signpath.org/ . Its requirements include OSI-approved licenses for all components, an actively maintained released project, a documented download page, MFA, review/approval roles and verifiable builds. Acceptance and availability to this publisher must be confirmed by the service; they are not guaranteed. Do not purchase a certificate or create accounts on the user's behalf without authorization.
4. After acceptance, configure SignPath according to its approved artifact/build rules, sign the application before it is embedded in the NSIS installer, then sign the completed installer. Use the real approved certificate subject as expectedSignerSubject. Mark signingApproved only after acceptance. Update CODE_SIGNING_POLICY.md with actual provider acknowledgments and public role links.
5. Run the public release checks on the final artifacts, supply a SHA-256 manifest after signing, then upload the EXE, notices, sources and public terms/privacy documents to the download location. Preview binaries must not be relabeled as signed public artifacts.

Azure Artifact Signing public trust is currently unavailable to individual publishers in Russia. Alternative certificate availability requires checking the provider and identity validation. Self-signed certificates do not replace publicly trusted signatures. Signing does not guarantee SmartScreen reputation.

## Commands

`node scripts/prepare-distribution.cjs` — prepare legal resources.

`npm run dist:preview` — isolated unsigned review candidate; not the public release.

`npm run release:check` — prerequisites check; expected to fail before external steps are complete.

`npm run dist` — public Authenticode pipeline for a configured local/store certificate, requiring signing and post-build verification. Set signingRoute appropriately if not using SignPath. Do not put a private key/password in JSON or source files.

`node scripts/check-public-release.cjs --artifacts` — checks final signatures, timestamp, expected identity and packaged notices. A SignPath workflow needs service-approved integration and must produce the same final artifacts; merely setting signingApproved does not perform signing.

Sources: https://www.mozilla.org/en-US/MPL/2.0/FAQ/ ; https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options ; https://signpath.org/terms
