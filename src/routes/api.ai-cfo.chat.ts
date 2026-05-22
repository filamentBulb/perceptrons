import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = {
	role: "assistant" | "user";
	content: string;
};

type WatsonxChatResponse = {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	errors?: Array<{
		message?: string;
	}>;
};

const WATSONX_URL =
	process.env.IBM_WATSONX_URL ?? "https://eu-de.ml.cloud.ibm.com";
const WATSONX_MODEL_IDS = uniqueModelIds([
	...(process.env.IBM_WATSONX_MODEL_ID?.split(",") ?? []),
	"meta-llama/llama-3-2-11b-vision-instruct",
	"Qwen-Qwen2-5-VL-32B-Instruct",
	"deepseek-ai/deepSeek-r1-distill-llama-8b-curated",
	"deepseek-ai/deepSeek-r1-distill-llama-70b-curated",
	"openai/gpt-oss-120b",
	"openai/gpt-oss-20b",
	"watsonx/openai/gpt-oss-120b",
	"ibm/granite-3-3-8b-instruct",
	"ibm/granite-3-8b-instruct",
	"ibm/granite-3-2b-instruct",
	"ibm/granite-13b-instruct-v2",
	"meta-llama/llama-3-2-3b-instruct",
	"meta-llama/llama-3-8b-instruct",
]);
const WATSONX_API_VERSION = process.env.IBM_WATSONX_API_VERSION ?? "2024-05-31";

let cachedIamToken: {
	accessToken: string;
	expiresAt: number;
} | null = null;

function uniqueModelIds(modelIds: string[]) {
	return Array.from(
		new Set(
			modelIds
				.map((modelId) => modelId.trim())
				.filter((modelId) => modelId.length > 0),
		),
	);
}

export const Route = createFileRoute("/api/ai-cfo/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = (await request.json()) as {
						messages?: ChatMessage[];
						connectedSourceIds?: string[];
					};

					const messages = sanitizeMessages(body.messages ?? []);
					if (messages.length === 0) {
						return Response.json(
							{ error: "At least one chat message is required." },
							{ status: 400 },
						);
					}

					const result = await askWatsonxAiCfo(
						messages,
						body.connectedSourceIds ?? [],
					);

					return Response.json(result);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "AI CFO request failed.";

					return Response.json({ error: message }, { status: 500 });
				}
			},
		},
	},
});

function sanitizeMessages(messages: ChatMessage[]) {
	return messages
		.filter(
			(message): message is ChatMessage =>
				(message.role === "assistant" || message.role === "user") &&
				typeof message.content === "string" &&
				message.content.trim().length > 0,
		)
		.slice(-12)
		.map((message) => ({
			role: message.role,
			content: message.content.trim(),
		}));
}

