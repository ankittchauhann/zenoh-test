import ZenohConnector from "@/components/zenoh-test/Zenoh";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/zenoh-test/")({
	component: ZenohConnector,
});
