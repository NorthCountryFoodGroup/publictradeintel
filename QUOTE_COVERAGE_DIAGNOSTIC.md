# Quote Coverage Diagnostic

Public Trade Intel separates overall market-data availability from provider-specific quote coverage.

## What 29 of 300 Means

A small Yahoo quote-success number does not automatically mean only that many predictions have usable data. The completed scan now reports:

- Total deep-analysis symbols.
- Yahoo attempted symbols.
- Yahoo not-attempted symbols.
- Yahoo successful symbols.
- Yahoo attempt success rate.
- Yahoo prediction contribution percentage.
- Symbols served from cached fresh data.
- Symbols served from saved quote fallback.
- Symbols served from previously refreshed broad-screen data.
- Symbols served from another provider.
- Symbols with fallback-generated values.
- Symbols with no fresh provider quote.

## Why Yahoo May Be A Subset

Yahoo can be a primary quote provider while still only being requested for symbols that need a refresh. If the scan already has usable broad-screen data or cached fresh data, the engine can avoid requesting that symbol again.

The user dashboard shows a short summary. Admin diagnostics show the full provider breakdown.

## Status Language

- Overall availability uses the shared backend thresholds in `marketDataAvailabilityFromCoverage`.
- Provider health uses attempted success rate, rate-limit status, disabled status, and whether the provider was needed.
- Provider contribution explains how much of the final prediction set came from that provider.

