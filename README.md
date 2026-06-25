# PublicTradeIntel

A private, mobile-friendly portfolio and AI trading research dashboard for tracking holdings, market prices, congressional trades, policy catalysts, and prediction-engine scores.

Production domain:

```text
publictradeintel.com
```

## Run locally

```powershell
node server.js
```

If `node` is not on your PATH, use the bundled Codex Node runtime or install Node.js.

Open:

- Public app: `http://localhost:3000`
- Admin backend: `http://localhost:3000/admin.html`

## Security

```powershell
$env:LOGIN_PIN="your-login-pin"
$env:ADMIN_PIN="your-secure-pin"
$env:PORTFOLIO_PIN="your-portfolio-pin"
node server.js
```

There is no default admin PIN. Set `LOGIN_PIN`, `ADMIN_PIN`, and `PORTFOLIO_PIN` in Render before using the deployed app.

## Admin

The admin page can edit:

- emergency fund safety targets
- tiny investing cap while debt exists
- beginner weekly paths
- micro-goal labels and targets
- stock idea watchlist and scoring inputs
- Congress trade tracker entries

## Fastest Growth Buy Recommendations model

The public app ranks stock candidates with an aggressive, transparent growth-potential score. The score emphasizes:

- congressional buy activity and disclosure signal strength
- estimated growth after disclosed congressional entry prices
- press-release or business catalyst score
- committee relevance score
- market momentum
- quality as a secondary confirmation signal
- growth-stock volatility as a small upside/risk signal

The ranking is designed to surface fastest-growth buy candidates from the app's imported congressional trading data and admin-maintained catalyst metrics.

## Buy Today / Sell Today model

The same-day section ranks short-window trade candidates using:

- momentum score
- volatility opportunity
- fresh press/catalyst urgency
- committee relevance
- recent congressional buys
- high-visibility congressional trade overlap
- current market move when refreshed market data is available

This section is intentionally aggressive and designed for same-day idea generation.

## Congress trade alerts

The public app shows recent congressional buy and sell disclosure alerts. Alerts are generated from the imported `congressTrades` data and sorted by most recent reported date.

## Policy catalyst monitor

The server scans configured public policy sources hourly while it is running. It looks for company/ticker terms plus policy language that may indicate positive or negative stock impact.

Default scan interval:

```text
1 hour
```

Override for testing:

```powershell
$env:POLICY_REFRESH_MS="300000"
node server.js
```

The admin page also has **Refresh policy signals** to run a scan immediately.

The public app displays leveled strategy cards:

- Level 1 aggressive buy
- Level 2 watch / starter buy
- Level 3 monitor
- Level 4 avoid or short-watch

The scanner stores results in `data/policySignals.json`.

## Live congressional trading feed

Set this environment variable to connect a real congressional trading data source:

```text
CONGRESS_TRADES_FEED_URL=https://your-provider-or-dataset-url
```

Optional API key:

```text
CONGRESS_TRADES_API_KEY=your-provider-key
```

Refresh interval:

```text
CONGRESS_REFRESH_MS=3600000
```

The app accepts JSON or CSV. JSON can be either an array or an object with one of these array fields:

```text
trades
transactions
results
data
items
```

Supported input field aliases include:

```text
representative, member, name
ticker, symbol
company, asset, assetName
transaction, type
reportedRange, amount, range
reportedDate, date, filingDate
entryPrice, price, purchasePrice
sourceUrl, source
```

Admin has a **Refresh congress feed** button. The server also refreshes hourly while running if `CONGRESS_TRADES_FEED_URL` is set.

## Deploy publictradeintel.com

Recommended simple host: Render Web Service.

Required environment variables:

```text
ADMIN_PIN=choose-a-real-private-pin
PORT=10000
```

Optional:

```text
ALPHA_VANTAGE_API_KEY=your-market-data-key
CONGRESS_TRADES_FEED_URL=https://your-provider-or-dataset-url
CONGRESS_TRADES_API_KEY=your-provider-key-if-needed
CONGRESS_REFRESH_MS=3600000
POLICY_REFRESH_MS=3600000
```

After deployment, add these custom domains in Render:

```text
publictradeintel.com
www.publictradeintel.com
```

Render will show the exact DNS records to add at your domain registrar. Usually this means:

- `CNAME` for `www` pointing to the Render hostname
- root/apex record for `publictradeintel.com` using Render's provided target

Use HTTPS/SSL when Render finishes validating the domain.

## Optional market data refresh

The app can refresh ticker quotes through Alpha Vantage if you provide an API key:

```powershell
$env:ALPHA_VANTAGE_API_KEY="your-api-key"
node server.js
```

Then open the admin page and click **Refresh market data**. Without the key, the app still works with manually maintained scores.

## Congress trade import

The admin page includes a bulk JSON import box for public disclosure data. Each entry can include:

```json
{
  "representative": "Nancy Pelosi",
  "state": "CA",
  "party": "D",
  "ticker": "NVDA",
  "company": "NVIDIA",
  "transaction": "Buy",
  "reportedRange": "$1,001 - $15,000",
  "reportedDate": "2026-01-15",
  "entryPrice": 125.5,
  "entryPriceSource": "Estimated close price on reported date",
  "sourceUrl": "https://disclosures-clerk.house.gov/FinancialDisclosure",
  "watchReason": "Imported public disclosure. Review the filing before using as a signal.",
  "signalScore": 50,
  "conflictRisk": "Imported watch"
}
```

Official disclosure search pages:

- House: `https://disclosures-clerk.house.gov/FinancialDisclosure`
- Senate: `https://efdsearch.senate.gov/search/`

## Phone app behavior

This is a Progressive Web App. When hosted over HTTPS, users can add it to their phone home screen:

- iPhone: Share button, then Add to Home Screen
- Android: browser menu, then Install app or Add to Home screen

The app also has a service worker for basic offline loading after the first visit.

## Privacy note

The backend records only recommendation totals for the admin dashboard. It does not store each user's cash, bills, debt, or other personal input values.
