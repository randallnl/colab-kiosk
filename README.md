# CoLab Kiosk

Cloudflare Worker for the CoLab Activity Station kiosk. It serves the kiosk UI, loads eligible members from Monday.com, and submits activity logs, guest passes, and feedback into Monday.com.

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create local secrets:

   ```sh
   cp .dev.vars.example .dev.vars
   ```

3. Fill in `.dev.vars` with the Monday.com token and board IDs.

   In production, the Worker reads the Monday.com token from the `Monday_Central_API_TOKEN` Secret Store binding. For local development, `.dev.vars` may use `MONDAY_API_TOKEN`.

4. Start local development:

   ```sh
   npm run dev
   ```

The Worker will run locally through Wrangler, usually at `http://localhost:8787`.

## Scripts

- `npm run dev` starts Wrangler local development.
- `npm run check` runs a Wrangler deploy dry run.
- `npm run deploy` deploys the Worker to Cloudflare.
- `npm run types` generates Worker binding types.

## Production bindings

The Worker expects these production bindings:

- `Monday_Central_API_TOKEN`: Cloudflare Secret Store binding for the Monday.com API token. The current Secret Store secret name is `MONDAY_API_TOKEN`.
- `MEMBERS_BOARD_ID`: Monday.com board ID for member lookup.
- `FEEDBACK_BOARD_ID`: Monday.com board ID for activity, guest pass, and feedback submissions.
- `DONATION_URL`: URL used to generate the guest pass donation QR code.
