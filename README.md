# Tractors Together

This repository contains the static Tractors Together dashboard and the Telegram import tooling used to build its runtime dataset.

## Runtime dataset

The deployable dashboard reads from `data/messages_enriched.json`. Keep that enriched file available for deployments, or generate it as part of the deployment/CI pipeline before publishing the static app.

## Telegram import input

Raw Telegram export files are local/generated inputs and should not be committed. Supply `result.json` locally at the repository root, or as `data/result.json`, before running the import script:

```sh
node scripts/runTelegramImport.js
```

In CI or deployment automation, download or otherwise provide the raw Telegram export (`result.json`) before invoking `scripts/runTelegramImport.js`; the script will regenerate `data/messages_enriched.json` for the app to consume.
