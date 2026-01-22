import type { Session, Subscriber } from "@eclipse-zenoh/zenoh-ts";
import { open, ReplyError } from "@eclipse-zenoh/zenoh-ts";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

const ZENOH_LOCATOR = "ws://localhost:10000";

const ZenohConnector = () => {
	const [session, setSession] = useState<Session | null>(null);
	const [receivedData, setReceivedData] = useState<
		Array<{ id: string; text: string }>
	>([]);
	const [status, setStatus] = useState<string>("Disconnected");
	const [subscribeKey, setSubscribeKey] = useState<string>("test/**");
	const [publishKey, setPublishKey] = useState<string>("test/cmd");
	const [publishValue, setPublishValue] = useState<string>("Hello Zenoh");
	const [publishJsonValue, setPublishJsonValue] =
		useState<string>('{"hello":"zenoh"}');
	const [publishAsJson, setPublishAsJson] = useState<boolean>(false);
	const [queryResults, setQueryResults] = useState<
		Array<{ id: string; text: string }>
	>([]);
	const [queryKey, setQueryKey] = useState<string>("test/**");
	const [queryPayload, setQueryPayload] = useState<string>('{"ping":"zenoh"}');
	const [queryAsJson, setQueryAsJson] = useState<boolean>(false);
	const baseId = useId();
	const publishKeyId = `${baseId}-publish-key`;
	const publishTextId = `${baseId}-publish-text`;
	const publishJsonId = `${baseId}-publish-json`;
	const subscribeKeyId = `${baseId}-subscribe-key`;
	const queryKeyId = `${baseId}-query-key`;
	const queryJsonId = `${baseId}-query-json`;

	const subRef = useRef<Subscriber | null>(null);

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
		let active = true;
		let currentSession: Session | null = null;

		const initZenoh = async () => {
			try {
				const zenohSession = await open({
					locator: ZENOH_LOCATOR, // Your Zenoh router WS endpoint; update for production
					messageResponseTimeoutMs: 10000,
				});
				if (!active) {
					await zenohSession.close();
					return;
				}
				currentSession = zenohSession;
				setSession(zenohSession);
				setStatus("Connected");
			} catch (error) {
				console.error("Zenoh init failed:", error);
				setStatus("Connection failed");
			}
		};

		initZenoh();

		// Cleanup on unmount
		return () => {
			active = false;
			if (currentSession) currentSession.close();
		};
	}, []);

	// Manage (re)subscription when session or key changes
	useEffect(() => {
		if (!session) return;
		let canceled = false;
		const setup = async () => {
			try {
				const sub = await session.declareSubscriber(subscribeKey, {
					handler: (sample) => {
						if (canceled) return;
						const value = sample.payload().toString();
						const key = sample.keyexpr().toString();
						setReceivedData((prev) => [
							...prev,
							{ id: genId(), text: `${key}: ${value}` },
						]);
					},
				});
				if (canceled) {
					// If unsubscribed before ready
					sub.undeclare();
					return;
				}
				subRef.current = sub;
			} catch (e) {
				console.error("Subscribe failed:", e);
			}
		};
		setup();
		return () => {
			canceled = true;
			if (subRef.current) {
				subRef.current.undeclare();
				subRef.current = null;
			}
		};
	}, [session, subscribeKey, genId]);

	const isConnected = useMemo(() => status === "Connected", [status]);

	const statusBadge = useMemo(() => {
		const color =
			status === "Connected"
				? "bg-green-500"
				: status === "Connection failed"
					? "bg-red-500"
					: status === "Disconnected"
						? "bg-gray-400"
						: "bg-amber-500";
		return (
			<span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1 text-sm shadow-sm">
				<span className={`h-2 w-2 rounded-full ${color}`} />
				{status}
			</span>
		);
	}, [status]);

	const handlePublish = async () => {
		if (!session) return;
		try {
			const payload = publishAsJson
				? JSON.stringify(JSON.parse(publishJsonValue))
				: publishValue;
			await session.put(publishKey, payload);
			console.log("Published:", payload);
		} catch (error) {
			console.error("Publish failed:", error);
		}
	};

	const handleQuery = async () => {
		if (!session) return;
		try {
			let payload: string | undefined;
			if (queryAsJson && queryPayload.trim().length > 0) {
				payload = JSON.stringify(JSON.parse(queryPayload));
			}
			const replies = await session.get(
				queryKey,
				payload ? { payload } : undefined,
			);
			if (!replies) return;
			const results: Array<{ id: string; text: string }> = [];
			for await (const reply of replies) {
				const result = reply.result();
				if (result instanceof ReplyError) {
					results.push({
						id: genId(),
						text: `ERR: ${result.payload().toString()}`,
					});
					continue;
				}
				const key = result.keyexpr().toString();
				const value = result.payload().toString();
				results.push({ id: genId(), text: `${key}: ${value}` });
			}
			setQueryResults(results);
		} catch (error) {
			console.error("Query failed:", error);
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
						Zenoh Console
					</h2>
					<p className="text-sm text-gray-500">Router: {ZENOH_LOCATOR}</p>
				</div>
				{statusBadge}
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Received Data */}
				<section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<div className="mb-3 flex items-center justify-between">
						<div className="space-y-2">
							<h3 className="text-lg font-medium">Received Data</h3>
							<div>
								<label
									htmlFor={subscribeKeyId}
									className="mb-1 block text-xs font-medium text-gray-600"
								>
									Subscribe key expression
								</label>
								<input
									id={subscribeKeyId}
									type="text"
									value={subscribeKey}
									onChange={(e) => setSubscribeKey(e.target.value)}
									placeholder="test/**"
									className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
								/>
							</div>
						</div>
						<button
							type="button"
							onClick={clearReceived}
							className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
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

				{/* Publish Command */}
				<section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="text-lg font-medium">Publish Command</h3>
					</div>

					<div className="space-y-3">
						<div>
							<label
								htmlFor={publishKeyId}
								className="mb-1 block text-xs font-medium text-gray-600"
							>
								Key
							</label>
							<input
								id={publishKeyId}
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
									htmlFor={publishTextId}
									className="mb-1 block text-xs font-medium text-gray-600"
								>
									Text payload
								</label>
								<input
									type="text"
									value={publishValue}
									onChange={(e) => setPublishValue(e.target.value)}
									disabled={publishAsJson}
									id={publishTextId}
									className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
								/>
							</div>
						) : (
							<div>
								<div className="mb-1 flex items-center justify-between">
									<label
										htmlFor={publishJsonId}
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
									value={publishJsonValue}
									onChange={(e) => setPublishJsonValue(e.target.value)}
									disabled={!publishAsJson}
									rows={6}
									id={publishJsonId}
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

					<div className="mb-4 space-y-3">
						<div>
							<label
								htmlFor={queryKeyId}
								className="mb-1 block text-xs font-medium text-gray-600"
							>
								Key expression
							</label>
							<input
								id={queryKeyId}
								type="text"
								value={queryKey}
								onChange={(e) => setQueryKey(e.target.value)}
								placeholder="test/**"
								className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
							/>
						</div>

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
										htmlFor={queryJsonId}
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
									value={queryPayload}
									onChange={(e) => setQueryPayload(e.target.value)}
									disabled={!queryAsJson}
									rows={6}
									id={queryJsonId}
									className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
								/>
							</div>
						)}
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

export default ZenohConnector;
