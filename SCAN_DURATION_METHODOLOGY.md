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

The displayed duration uses total scan lifecycle time, not only the final save/publish step.

## Consistency Checks

Before scan health is published, metadata checks verify that total duration is not shorter than major stage durations by more than normal overhead. If a mismatch exists, the scan diagnostic is marked inconsistent and raw details remain available in Admin.
