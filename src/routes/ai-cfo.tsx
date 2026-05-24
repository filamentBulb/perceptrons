import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import {
	ArrowRight,
	Bot,
	Cloud,
	Loader2,
	Send,
	Sparkles,
	User,
	Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { hasRequiredForecastSources, runwayStore } from "../lib/runway-store";

export const Route = createFileRoute("/ai-cfo")({
	component: AiCfoChatScreen,
});

type Message = {
	id: string;
	role: "assistant" | "user";
	content: string;
};

const starterPrompts = [
	"What happens if our users grow from 100k to 1 million?",
	"How much runway do we lose if AI inference costs double?",
	"What if Stripe payouts are delayed 7 days?",
	"Which cost driver should I cut first this month?",
];

const sourceLabels: Record<string, string> = {
	aws: "AWS",
	gcp: "GCP",
	azure: "Azure",
	cloudflare: "Cloudflare",
	"ai-tokens": "AI Tokens",
	stripe: "Stripe",
	banking: "Open Banking",
};

function AiCfoChatScreen() {
	const connectedSourceIds = useStore(
		runwayStore,
		(state) => state.connectedSourceIds,
	);
	const canAskAiCfo = hasRequiredForecastSources(connectedSourceIds);
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "welcome",
			role: "assistant",
			content:
				"I can help model runway, explain cost pressure, and turn your connected cloud, revenue, and banking data into CFO-ready decisions. Ask a what-if question to start.",
		},
	]);
	const [isSending, setIsSending] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		if (!isSending) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	});

	const sendMessage = async (content: string) => {
		const trimmed = content.trim();
		if (!trimmed || isSending || !canAskAiCfo) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: trimmed,
		};
		const nextMessages = [...messages, userMessage];

		setMessages(nextMessages);
		setInput("");
		setIsSending(true);

		try {
			const response = await fetch("/api/ai-cfo/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: nextMessages,
					connectedSourceIds,
				}),
			});

			if (!response.ok) {
				const errorBody = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(errorBody.error ?? "AI CFO request failed");
			}

			const body = (await response.json()) as { reply?: string };
			setMessages((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content:
						body.reply ??
						"I could not produce a forecast from that question yet.",
				},
			]);
		} catch (error) {
			const fallbackMessage =
				error instanceof Error ? error.message : "The AI CFO request failed.";
			setMessages((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					content: fallbackMessage,
				},
			]);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="grid min-h-[calc(100vh-156px)] gap-4 lg:grid-cols-[0.34fr_0.66fr]">
				<aside className="island-shell rounded-2xl p-4 sm:p-5">
					<p className="island-kicker mb-2">AI CFO workspace</p>
					<h1 className="display-title m-0 text-3xl leading-tight font-bold text-[var(--sea-ink)] sm:text-4xl">
						Ask finance questions in context.
					</h1>
					<p className="mt-4 text-sm leading-6 text-[var(--sea-ink-soft)]">
						This chat is the dedicated LLM surface for runway, cash flow,
						infrastructure spend, and payout timing analysis.
					</p>

					<div className="mt-5 grid gap-2">
						<ContextPill
							icon={Cloud}
							label="Cloud sources"
							value={connectedSourceIds
								.filter((id) =>
									["aws", "gcp", "azure", "cloudflare"].includes(id),
								)
								.map((id) => sourceLabels[id])
								.join(", ")}
						/>
						<ContextPill
							icon={Wallet}
							label="Bank source"
							value={connectedSourceIds.includes("banking") ? "Connected" : ""}
						/>
						<ContextPill
							icon={Bot}
							label="AI tokens"
							value={
								connectedSourceIds.includes("ai-tokens") ? "Connected" : ""
							}
						/>
					</div>

					{canAskAiCfo ? (
						<div className="mt-6">
							<p className="mb-3 text-xs font-extrabold uppercase text-[var(--kicker)]">
								Quick prompts
							</p>
							<div className="space-y-2">
								{starterPrompts.map((prompt) => (
									<button
										className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5 text-left text-sm font-bold leading-5 text-[var(--sea-ink)] transition hover:-translate-y-0.5"
										key={prompt}
										onClick={() => sendMessage(prompt)}
										type="button"
									>
										{prompt}
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-100/70 p-4 dark:bg-amber-950/40">
							<p className="m-0 text-sm font-extrabold text-amber-900 dark:text-amber-100">
								Connect at least one cloud provider and one bank source before
								asking AI CFO questions.
							</p>
							<Link
								className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--sea-ink)] px-3 py-2 text-sm font-extrabold text-white no-underline"
								to="/connect"
							>
								Connect sources
								<ArrowRight size={15} />
							</Link>
						</div>
					)}
				</aside>

				<section className="island-shell flex min-h-[660px] flex-col overflow-hidden rounded-2xl">
					<div className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-4 sm:p-5">
						<div className="flex items-center gap-3">
							<div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
								<Bot size={20} />
							</div>
							<div>
								<p className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
									AI CFO
								</p>
								<p className="m-0 text-xs font-bold text-[var(--sea-ink-soft)]">
									Runway, burn, revenue, spend, and liquidity advisor
								</p>
							</div>
						</div>
						<span className="hidden rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-200 sm:inline-flex">
							Ready for LLM API
						</span>
					</div>

					<div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
						{messages.map((message) => (
							<MessageBubble key={message.id} message={message} />
						))}
						{isSending ? (
							<div className="flex items-center gap-2 text-sm font-bold text-[var(--sea-ink-soft)]">
								<Loader2 className="animate-spin" size={16} />
								AI CFO is building an answer...
							</div>
						) : null}
						<div ref={messagesEndRef} />
					</div>

					<form
						className="border-t border-[var(--line)] bg-[var(--surface-strong)] p-3 sm:p-4"
						onSubmit={(event) => {
							event.preventDefault();
							sendMessage(input);
						}}
					>
						<div className="flex items-end gap-2">
							<textarea
								className="min-h-12 max-h-40 flex-1 resize-none rounded-lg border border-[var(--line)] bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon-deep)] dark:bg-white/5"
								disabled={isSending || !canAskAiCfo}
								onChange={(event) => setInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey) {
										event.preventDefault();
										sendMessage(input);
									}
								}}
								placeholder="Ask about runway, burn, vendor spend, payout timing..."
								rows={2}
								value={input}
							/>
							<button
								aria-label="Send AI CFO message"
								className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--sea-ink)] text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
								disabled={!input.trim() || isSending || !canAskAiCfo}
								type="submit"
							>
								{isSending ? (
									<Loader2 className="animate-spin" size={18} />
								) : (
									<Send size={18} />
								)}
							</button>
						</div>
					</form>
				</section>
			</section>
		</main>
	);
}

