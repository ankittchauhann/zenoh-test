import ZenohBackendConnector from "@/components/zenoh-test/ZenohBackend";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/zenoh-backend/")({
	component: ZenohBackendConnector,
});
