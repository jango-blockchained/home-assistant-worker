# Home Assistant Worker

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh) [![Platform](https://img.shields.io/badge/Platform-Cloudflare%20Edge%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/) [![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/) [![Build Status](https://img.shields.io/badge/Build-TODO-lightgrey?style=for-the-badge)](https://github.com/jango-blockchained/hoox-cf-edge-worker/actions) <!-- TODO: Update Build Status link -->

**[Main Repository](https://github.com/jango-blockchained/hoox-cf-edge-worker)** <!-- TODO: Update Main Repo link -->

A Cloudflare Worker service that interacts with the Home Assistant REST API. This worker accepts requests via the standardized `/process` endpoint from the `webhook-receiver` or other authenticated internal services.

## Features

- Calls Home Assistant services (e.g., `light.turn_on`, `script.turn_on`).
- Secure authentication via shared internal key with `webhook-receiver`.
- Uses Home Assistant Long-Lived Access Token for API calls.

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare Workers account
- Home Assistant instance accessible via URL.
- Home Assistant Long-Lived Access Token.

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare account ID in `wrangler.jsonc`.
3.  Configure Secrets and Variables (via Cloudflare dashboard, `wrangler secret put`, or `wrangler.jsonc` for vars):
    - `INTERNAL_KEY_BINDING`: The **shared** secret key used for authentication. Configure using `wrangler secret put INTERNAL_KEY_BINDING`.
    - `HA_SECURE_URL`: The full base URL of your Home Assistant instance (e.g., `https://your-ha.duckdns.org`). Set this as a variable in `wrangler.jsonc` or using `wrangler secret put HA_SECURE_URL`.
    - `HA_TOKEN`: Your Home Assistant Long-Lived Access Token. Set this using `wrangler secret put HA_TOKEN`.
4.  Update `wrangler.jsonc` with appropriate bindings and variables. Example:
    ```jsonc
    {
      "name": "home-assistant-worker",
      "main": "src/index.ts",
      "compatibility_date": "2025-03-07",
      "compatibility_flags": ["nodejs_compat"],
      "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
      "vars": {
        "HA_SECURE_URL": "https://your-ha.duckdns.org" // Or null if using secrets
      },
      "secrets": [
        "INTERNAL_KEY_BINDING",
        "HA_TOKEN",
        "HA_SECURE_URL" // Include here if using secrets instead of vars
      ],
      "observability": {
         "enabled": true,
         "head_sampling_rate": 1
      }
    }
    ```
5.  Update the corresponding `worker-configuration.d.ts` file.
6.  For local development, create a `.dev.vars` file and define the secrets/variables:
    ```.dev.vars
    HA_SECURE_URL="https://your-local-or-remote-ha-url"
    HA_TOKEN="your_ha_long_lived_token"
    # Mock secret bindings for local dev:
    INTERNAL_KEY_BINDING="your_shared_internal_secret"
    ```
    _(Note: For local dev, ensure the worker can reach your HA instance URL)._

## Development

Run locally:

```bash
bun run dev
```

Deploy:

```bash
bun run deploy
```

## API Interface

This worker **only** accepts requests from authenticated internal services (like `webhook-receiver`) on the `/process` endpoint.

- **Method:** `POST`
- **Endpoint:** `/process`
- **Content-Type:** `application/json`
- **Expected Request Body:**

  ```json
  {
    "requestId": "<uuid_from_caller>",
    "internalAuthKey": "YOUR_INTERNAL_SHARED_SECRET", // Validated against INTERNAL_KEY_BINDING
    "payload": {
      // --- Home Assistant specific payload fields below ---
      "action": "light.turn_on", // Required (HA service call, e.g., "light.turn_off", "script.turn_on")
      "entity_id": "light.living_room", // Required (Target entity ID in HA)
      "data": { // Optional (Service data, e.g., brightness, rgb_color)
        "brightness": 128,
        "rgb_color": [255, 0, 0]
      }
    }
  }
  ```