function ContextPill({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Cloud;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-lg border border-[var(--line)] bg-white/55 p-3 dark:bg-white/5">
			<div className="mb-1 flex items-center gap-2">
				<Icon className="text-[var(--lagoon-deep)]" size={15} />
				<p className="m-0 text-xs font-extrabold uppercase text-[var(--kicker)]">
					{label}
				</p>
			</div>
			<p className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
				{value || "Not connected"}
			</p>
		</div>
	);
}

function MessageBubble({ message }: { message: Message }) {
	const isAssistant = message.role === "assistant";

	return (
		<article
			className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
		>
			{isAssistant ? (
				<div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
					<Sparkles size={16} />
				</div>
			) : null}
			<div
				className={`max-w-[86%] rounded-lg border px-4 py-3 text-sm leading-6 ${
					isAssistant
						? "border-[var(--line)] bg-white/62 text-[var(--sea-ink-soft)] dark:bg-white/5"
						: "border-[rgba(50,143,151,0.32)] bg-[rgba(79,184,178,0.16)] text-[var(--sea-ink)]"
				}`}
			>
				{isAssistant ? (
					<div className="prose prose-sm max-w-none dark:prose-invert">
						<Streamdown>{message.content}</Streamdown>
					</div>
				) : (
					<p className="m-0 font-bold">{message.content}</p>
				)}
			</div>
			{isAssistant ? null : (
				<div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-white/70 text-[var(--sea-ink)] dark:bg-white/10">
					<User size={16} />
				</div>
			)}
		</article>
	);
}
