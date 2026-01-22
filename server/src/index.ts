import { serve } from "@hono/node-server";
import { Hono } from "hono";
import routes from "./routes.js";
import type { Session, Subscriber } from "@eclipse-zenoh/zenoh-ts";
import { open } from "@eclipse-zenoh/zenoh-ts";
import * as WS from "ws";
(globalThis as any).WebSocket = WS.WebSocket; // Polyfill global WebSocket

const app = new Hono();

let session: Session | null = null;
let subscriber: Subscriber | null = null;

app.route("/", routes);

async function initZenoh() {
	if (session) return; // Already connected
	try {
		session = await open({
			locator: "ws://10.110.178.112:10000", // Local router for testing; change to production later
			messageResponseTimeoutMs: 10000,
		});
		console.log("Connected to Zenoh");

		// Set up a test subscriber (simulates receiving ROS data)
		subscriber = await session.declareSubscriber(
			"test/**", // Wildcard key; later map to ROS topics like '/robot/sensor/**'
			(sample) => {
				const value = sample.value.toString();
				console.log(`Received on ${sample.keyExpr}: ${value}`);
				// Here: Broadcast to UI clients via WebSocket if using Hono's ws, or log/process
			},
		);
	} catch (error) {
		console.error("Zenoh connection failed:", error);
		// Optional: Retry logic here
	}
}

// Middleware to ensure Zenoh is initialized
app.use("*", async (c, next) => {
	if (!session) await initZenoh();
	await next();
});

// Endpoint to publish data (e.g., send command to future ROS)
app.post("/publish", async (c) => {
	if (!session) return c.text("Zenoh not connected", 500);

	const { key, value } = await c.req.json(); // Expect JSON body: { "key": "/test/cmd", "value": "move" }
	await session.put(key || "/test/cmd", { value }); // Publish; serialize as needed

	return c.text("Published successfully");
});

app.get("/query", async (c) => {
	if (!session) return c.text("Zenoh not connected", 500);

	const key = c.req.query("key") || "/test/status";
	const replies = await session.get(key);
	let results: string[] = [];
	for await (const reply of replies) {
		if (reply.ok) {
			results.push(reply.ok.value.toString());
		}
	}

	return c.json({ results });
});

process.on("SIGINT", async () => {
	if (subscriber) await subscriber.undeclare();
	if (session) await session.close();
	process.exit(0);
});

initZenoh()
	.then(() => {
		serve(
			{
				fetch: app.fetch,
				port: 3005,
			},
			(info) => {
				console.log(`Server is running on http://localhost:${info.port}`);
			},
		);
	})
	.catch((err) => {
		console.error("Failed to start server:", err);
	});
