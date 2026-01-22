import React, { useEffect, useState } from "react";
import { open, ReplyError, Session, Subscriber } from "@eclipse-zenoh/zenoh-ts";

const ZenohConnector: React.FC = () => {
	const [session, setSession] = useState<Session | null>(null);
	const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
	const [receivedData, setReceivedData] = useState<string[]>([]);
	const [status, setStatus] = useState<string>("Disconnected");
	const [publishValue, setPublishValue] = useState<string>("Hello Zenoh");
	const [queryResults, setQueryResults] = useState<string[]>([]);

	useEffect(() => {
		let active = true;
		let currentSession: Session | null = null;
		let currentSubscriber: Subscriber | null = null;

		const initZenoh = async () => {
			try {
				const zenohSession = await open({
					locator: "ws://10.110.178.112:10000", // Your Zenoh router WS endpoint; update for production
					messageResponseTimeoutMs: 10000,
				});
				if (!active) {
					await zenohSession.close();
					return;
				}
				currentSession = zenohSession;
				setSession(zenohSession);
				setStatus("Connected");

				// Subscribe to data (e.g., ROS topics mapped to Zenoh keys)
				const zenohSubscriber = await zenohSession.declareSubscriber(
					"test/**",
					{
						handler: (sample) => {
							const value = sample.payload().toString();
							const key = sample.keyexpr().toString();
							setReceivedData((prev) => [...prev, `${key}: ${value}`]);
						},
					},
				);
				currentSubscriber = zenohSubscriber;
				setSubscriber(zenohSubscriber);
			} catch (error) {
				console.error("Zenoh init failed:", error);
				setStatus("Connection failed");
			}
		};

		initZenoh();

		// Cleanup on unmount
		return () => {
			active = false;
			if (currentSubscriber) currentSubscriber.undeclare();
			if (currentSession) currentSession.close();
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
			if (!replies) return;
			const results: string[] = [];
			for await (const reply of replies) {
				const result = reply.result();
				if (result instanceof ReplyError) {
					results.push(`ERR: ${result.payload().toString()}`);
					continue;
				}
				const key = result.keyexpr().toString();
				const value = result.payload().toString();
				results.push(`${key}: ${value}`);
			}
			setQueryResults(results);
		} catch (error) {
			console.error("Query failed:", error);
		}
	};

	return (
		<div>
			<h2>Zenoh Status: {status}</h2>
			<div className="bg-red-100 h-[400px] overflow-scroll">
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
				<button
					type="button"
					onClick={handlePublish}
					className="bg-blue-500 my-2 p-2 rounded hover:bg-blue-700 text-white cursor-pointer"
				>
					Publish
				</button>
			</div>
			<div>
				<h3>Query Results:</h3>
				<button
					type="button"
					onClick={handleQuery}
					className="bg-green-500 my-2 p-2 rounded hover:bg-green-700 text-white cursor-pointer"
				>
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
