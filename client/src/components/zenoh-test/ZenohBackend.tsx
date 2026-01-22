import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3005";

const ZenohBackendConnector: React.FC = () => {
	const [status, setStatus] = useState<string>("Disconnected");
	const [receivedData, setReceivedData] = useState<string[]>([]);
	const [publishKey, setPublishKey] = useState<string>("test/cmd");
	const [publishValue, setPublishValue] = useState<string>("Hello Zenoh");
	const [queryKey, setQueryKey] = useState<string>("test/**");
	const [queryResults, setQueryResults] = useState<string[]>([]);
	const [apiStatus, setApiStatus] = useState<string>("");

	useEffect(() => {
		const socket = io(API_BASE, {
			transports: ["websocket"],
		});

		const handleStatus = (payload: { status?: string }) => {
			if (payload?.status) {
				setStatus(
					`${payload.status.charAt(0).toUpperCase()}${payload.status.slice(1)}`,
				);
			}
		};

		const handleData = (payload: { key: string; value: string }) => {
			setReceivedData((prev) => [...prev, `${payload.key}: ${payload.value}`]);
		};

		socket.on("connect", () => setStatus("Connected"));
		socket.on("disconnect", () => setStatus("Disconnected"));
		socket.on("zenoh:status", handleStatus);
		socket.on("zenoh:data", handleData);

		return () => {
			socket.off("zenoh:status", handleStatus);
			socket.off("zenoh:data", handleData);
			socket.disconnect();
		};
	}, []);

	const handlePublish = async () => {
		try {
			setApiStatus("Publishing...");
			const response = await fetch(`${API_BASE}/zenoh/publish`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: publishKey, value: publishValue }),
			});
			if (!response.ok) {
				const text = await response.text();
				setApiStatus(`Publish failed: ${text}`);
				return;
			}
			setApiStatus("Published");
		} catch (error) {
			console.error("Publish failed:", error);
			setApiStatus("Publish failed");
		}
	};

	const handleQuery = async () => {
		try {
			setApiStatus("Querying...");
			const response = await fetch(
				`${API_BASE}/zenoh/query?key=${encodeURIComponent(queryKey)}`,
			);
			if (!response.ok) {
				const text = await response.text();
				setApiStatus(`Query failed: ${text}`);
				return;
			}
			const data = await response.json();
			const results = Array.isArray(data.results)
				? data.results.map((item: { key: string; value: string }) => {
						return `${item.key}: ${item.value}`;
					})
				: [];
			setQueryResults(results);
			setApiStatus("Query complete");
		} catch (error) {
			console.error("Query failed:", error);
			setApiStatus("Query failed");
		}
	};

	return (
		<div>
			<h2>Zenoh Status (Backend): {status}</h2>
			<p>API: {API_BASE}</p>
			{apiStatus ? <p>{apiStatus}</p> : null}
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
					value={publishKey}
					onChange={(e) => setPublishKey(e.target.value)}
					placeholder="Key"
				/>
				<input
					type="text"
					value={publishValue}
					onChange={(e) => setPublishValue(e.target.value)}
					placeholder="Value"
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
				<input
					type="text"
					value={queryKey}
					onChange={(e) => setQueryKey(e.target.value)}
					placeholder="Key expression"
				/>
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

export default ZenohBackendConnector;
