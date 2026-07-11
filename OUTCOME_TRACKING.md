# Outcome Tracking

Public Trade Intel now stores live forward prediction history.

## Stored Prediction Fields

Each recorded prediction includes:

- predictionId
- modelVersion
- ticker
- timeframe
- predictionTimestamp
- evaluationDueAt
- predictedDirection
- unifiedScore
- confidenceTier
- recommendation
- referencePrice
- referencePriceTimestamp
- targetPrice
- stopPrice
- signalSummary
- dataFreshness
- universe
- scanId
- settlementStatus

## Evaluation Windows

- 1-day trade: 1 trading day
- 7-day trade: 7 trading days
- 1-month trade: approximately 21 trading days
- 1-year hold: approximately 252 trading days

Weekends are skipped. Holiday support is prepared for future expansion.

## Settlement Statuses

- pending
- eligible
- settled
- unavailable
- failed

When a prediction reaches its evaluation date but no usable price is available, it becomes `eligible` rather than being settled prematurely.

## Forward Results Only

The Performance Center reports live forward results only. Historical backtests must remain separate and clearly labeled to avoid look-ahead bias.
