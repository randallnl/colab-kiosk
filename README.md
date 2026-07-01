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

   In production, the Worker reads the Monday.com token from the `MONDAY_API_TOKEN` Secret Store binding. For local development, `.dev.vars` uses the same `MONDAY_API_TOKEN` name.

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

- `MONDAY_API_TOKEN`: Cloudflare Secret Store binding for the Monday.com API token. The current Secret Store secret name is `Central_Monday_API_TOKEN`.
- `MEMBERS_BOARD_ID`: Monday.com board ID for member lookup.
- `FEEDBACK_BOARD_ID`: Monday.com board ID for activity, guest pass, and feedback submissions.
- `DONATION_URL`: URL used to generate the guest pass donation QR code.

## Shared Monday.com token

Use this Secret Store binding pattern to share the same Monday.com API token across Cloudflare Workers projects without copying the token into each repo:

```jsonc
{
  "secrets_store_secrets": [
    {
      "binding": "MONDAY_API_TOKEN",
      "store_id": "2b9ec8a0d6d742649ad4d3498815ca54",
      "secret_name": "Central_Monday_API_TOKEN"
    }
  ]
}
```

In Worker code, Secret Store bindings are objects, not plain strings. Read the value with `.get()`:

```js
const token = await env.MONDAY_API_TOKEN.get();
```

The `binding` name is what Worker code uses: `env.MONDAY_API_TOKEN`. The `secret_name` is the shared secret stored in Cloudflare: `Central_Monday_API_TOKEN`.

Do not use `env.MONDAY_API_TOKEN` directly as a string, and do not put the token value in `wrangler.jsonc`, `.dev.vars`, source code, or chat. If Monday.com auth fails after deployment, check that the `secret_name` casing exactly matches Cloudflare. In this project it is `Central_Monday_API_TOKEN`, not all caps.
