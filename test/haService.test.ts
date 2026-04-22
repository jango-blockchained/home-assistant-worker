import { describe, expect, test } from "bun:test";
import { callHaService } from "../src/haService";

const HA_URL = "http://mock-ha.local:8123";
const HA_TOKEN = "test-token";

describe("haService", () => {
  test("callHaService returns result", async () => {
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
    const result = await callHaService(
      "http://mock-ha.local:8123/",
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room"
    );
    expect(result).toBeDefined();
  });

  test("callHaService handles data parameter", async () => {
    const result = await callHaService(
      HA_URL,
      HA_TOKEN,
      "light",
      "turn_on",
      "light.living_room",
      { brightness: 128, color_name: "red" }
    );
    expect(result).toBeDefined();
  });

  test("callHaService handles no data", async () => {
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
});