async function askWatsonxAiCfo(
	messages: ChatMessage[],
	connectedSourceIds: string[],
) {
	const apiKey = process.env.IBM_API_KEY;
	const projectId =
		process.env.IBM_WATSONX_PROJECT_ID ??
		process.env.IBM_PROJECT_ID ??
		process.env.WATSONX_PROJECT_ID;
	const spaceId =
		process.env.IBM_WATSONX_SPACE_ID ?? process.env.WATSONX_SPACE_ID;

	if (!apiKey) {
		throw new Error("IBM_API_KEY is not configured.");
	}

	if (!projectId && !spaceId) {
		throw new Error(
			"IBM_WATSONX_PROJECT_ID or IBM_WATSONX_SPACE_ID is required for watsonx.ai chat.",
		);
	}

	const accessToken = await getIamAccessToken(apiKey);
	const payload = {
		...(projectId ? { project_id: projectId } : { space_id: spaceId }),
		messages: [
			{
				role: "system",
				content: buildSystemPrompt(connectedSourceIds),
			},
			...messages.map((message) =>
				message.role === "user"
					? {
							role: message.role,
							content: [{ type: "text", text: message.content }],
						}
					: message,
			),
		],
		parameters: {
			max_tokens: 2000,
			temperature: 0.7,
		},
	};
	const modelErrors: string[] = [];

	for (const modelId of WATSONX_MODEL_IDS) {
		const response = await fetch(
			`${WATSONX_URL}/ml/v1/text/chat?version=${WATSONX_API_VERSION}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					...payload,
					model_id: modelId,
				}),
			},
		);

		const result = (await response
			.json()
			.catch(() => ({}))) as WatsonxChatResponse;

		if (!response.ok) {
			const errorMessage =
				result.errors?.[0]?.message ??
				`watsonx.ai chat failed with status ${response.status}.`;

			if (response.status === 401 || response.status === 403) {
				throw new Error(errorMessage);
			}

			modelErrors.push(`${modelId}: ${errorMessage}`);
			continue;
		}

		const reply = result.choices?.[0]?.message?.content?.trim();
		if (!reply) {
			modelErrors.push(`${modelId}: watsonx.ai returned an empty response.`);
			continue;
		}

		return { reply, model: modelId };
	}

	throw new Error(
		`No configured watsonx chat model was available. Tried: ${modelErrors.join(" | ")}`,
	);
}

async function getIamAccessToken(apiKey: string) {
	const now = Date.now();
	if (cachedIamToken && cachedIamToken.expiresAt - 60_000 > now) {
		return cachedIamToken.accessToken;
	}

	const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: new URLSearchParams({
			grant_type: "urn:ibm:params:oauth:grant-type:apikey",
			apikey: apiKey,
		}),
	});

	const result = (await response.json().catch(() => ({}))) as {
		access_token?: string;
		expires_in?: number;
		errorMessage?: string;
	};

	if (!response.ok || !result.access_token) {
		throw new Error(
			result.errorMessage ??
				`IBM IAM token request failed with ${response.status}.`,
		);
	}

	cachedIamToken = {
		accessToken: result.access_token,
		expiresAt: now + (result.expires_in ?? 3600) * 1000,
	};

	return cachedIamToken.accessToken;
}
function buildSystemPrompt(connectedSourceIds: string[]) {
	const connected = new Set(connectedSourceIds);
	const providerContext = AI_CFO_CONTEXT.sources
		.map((source) => {
			const status = connected.has(source.id) ? "connected" : "available";
			const services = source.services
				.map(
					(service) =>
						`- ${service.name}: ${service.count}; ${service.amount}; ${service.trend}; ${service.detail}`,
				)
				.join("\n");
			const events = source.events.map((event) => `- ${event}`).join("\n");

			return `## ${source.name} (${source.category}, ${status})
Headline: ${source.headline}
Monthly spend: ${source.monthlySpend ?? "n/a"}
Monthly in: ${source.monthlyIn ?? "n/a"}
Monthly out: ${source.monthlyOut ?? "n/a"}
Net cash: ${source.net ?? "n/a"}
Services:
${services}
Signals:
${events}`;
		})
		.join("\n\n");

	return `You are Runway AI CFO, a concise finance and infrastructure advisor for a startup.

Use the full provider and banking context below to answer cash runway, burn, cloud cost, revenue, payout, and what-if questions. Treat connected sources as live-authorized context and available sources as known planning context from the product prototype. Do not invent bank balances, provider names, or precise figures beyond this context unless you clearly label them as assumptions.

Answer in markdown. Prefer:
- a short direct answer first
- the financial driver behind it
- 2-4 specific actions
- any assumptions or missing source caveats

Baseline:
- Current operating cash: $410k
- Estimated runway: 7.2 months
- Monthly revenue: $137k Stripe plus $238k banking inflow context
- Monthly infrastructure/cloud vendor outflow: about $66k
- Payroll: $102k/month
- Minimum cash reserve target: $120k

Connected source IDs: ${connectedSourceIds.length ? connectedSourceIds.join(", ") : "none"}

Provider, revenue, and banking context:
${providerContext}`;
}

const AI_CFO_CONTEXT = {
	sources: [
		{
			id: "aws",
			name: "Amazon Web Services",
			category: "Cloud",
			headline: "18 AWS resources discovered across production and staging.",
			monthlySpend: "$42,380/mo",
			services: [
				{
					name: "EC2 instances",
					count: "12",
					amount: "$14,800",
					trend: "+18%",
					detail: "6 production, 4 workers, 2 staging",
				},
				{
					name: "ECS services",
					count: "9",
					amount: "$9,600",
					trend: "+22%",
					detail: "API, billing jobs, ingestion, webhooks",
				},
				{
					name: "Amplify apps",
					count: "3",
					amount: "$1,900",
					trend: "+6%",
					detail: "Marketing site, dashboard, admin console",
				},
				{
					name: "RDS databases",
					count: "4",
					amount: "$8,700",
					trend: "+12%",
					detail: "Primary Postgres, replica, analytics, staging",
				},
				{
					name: "S3 and data transfer",
					count: "21 TB",
					amount: "$7,380",
					trend: "+31%",
					detail: "Exports, logs, model artifacts, backups",
				},
			],
			events: [
				"t3.large workers run at 71% average utilization",
				"One RDS replica is idle outside business hours",
				"Data transfer is rising faster than active users",
			],
		},
		{
			id: "gcp",
			name: "Google Cloud Platform",
			category: "Cloud",
			headline: "GCP usage includes VPS capacity, APIs, and model workloads.",
			monthlySpend: "$21,640/mo",
			services: [
				{
					name: "Compute Engine VPS",
					count: "7",
					amount: "$7,900",
					trend: "+15%",
					detail: "EU and US background workers",
				},
				{
					name: "Cloud Run services",
					count: "11",
					amount: "$5,200",
					trend: "+27%",
					detail: "Forecasting API, importers, webhooks",
				},
				{
					name: "Vertex AI jobs",
					count: "4",
					amount: "$4,850",
					trend: "+38%",
					detail: "Batch scoring and embeddings",
				},
				{
					name: "API Gateway",
					count: "18.4M calls",
					amount: "$2,110",
					trend: "+19%",
					detail: "Public API and partner integrations",
				},
				{
					name: "BigQuery",
					count: "9.2 TB",
					amount: "$1,580",
					trend: "+8%",
					detail: "Revenue and usage warehouse",
				},
			],
			events: [
				"API calls have a weekend spike from one partner integration",
				"Vertex batch jobs overlap with peak user traffic",
				"Two Compute Engine machines are under 20% utilized",
			],
		},
		{
			id: "azure",
			name: "Microsoft Azure",
			category: "Cloud",
			headline: "Azure contributes mostly app hosting and AI spend.",
			monthlySpend: "$8,420/mo",
			services: [
				{
					name: "App Service plans",
					count: "5",
					amount: "$2,900",
					trend: "+10%",
					detail: "Customer portals and internal tools",
				},
				{
					name: "Virtual machines",
					count: "3",
					amount: "$1,780",
					trend: "+4%",
					detail: "Legacy processors",
				},
				{
					name: "Azure OpenAI",
					count: "8.8M tokens",
					amount: "$2,640",
					trend: "+34%",
					detail: "Support summaries and CFO drafts",
				},
				{
					name: "Storage accounts",
					count: "14 TB",
					amount: "$1,100",
					trend: "+7%",
					detail: "Exports and audit archives",
				},
			],
			events: [
				"Azure OpenAI cost is growing faster than revenue",
				"Legacy VMs can move to scheduled shutdown",
				"One App Service plan has spare capacity",
			],
		},
		{
			id: "cloudflare",
			name: "Cloudflare",
			category: "Cloud",
			headline:
				"Cloudflare is protecting margin, but Workers cost is climbing.",
			monthlySpend: "$7,180/mo",
			services: [
				{
					name: "CDN bandwidth",
					count: "42 TB",
					amount: "$2,300",
					trend: "+11%",
					detail: "Dashboard, exports, static assets",
				},
				{
					name: "Workers",
					count: "96M req",
					amount: "$3,240",
					trend: "+29%",
					detail: "Auth edge checks and API routing",
				},
				{
					name: "Images",
					count: "1.8M variants",
					amount: "$910",
					trend: "+17%",
					detail: "Receipts, invoices, avatars",
				},
				{
					name: "R2 storage",
					count: "8 TB",
					amount: "$730",
					trend: "+9%",
					detail: "Logs and generated reports",
				},
			],
			events: [
				"Cache hit rate is 82%; target is 91%",
				"Workers invocations doubled after API launch",
				"R2 egress remains cheaper than S3 transfer",
			],
		},
		{
			id: "stripe",
			name: "Stripe",
			category: "Revenue",
			headline: "Stripe shows revenue growth, payout lag, refunds, and fees.",
			monthlyIn: "$137,240",
			monthlyOut: "$31,760",
			net: "$105,480",
			services: [
				{
					name: "Subscription revenue",
					count: "2,184 paid",
					amount: "$104,600 in",
					trend: "+11%",
					detail: "Monthly SaaS plans and annual renewals",
				},
				{
					name: "Usage charges",
					count: "41,220 events",
					amount: "$32,640 in",
					trend: "+26%",
					detail: "API, AI forecasts, bulk exports",
				},
				{
					name: "Payouts pending",
					count: "5.6 days",
					amount: "$22,400 held",
					trend: "+7%",
					detail: "Cash not yet in bank balance",
				},
				{
					name: "Fees and refunds",
					count: "2.8% fees",
					amount: "$9,360 out",
					trend: "+4%",
					detail: "Processor fees, refunds, disputes",
				},
			],
			events: [
				"Net Stripe cash this month is $105.5k",
				"Refunds are stable, but failed payments rose 6%",
				"Payout lag creates a $22.4k working capital gap",
			],
		},
		{
			id: "banking",
			name: "Open Banking",
			category: "Banking",
			headline:
				"Operating account confirms positive cash flow and vendor timing.",
			monthlyIn: "$238,000",
			monthlyOut: "$203,600",
			net: "$34,400",
			services: [
				{
					name: "Operating balance",
					count: "$410k",
					amount: "7.2 mo",
					trend: "-4.8%",
					detail: "Current cash and runway estimate",
				},
				{
					name: "Payroll",
					count: "22 people",
					amount: "$102,000 out",
					trend: "+0%",
					detail: "Fixed monthly team cost",
				},
				{
					name: "Cloud vendors",
					count: "5 vendors",
					amount: "$66,000 out",
					trend: "+22%",
					detail: "AWS, GCP, Azure, Cloudflare, APIs",
				},
				{
					name: "Tools and APIs",
					count: "28 vendors",
					amount: "$35,600 out",
					trend: "+14%",
					detail: "Data, support, auth, email, monitoring",
				},
			],
			events: [
				"Cloud vendors now exceed 32% of all outgoing cash",
				"Payroll is stable; infrastructure is the variance driver",
				"Cash reserve should not fall below $120k",
			],
		},
	],
};
