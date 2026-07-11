# Render Persistence

Render filesystem behavior matters: service filesystems should be treated as ephemeral unless a persistent disk or database is configured.

## Symbol Universe

The app now ships a packaged public snapshot:

`data/publicSymbolSnapshot.json`

Production startup can use that packaged public snapshot even when runtime cache files are missing after deploy or restart.

Runtime refresh may write:

`data/symbolUniverse.json`

That file is a runtime cache and should not be the only source of production coverage.

## Prediction History And Outcomes

Current JSON files are useful for private beta and local testing, but they should not be treated as durable long-term storage on Render without persistent storage.

Runtime files include:

- `data/predictionHistory.json`
- `data/outcomeStatus.json`
- `data/predictions.json`

For durable historical performance tracking, use a database or Render persistent disk.

Admin should treat JSON-only history as beta storage and avoid claiming permanent tracking until persistent storage is configured.
