"use strict";
const { OUTCOME_CONTRACT_VERSION } = require("./constants"); const { pathDrawdown, pathVolatility, direction } = require("./analytics");
function evaluateOutcome(forecast, actualBars, evaluationTime = new Date().toISOString()) {
  const maturity = Date.parse(forecast.forecastEndAt); if (!Number.isFinite(maturity) || Date.parse(evaluationTime) < maturity) return { status: "immature", forecastId: forecast.id };
  const eligible = actualBars.filter((row) => Date.parse(row.timestamp) >= Date.parse(forecast.forecastStartAt) && Date.parse(row.timestamp) <= maturity); if (eligible.length < forecast.forecastObservationCount) return { status: "incomplete", forecastId: forecast.id };
  const actualStartPrice = forecast.inputBars.at(-1).close, actualEndingPrice = eligible.at(-1).close, realizedReturn = actualEndingPrice / actualStartPrice - 1, realizedDirection = direction(realizedReturn), forecastReturn = forecast.signal.medianExpectedReturn;
  return { contractVersion: OUTCOME_CONTRACT_VERSION, status: "matured", forecastId: forecast.id, ticker: forecast.ticker, forecastGeneratedAt: forecast.createdAt, forecastHorizon: forecast.forecastHorizon, evaluationTimestamp: new Date(Date.parse(evaluationTime)).toISOString(), actualStartPrice, actualEndingPrice, realizedReturn, realizedDirection, realizedVolatility: pathVolatility(eligible), realizedMaximumDrawdown: pathDrawdown(eligible), forecastDirection: forecast.signal.direction, forecastMedianReturn: forecastReturn, directionCorrect: forecast.signal.direction === realizedDirection, returnError: forecastReturn - realizedReturn, volatilityError: forecast.signal.forecastVolatility - pathVolatility(eligible), dataCompleteness: eligible.length / forecast.forecastObservationCount };
}
module.exports = { evaluateOutcome };
