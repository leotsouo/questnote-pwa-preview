# QuestNote PWA Preview
This repository contains preview builds for QuestNote iPhone PWA performance and release QA.
For the main project, source development, and project documentation, see [QuestNote](https://github.com/leotsouo/questnote-pwa).
## Repository role
- Preview runtime: HTML, CSS, JavaScript, a web app manifest, and a service worker
- Release provenance: `release-artifact.json` records the source commit, artifact identity, and validation state
- This preview is a testing target; its presence does not mean a release has passed every release gate
## Before using a preview
Check the current artifact's validation and release-readiness fields. Preview behavior and stored data may differ from the main application. Use test data when evaluating builds.
For development and release instructions, start with the main repository rather than treating these deployed artifacts as a separate product.
