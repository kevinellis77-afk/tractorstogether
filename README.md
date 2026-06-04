# Tractors Together

This repository contains the static Tractors Together dashboard and the Telegram import tooling used to build its runtime dataset.

## Runtime dataset

The deployable dashboard reads from `data/messages_enriched.json`. Keep that enriched file available for deployments, or generate it as part of the deployment/CI pipeline before publishing the static app.

## Telegram import input

Raw Telegram export files are local/generated inputs and should not be committed. The import script expects a Telegram export to be supplied locally at `result.json` in the repository root, or at `data/result.json`, before it runs:

```sh
node scripts/runTelegramImport.js
```

For CI or deployment automation, download, decrypt, or otherwise provide the raw Telegram export (`result.json` or `data/result.json`) before invoking `scripts/runTelegramImport.js`. The raw export paths are ignored by git, and the script will regenerate `data/messages_enriched.json` for the app to consume.
