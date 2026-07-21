# Controlled Beta Launch

This release is a single-instance, shared-PIN proof of concept. It is not an unrestricted multi-user service.

## Render settings

- Service: `publictradeintel`
- Runtime: Node.js
- Node: `24.18.x` LTS
- Build command: `npm install`
- Start command: `node server.js`
- Instance count: `1`
- Health check: `/healthz`
- Persistent disk: `publictradeintel-data`, 1 GB, mounted at `/var/data`
- Runtime data root: `DATA_DIR=/var/data`

Required secrets configured manually in Render are `LOGIN_PIN`, `ADMIN_PIN`, and `PORTFOLIO_PIN`. They must be strong and distinct. `ALPHA_VANTAGE_API_KEY` is required for real market data. `CONGRESS_TRADES_FEED_URL` and `CONGRESS_TRADES_API_KEY` are optional provider settings.

Required safe settings are:

```text
NODE_ENV=production
DATA_DIR=/var/data
DECISION_LAB_ENABLED=false
V3_SHADOW_ENABLED=false
PRODUCTION_ORDER_EXECUTION_ENABLED=false
```

The Render Blueprint declares the disk. Confirm once in the Render dashboard that the disk is attached at `/var/data`, the service has one instance, and all secrets are configured before the first deploy.

## Verification

After deployment, request `/healthz` and confirm `status` and `persistence` are `healthy`. Log in, load stored predictions, run one explicit scan, and restart the same deploy. Confirm predictions remain beneath the persistent data root after restart.

Sessions are process-memory-only and are intentionally invalidated by a restart. Shared PIN access is acceptable only for this finite controlled beta.

Decision Lab is disabled and has no page or API. V3 shadow execution is disabled and legacy remains the production selector. Production order execution is prohibited; setting its flag to true prevents startup.

## Backup and rollback

Before deploying, take a Render disk snapshot or copy the runtime JSON files from the persistent disk through an authorized private administrative procedure. Do not assume automated backups exist.

For code rollback, redeploy the previous successful Render commit. Code rollback does not roll back persistent JSON. If data rollback is also required, stop writes, restore the reviewed disk snapshot, then restart the single service instance and verify `/healthz` plus stored predictions.
