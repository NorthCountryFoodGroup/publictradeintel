# Deploy PublicTradeIntel.com

This app is ready to run as a Node web service.

## 1. Put the app on GitHub

Create a new GitHub repository named:

```text
publictradeintel
```

Upload everything inside this folder:

```text
outputs/starting-money-app
```

## 2. Create the Render service

1. Go to Render.
2. Create a new **Web Service**.
3. Connect the `publictradeintel` GitHub repo.
4. Use these settings:

```text
Name: publictradeintel
Runtime: Node
Build Command: leave blank
Start Command: node server.js
```

5. Add environment variables:

```text
ADMIN_PIN=your-private-admin-pin
POLICY_REFRESH_MS=3600000
<<<<<<< HEAD
CONGRESS_REFRESH_MS=3600000
=======
>>>>>>> a2402b6eaefdbf55188d33f6fe53551a966d591a
```

Optional:

```text
ALPHA_VANTAGE_API_KEY=your-market-data-key
<<<<<<< HEAD
CONGRESS_TRADES_FEED_URL=your-json-or-csv-congressional-trading-feed
CONGRESS_TRADES_API_KEY=your-provider-key-if-needed
=======
>>>>>>> a2402b6eaefdbf55188d33f6fe53551a966d591a
```

## 3. Add the domain in Render

In the Render service, open **Settings** then **Custom Domains**.

Add:

```text
publictradeintel.com
www.publictradeintel.com
```

Render will show DNS records to create.

## 4. Update DNS where you bought the domain

At your domain registrar, add the exact DNS records Render gives you.

Common pattern:

```text
www    CNAME    your-render-hostname.onrender.com
@      A/CNAME/ALIAS value shown by Render
```

Use Render's exact values, because the root domain setup can vary by registrar.

## 5. Wait for SSL

DNS and HTTPS can take a few minutes to a few hours.

When ready:

```text
https://publictradeintel.com
https://www.publictradeintel.com
```

## 6. Admin

Admin page:

```text
https://publictradeintel.com/admin.html
```

Use the `ADMIN_PIN` you set in Render.

## Important data note

This app currently stores admin edits and scan results in local JSON files. On many cloud hosts, local files can reset on redeploy unless persistent storage is added. For production, the next upgrade should be a small database.
