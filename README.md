# Home Assistant Worker

A Cloudflare Worker service that interacts with the Home Assistant REST API. This worker accepts requests via the standardized `/process` endpoint from the `webhook-receiver` or other authenticated internal services.

## Features

- Calls Home Assistant services (e.g., `light.turn_on`, `script.turn_on`).
- Secure authentication via shared internal key with `webhook-receiver`.
- Uses Home Assistant Long-Lived Access Token for API calls.

## Prerequisites

- Node.js >= 16
- Bun (or npm/yarn)
- Wrangler CLI
- Cloudflare Workers account
- Home Assistant instance accessible via URL.
- Home Assistant Long-Lived Access Token.

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare account ID in `wrangler.toml`.
3.  Configure Secrets (via Cloudflare dashboard Secrets Store or `wrangler secret put`):
    *   `WEBHOOK_INTERNAL_KEY`: The **shared** secret key used for authentication with the `webhook-receiver`. Bind this to `INTERNAL_KEY_BINDING` in `wrangler.toml`.
    *   `HA_SECURE_URL`: The full base URL of your Home Assistant instance (e.g., `https://your-ha.duckdns.org`). Bind this to the `HA_SECURE_URL` *variable* (not secret binding) in `wrangler.toml` or use `wrangler secret put HA_SECURE_URL`.
    *   `HA_TOKEN`: Your Home Assistant Long-Lived Access Token. Bind this to the `HA_TOKEN` *variable* or use `wrangler secret put HA_TOKEN`.
4.  For local development, create a `.dev.vars` file and define the URLs and secrets:
    ```.dev.vars
    HA_SECURE_URL="https://your-local-or-remote-ha-url"
    HA_TOKEN="your_ha_long_lived_token"
    # Mock secret bindings for local dev:
    INTERNAL_KEY_BINDING="your_shared_internal_secret"
    ```
    *(Note: For local dev, ensure the worker can reach your HA instance URL).* 

## Development

Run locally (e.g., on port 8791):
```bash
bun run dev --port 8791
```

Deploy:
```bash
bun run deploy
```

## API Interface

This worker **only** accepts requests from the `webhook-receiver` (or another authenticated internal service) on the `/process` endpoint.

- **Method:** `POST`
- **Endpoint:** `/process`
- **Content-Type:** `application/json`
- **Expected Request Body:**
  ```json
  {
    "requestId": "<uuid_from_receiver>",
    "internalAuthKey": "YOUR_INTERNAL_SHARED_SECRET", // Validated against INTERNAL_KEY_BINDING
    "payload": {
      // --- Home Assistant specific payload fields below ---
      "action": "light.turn_on",       // Required (HA service call, e.g., "light.turn_off", "script.turn_on")
      "entity_id": "light.living_room", // Required (Target entity ID in HA)
      "data": {                       // Optional (Service data, e.g., brightness, rgb_color)
        "brightness": 128,
        "rgb_color": [255, 0, 0]
      }
    }
  }
  ```

- **Response Format:**

  **Success:**
  ```json
  {
    "success": true,
    "result": [ /* Raw JSON response from HA API (often an array of state objects or empty) */ ],
    "error": null
  }
  ```

  **Error:**
  ```json
  {
    "success": false,
    "result": null,
    "error": "<Error message describing the failure (e.g., Authentication failed, Missing action in payload, Home Assistant API request failed: ...)>"
  }
  ```

## Security

- All requests *must* be received on the `/process` endpoint.
- Requests *must* include a valid `internalAuthKey` in the body, matching the `WEBHOOK_INTERNAL_KEY` secret.
- The Home Assistant URL and Token should be stored securely (e.g., via Cloudflare Secrets or environment variables in `wrangler.toml`).
