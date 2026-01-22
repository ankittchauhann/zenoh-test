import { createAdaptorServer } from "@hono/node-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import routes from "./routes.js";
import type { Session, Subscriber } from "@eclipse-zenoh/zenoh-ts";
import { open, ReplyError } from "@eclipse-zenoh/zenoh-ts";
import { Server as SocketIOServer } from "socket.io";
import * as WS from "ws";
(globalThis as any).WebSocket = WS.WebSocket; // Polyfill global WebSocket

const app = new Hono();
const PORT = Number(process.env.PORT ?? 3005);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

app.use(
	"*",
	cors({
		origin: CLIENT_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	}),
);

let session: Session | null = null;
let subscriber: Subscriber | null = null;

app.route("/", routes);

const server = createAdaptorServer({ fetch: app.fetch });
const io = new SocketIOServer(server, {
	cors: {
		origin: CLIENT_ORIGIN,
		methods: ["GET", "POST"],
	},
});

io.on("connection", (socket) => {
	socket.emit("zenoh:status", { status: session ? "connected" : "disconnected" });
});

async function initZenoh() {
	if (session) return; // Already connected
	try {
		session = await open({
			locator: "ws://10.110.178.112:10000", // Local router for testing; change to production later
			messageResponseTimeoutMs: 10000,
		});
		console.log("Connected to Zenoh");
		io.emit("zenoh:status", { status: "connected" });

		// Set up a test subscriber (simulates receiving ROS data)
		subscriber = await session.declareSubscriber("test/**", {
			handler: (sample) => {
				const value = sample.payload().toString();
				const key = sample.keyexpr().toString();
				console.log(`Received on ${key}: ${value}`);
				io.emit("zenoh:data", { key, value });
			},
		});
	} catch (error) {
		console.error("Zenoh connection failed:", error);
		io.emit("zenoh:status", { status: "error" });
		// Optional: Retry logic here
	}
}

// Middleware to ensure Zenoh is initialized
app.use("*", async (c, next) => {
	if (!session) await initZenoh();
	await next();
});

const handlePublish = async (c: Context) => {
	if (!session) return c.json({ error: "Zenoh not connected" }, 500);

	const body = await c.req.json().catch(() => ({}));
	const key = typeof body?.key === "string" && body.key.length > 0 ? body.key : "test/cmd";
	const value = typeof body?.value === "string" ? body.value : "";

	await session.put(key, value);

	return c.json({ ok: true });
};

const handleQuery = async (c: Context) => {
	if (!session) return c.json({ error: "Zenoh not connected" }, 500);

	const key = c.req.query("key") || "test/**";
	const replies = await session.get(key);
	if (!replies) return c.json({ results: [] });

	const results: { key: string; value: string }[] = [];
	for await (const reply of replies) {
		const result = reply.result();
		if (result instanceof ReplyError) {
			results.push({ key: "error", value: result.payload().toString() });
			continue;
		}
		results.push({
			key: result.keyexpr().toString(),
			value: result.payload().toString(),
		});
	}

	return c.json({ results });
};

// Endpoint to publish data (e.g., send command to future ROS)
app.post("/zenoh/publish", handlePublish);
app.post("/publish", handlePublish);
app.get("/zenoh/query", handleQuery);
app.get("/query", handleQuery);

process.on("SIGINT", async () => {
	if (subscriber) await subscriber.undeclare();
	if (session) await session.close();
	io.close();
	server.close();
	process.exit(0);
});

server.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

initZenoh().catch((err) => {
	console.error("Failed to connect to Zenoh:", err);
});
