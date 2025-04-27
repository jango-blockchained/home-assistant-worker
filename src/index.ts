import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { callHaService } from "./haService";

// Define types for Cloudflare Bindings
export interface Env {
  HA_SECURE_URL: string;
  HA_TOKEN: string;
  INTERNAL_KEY_BINDING: {
    get: () => Promise<string | null>; // Define structure for secret binding
  };
  // Add other bindings if needed
}

// --- Schemas ---

// Schema for the specific HA task payload expected within the standardized request
const haPayloadSchema = z.object({
  action: z.enum([
    "light.turn_on",
    "light.turn_off",
    "light.toggle",
    "homeassistant.update_entity",
    "automation.trigger",
    "script.turn_on",
    // Add other HA actions as needed
  ]),
  entity_id: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

// Schema for the standardized incoming request from the webhook-receiver
const standardizedRequestSchema = z.object({
  requestId: z.string().uuid(),
  internalAuthKey: z.string().min(1),
  payload: haPayloadSchema, // Nested payload specific to this worker
});

// --- Hono App ---

const app = new Hono<{ Bindings: Env }>();

// --- Middleware for Internal Authentication ---

app.use("/process", async (c, next) => {
  try {
    const body = await c.req.json();
    const internalAuthKey = body?.internalAuthKey;
    const storedKey = await c.env.INTERNAL_KEY_BINDING?.get();

    if (!storedKey) {
      console.error(
        "INTERNAL_KEY_BINDING secret is not configured on home-assistant-worker."
      );
      return c.json(
        { success: false, error: "Internal configuration error", result: null },
        500
      );
    }

    if (!internalAuthKey || internalAuthKey !== storedKey) {
      console.warn(`Authentication failed for request ID: ${body?.requestId}`);
      return c.json(
        { success: false, error: "Authentication failed", result: null },
        403
      );
    }

    // Store the validated body in context to avoid re-parsing (optional but good practice)
    c.set("validatedRequestBody", body);
    await next();
  } catch (error) {
    console.error("Error during authentication middleware:", error);
    return c.json(
      {
        success: false,
        error: "Invalid request format or internal error",
        result: null,
      },
      400
    );
  }
});

// --- Main Processing Route ---

app.post(
  "/process",
  zValidator("json", standardizedRequestSchema, (result, c) => {
    // Custom error handler for Zod validation
    if (!result.success) {
      console.error(
        "Standardized request validation failed:",
        result.error.issues
      );
      return c.json(
        {
          success: false,
          error: "Invalid request body structure.",
          details: result.error.issues, // Optionally include details
          result: null,
        },
        400
      );
    }
  }),
  async (c) => {
    // Retrieve the body validated by middleware AND Zod
    // const body = c.req.valid('json'); // Use if not using context
    const body = c.get("validatedRequestBody");

    const { payload } = body; // Extract the HA-specific payload
    const env = c.env;

    console.log(
      `Processing HA request ID: ${body.requestId} for entity: ${payload.entity_id}`
    );

    try {
      const [domain, service] = payload.action.split(".");
      const result = await callHaService(
        env.HA_SECURE_URL,
        env.HA_TOKEN,
        domain,
        service,
        payload.entity_id,
        payload.data
      );
      // Return standardized success response
      return c.json({ success: true, result: result, error: null });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error || "Failed to call Home Assistant service");
      console.error(
        `Error calling Home Assistant for request ID ${body.requestId}:`,
        error
      );
      // Return standardized error response
      return c.json(
        {
          success: false,
          error: errorMsg,
          result: null,
        },
        500 // Or potentially pass through status code from callHaService if available/relevant
      );
    }
  }
);

// Keep a simple health check endpoint (optional)
app.get("/", (c) => {
  return c.text("Home Assistant Worker is running!");
});

export default app;
