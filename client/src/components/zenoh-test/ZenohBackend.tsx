import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3005";

const ZenohBackendConnector = () => {
	const [status, setStatus] = useState<string>("Disconnected");
	const [receivedData, setReceivedData] = useState<
		Array<{ id: string; text: string }>
	>([]);
	const [subscribeKey, setSubscribeKey] = useState<string>("test/**");
	const [publishKey, setPublishKey] = useState<string>("test/cmd");
	const [publishValue, setPublishValue] = useState<string>("Hello Zenoh");
	const [publishJsonValue, setPublishJsonValue] =
		useState<string>('{"hello":"zenoh"}');
	const [publishAsJson, setPublishAsJson] = useState<boolean>(false);
	const [queryKey, setQueryKey] = useState<string>("test/**");
	const [queryPayload, setQueryPayload] = useState<string>('{"ping":"zenoh"}');
	const [queryAsJson, setQueryAsJson] = useState<boolean>(false);
	const [queryResults, setQueryResults] = useState<
		Array<{ id: string; text: string }>
	>([]);
	const [apiStatus, setApiStatus] = useState<string>("");

	const baseId = useId();
	const pubKeyId = `${baseId}-pub-key`;
	const pubTextId = `${baseId}-pub-text`;
	const pubJsonId = `${baseId}-pub-json`;
	const subKeyId = `${baseId}-sub-key`;
	const qryKeyId = `${baseId}-qry-key`;
	const qryJsonId = `${baseId}-qry-json`;

	const genId = useCallback(() => {
		if (
			typeof crypto !== "undefined" &&
			typeof crypto.randomUUID === "function"
		) {
			return crypto.randomUUID();
		}
		return Math.random().toString(36).slice(2);
	}, []);

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
			setReceivedData((prev) => [
				...prev,
				{ id: genId(), text: `${payload.key}: ${payload.value}` },
			]);
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
	}, [genId]);

	const isConnected = useMemo(() => status === "Connected", [status]);
	const statusBadge = useMemo(() => {
		const color =
			status === "Connected"
				? "bg-green-500"
				: status === "Disconnected"
					? "bg-gray-400"
					: status === "Connection failed"
						? "bg-red-500"
						: "bg-amber-500";
		return (
			<span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1 text-sm shadow-sm">
				<span className={`h-2 w-2 rounded-full ${color}`} />
				{status}
			</span>
		);
	}, [status]);

	const handlePublish = async () => {
		try {
			setApiStatus("Publishing...");
			const payload = publishAsJson
				? JSON.stringify(JSON.parse(publishJsonValue))
				: publishValue;
			const response = await fetch(`${API_BASE}/zenoh/publish`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: publishKey, value: payload }),
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
			const payload =
				queryAsJson && queryPayload.trim().length > 0
					? JSON.stringify(JSON.parse(queryPayload))
					: "";
			const response = payload
				? await fetch(`${API_BASE}/zenoh/query`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ key: queryKey, payload }),
					})
				: await fetch(
						`${API_BASE}/zenoh/query?key=${encodeURIComponent(queryKey)}`,
					);
			if (!response.ok) {
				const text = await response.text();
				setApiStatus(`Query failed: ${text}`);
				return;
			}
			const data = await response.json();
			const results = Array.isArray(data.results)
				? data.results.map((item: { key: string; value: string }) => ({
						id: genId(),
						text: `${item.key}: ${item.value}`,
					}))
				: [];
			setQueryResults(results);
			setApiStatus("Query complete");
		} catch (error) {
			console.error("Query failed:", error);
			setApiStatus("Query failed");
		}
	};

	const handleSubscribeUpdate = async () => {
		try {
			setApiStatus("Updating subscription...");
			const response = await fetch(`${API_BASE}/zenoh/subscribe`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: subscribeKey }),
			});
			if (!response.ok) {
				const text = await response.text();
				setApiStatus(`Subscribe failed: ${text}`);
				return;
			}
			setApiStatus("Subscribed");
		} catch (err) {
			console.error("Subscribe failed:", err);
			setApiStatus("Subscribe failed");
		}
	};

	const clearReceived = () => setReceivedData([]);
	const clearQuery = () => setQueryResults([]);
	const copyToClipboard = (text: string) => {
		if (navigator?.clipboard?.writeText) {
			navigator.clipboard.writeText(text).catch(() => {});
		}
	};

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<div>
					<h2 className="text-2xl font-semibold tracking-tight">
						Zenoh Console (Backend)
					</h2>
					<p className="text-sm text-gray-500">API: {API_BASE}</p>
					{apiStatus ? (
						<p className="text-xs text-gray-500">{apiStatus}</p>
					) : null}
				</div>
				{statusBadge}
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Received Data */}
				<section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<div className="flex-1">
							<h3 className="text-lg font-medium">Received Data</h3>
							<label
								htmlFor={subKeyId}
								className="mb-1 mt-2 block text-xs font-medium text-gray-600"
							>
								Subscribe key expression
							</label>
							<div className="flex items-center gap-2">
								<input
									id={subKeyId}
									type="text"
									value={subscribeKey}
									onChange={(e) => setSubscribeKey(e.target.value)}
									placeholder="test/**"
									className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
								/>
								<button
									type="button"
									onClick={handleSubscribeUpdate}
									disabled={!isConnected}
									className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm ${isConnected ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 cursor-not-allowed"}`}
								>
									Apply
								</button>
							</div>
						</div>
						<button
							type="button"
							onClick={clearReceived}
							className="h-10 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
						>
							Clear
						</button>
					</div>
					<div className="h-80 overflow-auto rounded-lg border border-gray-100 bg-gray-50">
						{receivedData.length === 0 ? (
							<div className="flex h-full items-center justify-center text-sm text-gray-400">
								No messages yet
							</div>
						) : (
							<ul className="divide-y divide-gray-200">
								{receivedData.map((item) => (
									<li
										key={item.id}
										className="flex items-start justify-between gap-2 px-3 py-2"
									>
										<pre className="max-w-[85%] whitespace-pre-wrap wrap-break-word font-mono text-xs text-gray-800">
											{item.text}
										</pre>
										<button
											type="button"
											title="Copy"
											className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
											onClick={() => copyToClipboard(item.text)}
										>
											Copy
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</section>

				{/* Publish */}
				<section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-lg font-medium">Publish</h3>
					</div>
					<div className="space-y-3">
						<div>
							<label
								htmlFor={pubKeyId}
								className="mb-1 block text-xs font-medium text-gray-600"
							>
								Key
							</label>
							<input
								id={pubKeyId}
								type="text"
								value={publishKey}
								onChange={(e) => setPublishKey(e.target.value)}
								placeholder="test/cmd"
								className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
							/>
						</div>

						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								checked={publishAsJson}
								onChange={(e) => setPublishAsJson(e.target.checked)}
							/>
							<span>Send JSON</span>
						</label>

						{!publishAsJson ? (
							<div>
								<label
									htmlFor={pubTextId}
									className="mb-1 block text-xs font-medium text-gray-600"
								>
									Text payload
								</label>
								<input
									id={pubTextId}
									type="text"
									value={publishValue}
									onChange={(e) => setPublishValue(e.target.value)}
									disabled={publishAsJson}
									placeholder="Hello Zenoh"
									className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
								/>
							</div>
						) : (
							<div>
								<div className="mb-1 flex items-center justify-between">
									<label
										htmlFor={pubJsonId}
										className="block text-xs font-medium text-gray-600"
									>
										JSON payload
									</label>
									<button
										type="button"
										onClick={() => copyToClipboard(publishJsonValue)}
										className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
									>
										Copy JSON
									</button>
								</div>
								<textarea
									id={pubJsonId}
									value={publishJsonValue}
									onChange={(e) => setPublishJsonValue(e.target.value)}
									disabled={!publishAsJson}
									rows={6}
									placeholder='{"hello":"zenoh"}'
									className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
								/>
							</div>
						)}

						<div className="pt-1">
							<button
								type="button"
								onClick={handlePublish}
								disabled={!isConnected}
								className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm ${isConnected ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"}`}
							>
								Publish
							</button>
						</div>
					</div>
				</section>

				{/* Query */}
				<section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm lg:col-span-2">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-lg font-medium">Query</h3>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={clearQuery}
								className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
							>
								Clear Results
							</button>
							<button
								type="button"
								onClick={handleQuery}
								disabled={!isConnected}
								className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm ${isConnected ? "bg-green-600 hover:bg-green-700" : "bg-green-300 cursor-not-allowed"}`}
							>
								Query Status
							</button>
						</div>
					</div>

					<div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label
								htmlFor={qryKeyId}
								className="mb-1 block text-xs font-medium text-gray-600"
							>
								Key expression
							</label>
							<input
								id={qryKeyId}
								type="text"
								value={queryKey}
								onChange={(e) => setQueryKey(e.target.value)}
								placeholder="test/**"
								className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
							/>
						</div>

						<div className="space-y-3">
							<label className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									checked={queryAsJson}
									onChange={(e) => setQueryAsJson(e.target.checked)}
								/>
								<span>Send JSON payload</span>
							</label>

							{queryAsJson && (
								<div>
									<div className="mb-1 flex items-center justify-between">
										<label
											htmlFor={qryJsonId}
											className="block text-xs font-medium text-gray-600"
										>
											JSON payload
										</label>
										<button
											type="button"
											onClick={() => copyToClipboard(queryPayload)}
											className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
										>
											Copy JSON
										</button>
									</div>
									<textarea
										id={qryJsonId}
										value={queryPayload}
										onChange={(e) => setQueryPayload(e.target.value)}
										disabled={!queryAsJson}
										rows={6}
										placeholder='{"ping":"zenoh"}'
										className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
									/>
								</div>
							)}
						</div>
					</div>

					<div className="rounded-lg border border-gray-100 bg-gray-50">
						{queryResults.length === 0 ? (
							<div className="h-40 p-4 text-sm text-gray-400">No results</div>
						) : (
							<ul className="max-h-64 divide-y divide-gray-200 overflow-auto">
								{queryResults.map((item) => (
									<li
										key={item.id}
										className="flex items-start justify-between gap-2 px-3 py-2"
									>
										<pre className="max-w-[90%] whitespace-pre-wrap wrap-break-word font-mono text-xs text-gray-800">
											{item.text}
										</pre>
										<button
											type="button"
											title="Copy"
											className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
											onClick={() => copyToClipboard(item.text)}
										>
											Copy
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</section>
			</div>
		</div>
	);
};

export default ZenohBackendConnector;
