import { Hono } from "hono";

const routes = new Hono();

routes.get("/", (c) => {
	return c.text("Hello Hono!");
});

routes.get("/health", (c) => {
	return c.json({ status: "ok" });
});

export default routes;
