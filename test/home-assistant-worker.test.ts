import { describe, expect, test, beforeEach, jest } from "@jest/globals";
import { Hono } from "hono";
import app from "../src/index"; // Assuming default export is the Hono app
import { callHaService } from "../src/haService";
import { Env } from "../src/index"; // Import Env type
import { mock } from "bun:test"; // Import Bun's mock function

// Mock the haService module using bun:test mock
mock.module("../src/haService", () => ({
  callHaService: jest.fn(), // Still use jest.fn() for the mock implementation itself
}));

// Get a reference to the mocked function
const mockCallHaService = callHaService as jest.Mock;

describe("Home Assistant Worker", () => {
  const TEST_INTERNAL_KEY = "test-internal-ha-key";
  const TEST_HA_URL = "http://mock-ha.local:8123";
  const TEST_HA_TOKEN = "mock-ha-token";
  const TEST_REQUEST_ID = "a1b2c3d4-e5f6-7890-1234-567890abcdef";

  // Mock Environment Setup
  const createMockEnv = (secrets: Partial<Env> = {}): Env => ({
    HA_SECURE_URL: secrets.HA_SECURE_URL ?? TEST_HA_URL,
    HA_TOKEN: secrets.HA_TOKEN ?? TEST_HA_TOKEN,
    INTERNAL_KEY_BINDING: {
      get: jest.fn().mockResolvedValue(secrets.INTERNAL_KEY_BINDING?.get ? secrets.INTERNAL_KEY_BINDING.get() : TEST_INTERNAL_KEY),
    },
    // Ensure all properties of Env are present, even if undefined/mocked
    ...(secrets as Env), // Spread provided secrets, potentially overwriting defaults
  });

  let mockEnv: Env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv = createMockEnv();
    // Reset HA service mock behavior
    mockCallHaService.mockResolvedValue({ success: true, details: "mock success" });
  });

  // --- Authentication Tests ---

  test("rejects request with missing internalAuthKey", async () => {
    const invalidRequestPayload = {
      requestId: TEST_REQUEST_ID,
      // internalAuthKey: missing
      payload: {
        action: "light.turn_on",
        entity_id: "light.living_room",
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidRequestPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(403); // Authentication middleware should reject
    const body = await response.json();
    expect(body.error).toBe("Authentication failed");
    expect(mockEnv.INTERNAL_KEY_BINDING.get).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).not.toHaveBeenCalled();
  });

  test("rejects request with incorrect internalAuthKey", async () => {
    const invalidRequestPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: "wrong-key",
      payload: {
        action: "light.turn_on",
        entity_id: "light.living_room",
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidRequestPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Authentication failed");
    expect(mockEnv.INTERNAL_KEY_BINDING.get).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).not.toHaveBeenCalled();
  });

  test("rejects request if internal key binding is not configured", async () => {
    // mockEnv = createMockEnv({
    //   INTERNAL_KEY_BINDING: {
    //     get: jest.fn().mockResolvedValue(null), // Simulate binding returning null
    //   },
    // });
    // Instead of creating a new mock function, modify the existing one from the default mockEnv
    (mockEnv.INTERNAL_KEY_BINDING.get as jest.Mock).mockResolvedValue(null);

    const requestPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: TEST_INTERNAL_KEY,
      payload: {
        action: "light.turn_on",
        entity_id: "light.living_room",
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal configuration error");
    expect(mockEnv.INTERNAL_KEY_BINDING.get).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).not.toHaveBeenCalled();
  });

  // --- Validation Tests ---

  test("rejects request with invalid payload structure (missing action)", async () => {
    const invalidPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: TEST_INTERNAL_KEY,
      payload: {
        // action: missing
        entity_id: "light.living_room",
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(400); // Zod validation should fail
    const body = await response.json();
    expect(body.error).toBe("Invalid request body structure.");
    expect(mockEnv.INTERNAL_KEY_BINDING.get).toHaveBeenCalledTimes(1); // Auth middleware runs first
    expect(mockCallHaService).not.toHaveBeenCalled();
  });

  test("rejects request with invalid payload action enum", async () => {
    const invalidPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: TEST_INTERNAL_KEY,
      payload: {
        action: "invalid.action", // Not in enum
        entity_id: "light.living_room",
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request body structure.");
    expect(mockCallHaService).not.toHaveBeenCalled();
  });

  // --- Success Path Tests ---

  test("processes valid light.turn_on request successfully", async () => {
    const validPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: TEST_INTERNAL_KEY,
      payload: {
        action: "light.turn_on",
        entity_id: "light.living_room",
        data: { brightness: 200 },
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.result).toEqual({ success: true, details: "mock success" });
    expect(body.error).toBeNull();

    expect(mockEnv.INTERNAL_KEY_BINDING.get).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).toHaveBeenCalledWith(
      TEST_HA_URL,
      TEST_HA_TOKEN,
      "light", // domain
      "turn_on", // service
      "light.living_room", // entityId
      { brightness: 200 } // data
    );
  });

  test("processes valid automation.trigger request successfully", async () => {
    const validPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: TEST_INTERNAL_KEY,
      payload: {
        action: "automation.trigger",
        entity_id: "automation.notify_me",
        // No extra data needed for trigger usually
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    expect(mockCallHaService).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).toHaveBeenCalledWith(
      TEST_HA_URL,
      TEST_HA_TOKEN,
      "automation", // domain
      "trigger", // service
      "automation.notify_me", // entityId
      undefined // data
    );
  });

  // --- Error Path Tests ---

  test("handles error from callHaService", async () => {
    const errorMessage = "Home Assistant unreachable";
    mockCallHaService.mockRejectedValue(new Error(errorMessage));

    const validPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: TEST_INTERNAL_KEY,
      payload: {
        action: "light.turn_off",
        entity_id: "light.office",
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.result).toBeNull();
    expect(body.error).toBe(errorMessage);

    expect(mockEnv.INTERNAL_KEY_BINDING.get).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).toHaveBeenCalledTimes(1);
    expect(mockCallHaService).toHaveBeenCalledWith(
        TEST_HA_URL,
        TEST_HA_TOKEN,
        "light",
        "turn_off",
        "light.office",
        undefined
      );
  });

   test("handles non-JSON or empty response from callHaService", async () => {
    // Simulate callHaService resolving successfully but with non-JSON/empty body
    // (The actual haService handles this, returning { success: true })
    mockCallHaService.mockResolvedValue({ success: true });

    const validPayload = {
      requestId: TEST_REQUEST_ID,
      internalAuthKey: TEST_INTERNAL_KEY,
      payload: {
        action: "script.turn_on",
        entity_id: "script.good_morning",
      },
    };
    const request = new Request(`http://worker.test/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(200); // Status is still OK
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.result).toEqual({ success: true }); // Reflects the handled empty response
    expect(body.error).toBeNull();

    expect(mockCallHaService).toHaveBeenCalledTimes(1);
  });

  // --- Health Check Test ---
  test("responds to GET /", async () => {
    const request = new Request(`http://worker.test/`, {
      method: "GET",
    });

    const response = await app.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Home Assistant Worker is running!");
  });

});
