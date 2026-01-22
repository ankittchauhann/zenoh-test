import React, { useEffect, useState } from "react";
import { open, Session, Subscriber } from "@eclipse-zenoh/zenoh-ts";

const ZenohConnector: React.FC = () => {
	const [session, setSession] = useState<Session | null>(null);
	const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
	const [receivedData, setReceivedData] = useState<string[]>([]);
	const [status, setStatus] = useState<string>("Disconnected");
	const [publishValue, setPublishValue] = useState<string>("Hello Zenoh");
	const [queryResults, setQueryResults] = useState<string[]>([]);

	useEffect(() => {
		const initZenoh = async () => {
			try {
				const zenohSession = await open({
					locator: "ws://10.110.178.112:10000", // Your Zenoh router WS endpoint; update for production
					messageResponseTimeoutMs: 10000,
				});
				setSession(zenohSession);
				setStatus("Connected");

				// Subscribe to data (e.g., ROS topics mapped to Zenoh keys)
				const zenohSubscriber = await zenohSession.declareSubscriber<string>(
					"test/**", // Wildcard key; later map to ROS topics like '/robot/sensor/**'
					(sample: { keyExpr: string; value: { toString: () => string } }) => {
						const value = sample.value.toString();
						setReceivedData((prev) => [...prev, `${sample.keyExpr}: ${value}`]);
					},
				);
				setSubscriber(zenohSubscriber);
			} catch (error) {
				console.error("Zenoh init failed:", error);
				setStatus("Connection failed");
			}
		};

		initZenoh();

		// Cleanup on unmount
		return () => {
			if (subscriber) subscriber.undeclare();
			if (session) session.close();
		};
	}, []);

	const handlePublish = async () => {
		if (!session) return;
		try {
			await session.put("test/cmd", publishValue);
			console.log("Published:", publishValue);
		} catch (error) {
			console.error("Publish failed:", error);
		}
	};

	const handleQuery = async () => {
		if (!session) return;
		try {
			const replies = await session.get("test/**");
			const results: string[] = [];
			for await (const reply of replies) {
				if (reply.ok) {
					results.push(reply.ok.value.toString());
				}
			}
			setQueryResults(results);
		} catch (error) {
			console.error("Query failed:", error);
		}
	};

	return (
		<div>
			<h2>Zenoh Status: {status}</h2>
			<div>
				<h3>Received Data:</h3>
				<ul>
					{receivedData.map((msg, idx) => (
						<li key={idx}>{msg}</li>
					))}
				</ul>
			</div>
			<div>
				<h3>Publish Command:</h3>
				<input
					type="text"
					value={publishValue}
					onChange={(e) => setPublishValue(e.target.value)}
				/>
				<button type="button" onClick={handlePublish} className="bg-blue-500">
					Publish
				</button>
			</div>
			<div>
				<h3>Query Results:</h3>
				<button type="button" onClick={handleQuery}>
					Query Status
				</button>
				<ul>
					{queryResults.map((result, idx) => (
						<li key={idx}>{result}</li>
					))}
				</ul>
			</div>
		</div>
	);
};

export default ZenohConnector;
