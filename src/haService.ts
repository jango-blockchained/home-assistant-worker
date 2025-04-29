/**
 * Calls a Home Assistant service using the REST API.
 *
 * @param haUrl The base URL of the Home Assistant instance (e.g., https://your-ha.duckdns.org).
 * @param token The Long-Lived Access Token.
 * @param domain The service domain (e.g., 'light', 'switch', 'automation').
 * @param service The service name (e.g., 'turn_on', 'toggle', 'trigger').
 * @param entityId The target entity ID (e.g., 'light.living_room').
 * @param data Optional data payload for the service call (e.g., { brightness: 128 }).
 * @returns The response from the Home Assistant API.
 */
export async function callHaService(
  haUrl: string,
  token: string,
  domain: string,
  service: string,
  entityId: string,
  data?: Record<string, unknown>
): Promise<unknown> {
  const url = `${haUrl.replace(/\/$/, "")}/api/services/${domain}/${service}`;

  console.log(`Calling HA Service: POST ${url}`);
  console.log(`Body: ${JSON.stringify({ entity_id: entityId, ...data })}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entity_id: entityId, ...data }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`HA API Error (${response.status}): ${errorBody}`);
    throw new Error(
      `Home Assistant API request failed with status ${response.status}: ${errorBody}`
    );
  }

  // HA service calls often return an array of state objects or an empty body on success
  try {
    const responseData = await response.json();
    console.log("HA API Response:", responseData);
    return responseData;
  } catch (e) {
    // Handle cases where response body is empty or not JSON
    console.log("HA API returned non-JSON or empty response.");
    return { success: true }; // Assume success if status was ok
  }
}
