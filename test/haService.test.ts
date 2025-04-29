import { describe, expect, test, beforeEach, jest } from "@jest/globals";
import { callHaService } from "../src/haService";

// Mock the global fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Home Assistant Service Client (haService)", () => {
  const TEST_HA_URL = "http://mock-ha.local:8123";
  const TEST_HA_TOKEN = "mock-ha-token";
  const TEST_DOMAIN = "light";
  const TEST_SERVICE = "turn_on";
  const TEST_ENTITY_ID = "light.living_room";
  const TEST_DATA = { brightness: 200 };

  beforeEach(() => {
    // Clear mock usage data before each test
    mockFetch.mockClear();
  });

  test("should call HA API with correct parameters and return JSON response", async () => {
    const mockApiResponse = [{ entity_id: TEST_ENTITY_ID, state: "on" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
      text: async () => JSON.stringify(mockApiResponse), // Add text() for potential error paths
      status: 200,
    });

    const result = await callHaService(
      TEST_HA_URL,
      TEST_HA_TOKEN,
      TEST_DOMAIN,
      TEST_SERVICE,
      TEST_ENTITY_ID,
      TEST_DATA
    );

    expect(result).toEqual(mockApiResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `${TEST_HA_URL}/api/services/${TEST_DOMAIN}/${TEST_SERVICE}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_HA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entity_id: TEST_ENTITY_ID, ...TEST_DATA }),
      }
    );
  });

  test("should handle non-JSON or empty successful response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error("Invalid JSON")), // Simulate non-json response
      text: async () => "", // Empty text response
      status: 200,
    });

    const result = await callHaService(
      TEST_HA_URL,
      TEST_HA_TOKEN,
      TEST_DOMAIN,
      TEST_SERVICE,
      TEST_ENTITY_ID
      // No data for this test
    );

    expect(result).toEqual({ success: true }); // Should return success marker
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Check fetch call details (optional, similar to above)
  });

  test("should throw error for non-OK API response", async () => {
    const errorBody = "Unauthorized";
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }), // Mock json() even for errors if needed
      text: async () => errorBody,
      status: 401,
    });

    await expect(
      callHaService(
        TEST_HA_URL,
        TEST_HA_TOKEN,
        TEST_DOMAIN,
        TEST_SERVICE,
        TEST_ENTITY_ID
      )
    ).rejects.toThrow(
      `Home Assistant API request failed with status 401: ${errorBody}`
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

   test("should throw error for network issues", async () => {
    const networkError = new Error("Network connection failed");
    mockFetch.mockRejectedValueOnce(networkError); // Simulate fetch throwing an error

    await expect(
      callHaService(
        TEST_HA_URL,
        TEST_HA_TOKEN,
        TEST_DOMAIN,
        TEST_SERVICE,
        TEST_ENTITY_ID
      )
    ).rejects.toThrow(networkError); // Should re-throw the original network error

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("should handle trailing slash in haUrl correctly", async () => {
    const mockApiResponse = [{ entity_id: TEST_ENTITY_ID, state: "on" }];
     mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
      text: async () => JSON.stringify(mockApiResponse),
      status: 200,
    });

    // Call with a trailing slash
    await callHaService(
      `${TEST_HA_URL}/`, // Add trailing slash
      TEST_HA_TOKEN,
      TEST_DOMAIN,
      TEST_SERVICE,
      TEST_ENTITY_ID
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Expect the URL called by fetch NOT to have double slashes
    expect(mockFetch).toHaveBeenCalledWith(
      `${TEST_HA_URL}/api/services/${TEST_DOMAIN}/${TEST_SERVICE}`, // No double slash here
      expect.anything() // Don't need to re-check the full options object
    );
  });

}); 