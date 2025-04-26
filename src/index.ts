import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { callHaService } from './haService';

// Define types for environment variables (secrets)
export interface Env {
	HA_SECURE_URL: string;
	HA_TOKEN: string;
	// Add other bindings if needed, e.g., KV namespaces, R2 buckets
}

// Define the expected request body schema
const haRequestSchema = z.object({
	action: z.enum([
		'light.turn_on',
		'light.turn_off',
		'light.toggle', // Added toggle for convenience
		'homeassistant.update_entity', // Generic way to set color/brightness
		'automation.trigger', // To trigger automations/scripts directly if needed (can act as on/off)
		'script.turn_on', // More specific way to turn on scripts/scenes
		// Add other specific HA service calls as needed
	]),
	entity_id: z.string().min(1),
	data: z.record(z.unknown()).optional(), // Allow optional data like rgb_color, brightness
});

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => {
	return c.text('Home Assistant Worker is running!');
});

app.post('/service', zValidator('json', haRequestSchema), async (c) => {
	const body = c.req.valid('json');
	const env = c.env;

	try {
		const [domain, service] = body.action.split('.');
		const result = await callHaService(
			env.HA_SECURE_URL,
			env.HA_TOKEN,
			domain,
			service,
			body.entity_id,
			body.data
		);
		return c.json({ success: true, result });
	} catch (error: any) {
		console.error('Error calling Home Assistant:', error);
		return c.json({ success: false, error: error.message || 'Failed to call Home Assistant service' }, 500);
	}
});

export default app; 