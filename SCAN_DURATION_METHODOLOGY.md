# Scan Duration Methodology

Scan duration starts immediately when a prediction scan begins and ends after predictions are saved and published.

## Stage Durations

The app records:

- `universeLoadDuration`
- `broadScreenDuration`
- `candidateSelectionDuration`
- `quoteRefreshDuration`
- `deepAnalysisDuration`
- `rankingDuration`
- `validationDuration`
- `saveDuration`
- `publishDuration`
- `totalDuration`
- `totalWallClockTimeMs`
- `parallelStageTiming`

The displayed duration uses total scan lifecycle wall-clock time, not only the final save/publish step.

## Parallel Stage Timing

Some stage timings are measured independently and can overlap. For example, broad discovery, quote refresh, deep analysis, ranking, and publishing can be recorded as separate durations without implying the user waited for the sum of every stage.

The dashboard labels this as Total Wall Clock Time and Parallel Stage Timing.

## Consistency Checks

Before scan health is published, metadata checks verify timestamp consistency, universe counts, prediction counts, and availability labels. Parallel stage durations are informational and are not treated as sequential totals.
