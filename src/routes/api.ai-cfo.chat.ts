import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai-cfo/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as {
					messages?: Array<{ role: "assistant" | "user"; content: string }>;
					connectedSourceIds?: string[];
				};

				const lastQuestion =
					body.messages
						?.slice()
						.reverse()
						.find((message) => message.role === "user")?.content ?? "";

				return Response.json({
					reply: buildAiCfoReply(lastQuestion, body.connectedSourceIds ?? []),
				});
			},
		},
	},
});

function buildAiCfoReply(question: string, connectedSourceIds: string[]) {
	const connectedSources =
		connectedSourceIds.length > 0 ? connectedSourceIds.join(", ") : "none";
	const normalizedQuestion = question.toLowerCase();

	if (normalizedQuestion.includes("double")) {
		return `**Short answer:** doubled AI inference cost would likely move runway from about **7.2 months to 5.3 months** unless usage limits or model routing change.

**Why:** inference cost is currently behaving like a variable cloud expense, but revenue does not automatically rise with token volume. Treat this as margin leakage, not just infrastructure growth.

**Recommended moves:**
- Add account-level AI budgets before expanding free usage.
- Route summaries and repeat analysis to cheaper batch models.
- Cache identical forecast requests for high-volume accounts.

Connected context available for the future LLM provider: ${connectedSources}.`;
	}

	if (
		normalizedQuestion.includes("payout") ||
		normalizedQuestion.includes("stripe")
	) {
		return `**Cash impact:** a seven-day payout delay creates a temporary liquidity gap more than a revenue problem.

The immediate move is to protect operating cash during settlement windows. Shift cloud invoice timing where possible, keep at least **$35k** untouched for launch-week variance, and alert on daily payout deltas.

Connected context available for the future LLM provider: ${connectedSources}.`;
	}

	if (
		normalizedQuestion.includes("1 million") ||
		normalizedQuestion.includes("grow") ||
		normalizedQuestion.includes("users")
	) {
		return `**Forecast:** rapid user growth improves revenue, but spend lands first. Based on the current model, infrastructure could rise roughly **$48k/month** before cash collections fully catch up.

**Risk:** runway can compress from **7.2 months to about 4.8 months** if caching, free-tier limits, and vendor credits are not handled before traffic arrives.

**Next action:** cap high-cost API paths, improve CDN hit rate, and keep a liquidity reserve sized to at least one extra cloud billing cycle.

Connected context available for the future LLM provider: ${connectedSources}.`;
	}

	if (
		normalizedQuestion.includes("cut") ||
		normalizedQuestion.includes("driver") ||
		normalizedQuestion.includes("spend")
	) {
		return `Start with the costs that are growing faster than revenue and can be changed without reducing payroll capacity.

**Priority order:**
1. AI inference routing and caching.
2. Underutilized cloud workers and idle replicas.
3. CDN and data transfer efficiency.
4. Vendor tools with duplicate workflows.

Avoid cutting support or billing reliability first. Those savings are usually small and can damage collections.

Connected context available for the future LLM provider: ${connectedSources}.`;
	}

	return `I would frame this as a CFO question around **cash timing, margin pressure, and runway sensitivity**.

Current baseline assumptions in this prototype: **$410k** bank balance, **$137k** monthly revenue, **$66k** monthly infrastructure cost, and **7.2 months** estimated runway.

For the LLM integration, send this message history plus connected source context to the provider from this route: \`/api/ai-cfo/chat\`.

Connected context available for the future LLM provider: ${connectedSources}.`;
}
