import { describe, expect, test, jest, beforeEach, afterEach } from "bun:test";
import { callHaService } from "../src/haService";

const HA_URL = "http://mock-ha.local:8123";
const HA_TOKEN = "test-token";

describe("haService", () => {
  let fetchMock: jest.Mock;
  let consoleLogSpy: jest.Mock;
  let consoleErrorSpy: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("callHaService returns result", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([{ entity_id: "light.living_room", state: "on" }]),
    });
    const result = await callHaService(
      HA_URL,
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room",
      { brightness: 128 }
    );
    expect(result).toBeDefined();
  });

  test("callHaService strips trailing slash", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });
    await callHaService(
      "http://mock-ha.local:8123/",
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://mock-ha.local:8123/api/services/light/turn_on",
      expect.any(Object)
    );
  });

  test("callHaService handles data parameter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });
    await callHaService(
      HA_URL,
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room",
      { brightness: 128, color_name: "red" }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ entity_id: "light.living_room", brightness: 128, color_name: "red" }),
      })
    );
  });

  test("callHaService handles no data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });
    const result = await callHaService(
      HA_URL,
      HA_TOKEN,
      "switch",
      "toggle",
      "switch.garage"
    );
    expect(result).toBeDefined();
  });

  test("callHaService constructs correct URL", async () => {
    const url = `${HA_URL.replace(/\/$/, "")}/api/services/light/turn_on`;
    expect(url).toBe("http://mock-ha.local:8123/api/services/light/turn_on");
  });

  test("HTTP 200 with JSON response - verifies parsing", async () => {
    const jsonResponse = [{ entity_id: "light.living_room", state: "on" }];
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(jsonResponse),
    });

    const result = await callHaService(
      HA_URL,
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room"
    );

    expect(result).toEqual(jsonResponse);
  });

  test("HTTP 200 with empty response - returns {success: true}", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error("No content")),
    });

    const result = await callHaService(
      HA_URL,
      HA_TOKEN,
      "light",
      "turn_off",
      "light.bedroom"
    );

    expect(result).toEqual({ success: true });
  });

  test("HTTP 400 error - throws Error with status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue("Invalid entity_id"),
    });

    await expect(
      callHaService(
        HA_URL,
        HA_TOKEN,
        "light",
        "turn_on",
        "invalid.entity"
      )
    ).rejects.toThrow("Home Assistant API request failed with status 400: Invalid entity_id");
  });

  test("HTTP 500 error - throws Error containing body text", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("Internal server error"),
    });

    await expect(
      callHaService(
        HA_URL,
        HA_TOKEN,
        "automation",
        "trigger",
        "automation.my_automation"
      )
    ).rejects.toThrow("Internal server error");
  });

  test("Correct Authorization header - Bearer token format", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });

    await callHaService(
      HA_URL,
      "my-secret-token",
      "switch",
      "turn_on",
      "switch.ac"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-secret-token",
        }),
      })
    );
  });

  test("Correct Content-Type header", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });

    await callHaService(
      HA_URL,
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  test("Correct body format - entity_id is included", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });

    await callHaService(
      HA_URL,
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room",
      { brightness: 128 }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ entity_id: "light.living_room", brightness: 128 }),
      })
    );
  });

  test("HTTP 401 error - throws Error with authentication failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue("Invalid access token"),
    });

    await expect(
      callHaService(
        HA_URL,
        HA_TOKEN,
        "light",
        "turn_on",
        "light.living_room"
      )
    ).rejects.toThrow("Invalid access token");
  });

  test("HTTP 503 error - throws Error with service unavailable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue("Service temporarily unavailable"),
    });

    await expect(
      callHaService(
        HA_URL,
        HA_TOKEN,
        "switch",
        "toggle",
        "switch.garage"
      )
    ).rejects.toThrow("Service temporarily unavailable");
  });
});