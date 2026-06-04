# Tractors Together

This repository contains the static Tractors Together dashboard and the Telegram import tooling used to build its runtime dataset.

## Dataset source of truth

`src/lib/telegramImport.js` is the source code for turning a raw Telegram export into the enriched runtime dataset. The generated `data/messages_enriched.json` file is deploy data, not app source. Routine message-data refreshes should be produced in CI or a local release flow and should not be reviewed in normal app-code pull requests.

The repository still keeps `data/messages_enriched.json` available for hosts that need the runtime file committed. It is marked as generated/binary in `.gitattributes` so pull request UIs do not try to render a massive row-by-row JSON diff.

## Telegram import input

Raw Telegram export files are local/generated inputs and should not be committed. Put the Telegram export at `data/result.json` before running a release import:

```sh
node scripts/runTelegramImport.js
```

The raw export paths are ignored by git. Running the import regenerates `data/messages_enriched.json` for the app to consume.

## Build the deploy artifact

For CI or a local release, place the raw Telegram export at `data/result.json`, then run:

```sh
node scripts/buildDeployArtifact.js
```

The release script runs `node scripts/runTelegramImport.js`, creates a clean deploy output folder (`dist/` by default), copies the static dashboard files, and copies the generated dataset to `dist/data/messages_enriched.json`.

To use another output folder, pass it as the first argument or set `DEPLOY_DIR`:

```sh
node scripts/buildDeployArtifact.js build
# or
DEPLOY_DIR=build node scripts/buildDeployArtifact.js
```

Deploy the contents of that output folder. Avoid mixing routine generated message-data changes into pull requests that are otherwise about application code.
