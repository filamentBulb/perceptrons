import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import {
	Activity,
	ArrowRight,
	Banknote,
	Bot,
	Check,
	Cloud,
	CreditCard,
	type Database,
	DollarSign,
	ExternalLink,
	Landmark,
	Loader2,
	ReceiptText,
	Server,
	ShieldAlert,
	Sparkles,
	TrendingDown,
	Wallet,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	connectRunwaySource,
	hasRequiredForecastSources,
	runwayStore,
} from "../lib/runway-store";

export const Route = createFileRoute("/")({ component: App });

type Integration = {
	id: string;
	name: string;
	category: "Cloud" | "Revenue" | "Banking";
	detail: string;
	icon: typeof Cloud;
	authLabel: string;
	scope: string[];
	connectCopy: string;
};

type ServiceLine = {
	name: string;
	count: string;
	spend: string;
	trend: string;
	detail: string;
};

type ProviderMock = {
	headline: string;
	monthlySpend?: string;
	monthlyIn?: string;
	monthlyOut?: string;
	net?: string;
	services: ServiceLine[];
	events: string[];
};

type ForecastPoint = {
	label: string;
	cash: number;
	revenue: number;
	spend: number;
	runway: number;
};

type Scenario = {
	id: string;
	prompt: string;
	headline: string;
	summary: string;
	numbers: Array<[string, string]>;
	risk: "MEDIUM" | "HIGH" | "CRITICAL";
	keyRisk: string;
	recommendations: string[];
	confidence: number;
	basedOn: string[];
	metrics: {
		infraCost: string;
		revenue: string;
		payout: string;
		runway: string;
	};
	chart: ForecastPoint[];
};

const integrations: Integration[] = [
	{
		id: "aws",
		name: "Amazon Web Services",
		category: "Cloud",
		detail: "Compute, storage, database, AI services",
		icon: Cloud,
		authLabel: "AWS IAM Identity Center",
		scope: ["Cost Explorer", "EC2 inventory", "ECS services", "Amplify apps"],
		connectCopy: "Authorize read-only billing and resource access.",
	},
	{
		id: "gcp",
		name: "Google Cloud Platform",
		category: "Cloud",
		detail: "GPU usage, logs, managed services",
		icon: Cloud,
		authLabel: "Google Cloud OAuth",
		scope: ["Billing export", "Compute Engine", "Cloud Run", "API Gateway"],
		connectCopy: "Grant read-only project and billing visibility.",
	},
	{
		id: "azure",
		name: "Microsoft Azure",
		category: "Cloud",
		detail: "Cloud spend, credits, reserved capacity",
		icon: Cloud,
		authLabel: "Microsoft Entra ID",
		scope: [
			"Cost Management",
			"Virtual machines",
			"App Service",
			"OpenAI usage",
		],
		connectCopy: "Connect tenant billing and usage metrics.",
	},
	{
		id: "cloudflare",
		name: "Cloudflare",
		category: "Cloud",
		detail: "CDN, workers, bandwidth, caching",
		icon: Zap,
		authLabel: "Cloudflare API token",
		scope: ["CDN analytics", "Workers invocations", "Bandwidth", "Cache ratio"],
		connectCopy: "Add account-level edge usage and traffic costs.",
	},
	{
		id: "stripe",
		name: "Stripe",
		category: "Revenue",
		detail: "Subscriptions, payouts, failed payments",
		icon: CreditCard,
		authLabel: "Stripe Connect",
		scope: ["Balance", "Charges", "Payouts", "Refunds"],
		connectCopy: "Authorize revenue, fees, and payout timing.",
	},
	{
		id: "banking",
		name: "Open Banking",
		category: "Banking",
		detail: "Balance, burn, liquidity timing",
		icon: Landmark,
		authLabel: "Open Banking consent",
		scope: ["Operating balance", "Vendor payments", "Payroll", "Cash reserves"],
		connectCopy: "Share account balances and outgoing payments.",
	},
];

const providerMocks: Record<string, ProviderMock> = {
	aws: {
		headline: "18 AWS resources discovered across production and staging.",
		monthlySpend: "$42,380/mo",
		services: [
			{
				name: "EC2 instances",
				count: "12",
				spend: "$14,800",
				trend: "+18%",
				detail: "6 production, 4 workers, 2 staging",
			},
			{
				name: "ECS services",
				count: "9",
				spend: "$9,600",
				trend: "+22%",
				detail: "API, billing jobs, ingestion, webhooks",
			},
			{
				name: "Amplify apps",
				count: "3",
				spend: "$1,900",
				trend: "+6%",
				detail: "Marketing site, dashboard, admin console",
			},
			{
				name: "RDS databases",
				count: "4",
				spend: "$8,700",
				trend: "+12%",
				detail: "Primary Postgres, replica, analytics, staging",
			},
			{
				name: "S3 and data transfer",
				count: "21 TB",
				spend: "$7,380",
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
	gcp: {
		headline: "GCP usage includes VPS capacity, APIs, and model workloads.",
		monthlySpend: "$21,640/mo",
		services: [
			{
				name: "Compute Engine VPS",
				count: "7",
				spend: "$7,900",
				trend: "+15%",
				detail: "EU and US background workers",
			},
			{
				name: "Cloud Run services",
				count: "11",
				spend: "$5,200",
				trend: "+27%",
				detail: "Forecasting API, importers, webhooks",
			},
			{
				name: "Vertex AI jobs",
				count: "4",
				spend: "$4,850",
				trend: "+38%",
				detail: "Batch scoring and embeddings",
			},
			{
				name: "API Gateway",
				count: "18.4M calls",
				spend: "$2,110",
				trend: "+19%",
				detail: "Public API and partner integrations",
			},
			{
				name: "BigQuery",
				count: "9.2 TB",
				spend: "$1,580",
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
	azure: {
		headline: "Azure contributes mostly app hosting and AI spend.",
		monthlySpend: "$8,420/mo",
		services: [
			{
				name: "App Service plans",
				count: "5",
				spend: "$2,900",
				trend: "+10%",
				detail: "Customer portals and internal tools",
			},
			{
				name: "Virtual machines",
				count: "3",
				spend: "$1,780",
				trend: "+4%",
				detail: "Legacy processors",
			},
			{
				name: "Azure OpenAI",
				count: "8.8M tokens",
				spend: "$2,640",
				trend: "+34%",
				detail: "Support summaries and CFO drafts",
			},
			{
				name: "Storage accounts",
				count: "14 TB",
				spend: "$1,100",
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
	cloudflare: {
		headline: "Cloudflare is protecting margin, but Workers cost is climbing.",
		monthlySpend: "$7,180/mo",
		services: [
			{
				name: "CDN bandwidth",
				count: "42 TB",
				spend: "$2,300",
				trend: "+11%",
				detail: "Dashboard, exports, static assets",
			},
			{
				name: "Workers",
				count: "96M req",
				spend: "$3,240",
				trend: "+29%",
				detail: "Auth edge checks and API routing",
			},
			{
				name: "Images",
				count: "1.8M variants",
				spend: "$910",
				trend: "+17%",
				detail: "Receipts, invoices, avatars",
			},
			{
				name: "R2 storage",
				count: "8 TB",
				spend: "$730",
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
	stripe: {
		headline: "Stripe shows revenue growth, payout lag, refunds, and fees.",
		monthlyIn: "$137,240",
		monthlyOut: "$31,760",
		net: "$105,480",
		services: [
			{
				name: "Subscription revenue",
				count: "2,184 paid",
				spend: "$104,600 in",
				trend: "+11%",
				detail: "Monthly SaaS plans and annual renewals",
			},
			{
				name: "Usage charges",
				count: "41,220 events",
				spend: "$32,640 in",
				trend: "+26%",
				detail: "API, AI forecasts, bulk exports",
			},
			{
				name: "Payouts pending",
				count: "5.6 days",
				spend: "$22,400 held",
				trend: "+7%",
				detail: "Cash not yet in bank balance",
			},
			{
				name: "Fees and refunds",
				count: "2.8% fees",
				spend: "$9,360 out",
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
	banking: {
		headline:
			"Operating account confirms positive cash flow and vendor timing.",
		monthlyIn: "$238,000",
		monthlyOut: "$203,600",
		net: "$34,400",
		services: [
			{
				name: "Operating balance",
				count: "$410k",
				spend: "7.2 mo",
				trend: "-4.8%",
				detail: "Current cash and runway estimate",
			},
			{
				name: "Payroll",
				count: "22 people",
				spend: "$102,000 out",
				trend: "+0%",
				detail: "Fixed monthly team cost",
			},
			{
				name: "Cloud vendors",
				count: "5 vendors",
				spend: "$66,000 out",
				trend: "+22%",
				detail: "AWS, GCP, Azure, Cloudflare, APIs",
			},
			{
				name: "Tools and APIs",
				count: "28 vendors",
				spend: "$35,600 out",
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
};

const monthlyBudget = [
	{ label: "May", revenue: 205, cloud: 49, payroll: 102, tools: 27 },
	{ label: "Jun", revenue: 218, cloud: 55, payroll: 102, tools: 29 },
	{ label: "Jul", revenue: 232, cloud: 61, payroll: 102, tools: 31 },
	{ label: "Aug", revenue: 248, cloud: 66, payroll: 102, tools: 36 },
	{ label: "Sep", revenue: 269, cloud: 81, payroll: 106, tools: 39 },
	{ label: "Oct", revenue: 291, cloud: 94, payroll: 106, tools: 42 },
];

const serviceSpend = [
	{ label: "AWS", value: 42.4, color: "#2563eb" },
	{ label: "GCP", value: 21.6, color: "#16a34a" },
	{ label: "Azure", value: 8.4, color: "#7c3aed" },
	{ label: "Cloudflare", value: 7.2, color: "#f59e0b" },
	{ label: "APIs", value: 6.8, color: "#dc2626" },
];

const baseChart: ForecastPoint[] = [
	{ label: "Now", cash: 410, revenue: 96, spend: 42, runway: 410 },
	{ label: "Jun", cash: 386, revenue: 108, spend: 49, runway: 386 },
	{ label: "Jul", cash: 356, revenue: 119, spend: 58, runway: 356 },
	{ label: "Aug", cash: 321, revenue: 130, spend: 66, runway: 321 },
	{ label: "Sep", cash: 279, revenue: 139, spend: 73, runway: 279 },
	{ label: "Oct", cash: 232, revenue: 147, spend: 81, runway: 232 },
];

const scenarios: Scenario[] = [
	{
		id: "growth",
		prompt: "What happens if our users grow from 100k to 1 million?",
		headline: "Viral growth compresses runway unless cloud spend is capped.",
		summary:
			"User growth drives revenue up, but infrastructure costs move first and cash collection trails usage by almost a week.",
		numbers: [
			["Estimated infrastructure cost", "+$48,000/mo"],
			["Estimated revenue increase", "+$31,000/mo"],
			["Pending payout exposure", "+$22,000"],
			["Runway impact", "7.2 -> 4.8 months"],
		],
		risk: "HIGH",
		keyRisk:
			"Infrastructure costs scale immediately while revenue settlements lag by 5-7 days.",
		recommendations: [
			"Increase CDN caching before campaign launch",
			"Reduce free-tier API usage for high-volume accounts",
			"Prepare a $50k liquidity reserve",
			"Negotiate cloud credits before paid acquisition starts",
		],
		confidence: 78,
		basedOn: [
			"$0.42 current AWS spend per active user",
			"5.6 day average Stripe settlement window",
			"18% month-over-month traffic trend",
		],
		metrics: {
			infraCost: "$94k",
			revenue: "$162k",
			payout: "$54k",
			runway: "4.8 mo",
		},
		chart: [
			{ label: "Now", cash: 410, revenue: 96, spend: 42, runway: 410 },
			{ label: "Jun", cash: 378, revenue: 115, spend: 63, runway: 378 },
			{ label: "Jul", cash: 332, revenue: 136, spend: 82, runway: 332 },
			{ label: "Aug", cash: 284, revenue: 151, spend: 94, runway: 284 },
			{ label: "Sep", cash: 229, revenue: 162, spend: 104, runway: 229 },
			{ label: "Oct", cash: 171, revenue: 169, spend: 111, runway: 171 },
		],
	},
	{
		id: "payout-delay",
		prompt: "What if Stripe payouts are delayed 7 days?",
		headline: "Cash stays solvent, but the launch week becomes fragile.",
		summary:
			"Revenue is still healthy, but a payout delay creates a liquidity trough right when usage and support costs peak.",
		numbers: [
			["Delayed cash receipts", "$41,000"],
			["Minimum balance in period", "$188,000"],
			["Vendor payment conflict", "12 days"],
			["Runway impact", "7.2 -> 6.1 months"],
		],
		risk: "MEDIUM",
		keyRisk:
			"The business is profitable on paper but temporarily underfunded during settlement delays.",
		recommendations: [
			"Move cloud invoices five days later",
			"Keep $35k in operating cash untouched",
			"Turn on payout alerts for daily variance",
			"Pause discretionary acquisition during delay windows",
		],
		confidence: 84,
		basedOn: [
			"$137k monthly Stripe volume",
			"$23k weekly infrastructure invoices",
			"Current $410k bank balance",
		],
		metrics: {
			infraCost: "$66k",
			revenue: "$137k",
			payout: "$41k",
			runway: "6.1 mo",
		},
		chart: [
			{ label: "Now", cash: 410, revenue: 96, spend: 42, runway: 410 },
			{ label: "Jun", cash: 368, revenue: 106, spend: 49, runway: 368 },
			{ label: "Jul", cash: 342, revenue: 118, spend: 57, runway: 342 },
			{ label: "Aug", cash: 303, revenue: 128, spend: 64, runway: 303 },
			{ label: "Sep", cash: 271, revenue: 137, spend: 71, runway: 271 },
			{ label: "Oct", cash: 238, revenue: 145, spend: 78, runway: 238 },
		],
	},
	{
		id: "inference",
		prompt: "How much runway do we lose if AI inference costs double?",
		headline: "Inference pricing is the fastest path to a cash crunch.",
		summary:
			"Revenue does not naturally rise with token usage, so doubled inference cost turns product engagement into margin pressure.",
		numbers: [
			["AI cost increase", "+$37,000/mo"],
			["Gross margin impact", "-14 points"],
			["Monthly burn change", "+$29,000"],
			["Runway impact", "7.2 -> 5.3 months"],
		],
		risk: "HIGH",
		keyRisk:
			"Power users can consume margin faster than subscription revenue replenishes cash.",
		recommendations: [
			"Add account-level inference budgets",
			"Move summaries to a cheaper batch model",
			"Cache repeated analysis requests",
			"Gate high-cost simulations behind paid tiers",
		],
		confidence: 81,
		basedOn: [
			"31% of requests currently invoke AI forecasting",
			"$0.018 average inference cost per session",
			"Top 8% of users generate 44% of token volume",
		],
		metrics: {
			infraCost: "$103k",
			revenue: "$137k",
			payout: "$31k",
			runway: "5.3 mo",
		},
		chart: [
			{ label: "Now", cash: 410, revenue: 96, spend: 42, runway: 410 },
			{ label: "Jun", cash: 373, revenue: 108, spend: 68, runway: 373 },
			{ label: "Jul", cash: 337, revenue: 119, spend: 82, runway: 337 },
			{ label: "Aug", cash: 291, revenue: 130, spend: 95, runway: 291 },
			{ label: "Sep", cash: 244, revenue: 137, spend: 103, runway: 244 },
			{ label: "Oct", cash: 199, revenue: 143, spend: 109, runway: 199 },
		],
	},
	{
		id: "conversion",
		prompt: "What happens if conversion drops 20%?",
		headline: "A modest conversion drop removes nearly two months of runway.",
		summary:
			"The cost base barely changes, but revenue expansion slows enough to expose fixed cloud and payroll commitments.",
		numbers: [
			["Monthly revenue loss", "-$27,000/mo"],
			["Cash shortfall by October", "$86,000"],
			["Burn multiple change", "1.6x -> 2.1x"],
			["Runway impact", "7.2 -> 5.5 months"],
		],
		risk: "HIGH",
		keyRisk:
			"Usage-linked infrastructure keeps rising while fewer users convert into settled revenue.",
		recommendations: [
			"Shift spend to highest-intent acquisition channels",
			"Tighten free-plan usage thresholds",
			"Launch annual prepay offer",
			"Delay non-critical infrastructure upgrades",
		],
		confidence: 74,
		basedOn: [
			"6.8% current visitor-to-paid conversion",
			"$74 blended CAC",
			"$66k fixed monthly infrastructure baseline",
		],
		metrics: {
			infraCost: "$74k",
			revenue: "$110k",
			payout: "$24k",
			runway: "5.5 mo",
		},
		chart: [
			{ label: "Now", cash: 410, revenue: 96, spend: 42, runway: 410 },
			{ label: "Jun", cash: 382, revenue: 101, spend: 51, runway: 382 },
			{ label: "Jul", cash: 347, revenue: 105, spend: 59, runway: 347 },
			{ label: "Aug", cash: 303, revenue: 108, spend: 66, runway: 303 },
			{ label: "Sep", cash: 257, revenue: 110, spend: 72, runway: 257 },
			{ label: "Oct", cash: 207, revenue: 112, spend: 77, runway: 207 },
		],
	},
];

const moneySources = [
	["Stripe incoming", "$137k", "+18%"],
	["Subscriptions", "$104k", "+11%"],
	["Transactions", "$33k", "+26%"],
];

const moneySinks = [
	["AWS", "$42k", "+14%"],
	["GPU inference", "$18k", "+31%"],
	["CDN", "$7k", "+9%"],
	["APIs", "$6k", "+16%"],
];

function App() {
	const navigate = useNavigate();
	const connected = useStore(runwayStore, (state) => state.connectedSourceIds);
	const [hasMounted, setHasMounted] = useState(false);
	const [pendingIntegration, setPendingIntegration] =
		useState<Integration | null>(null);
	const [connectionStep, setConnectionStep] = useState(0);
	const [dashboardUnlocked, setDashboardUnlocked] = useState(true);
	const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0].id);

	const activeScenario = useMemo(
		() =>
			scenarios.find((scenario) => scenario.id === activeScenarioId) ??
			scenarios[0],
		[activeScenarioId],
	);

	const canViewForecasts = hasRequiredForecastSources(connected);
	const chartData = canViewForecasts ? activeScenario.chart : baseChart;
	const connectedEnough = canViewForecasts;
	const connectedProviders = integrations.filter((integration) =>
		connected.includes(integration.id),
	);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	useEffect(() => {
		if (!hasMounted || canViewForecasts) return;

		navigate({ to: "/connect", replace: true });
	}, [canViewForecasts, hasMounted, navigate]);

	const openConnection = (integration: Integration) => {
		if (connected.includes(integration.id)) return;
		setPendingIntegration(integration);
		setConnectionStep(0);
	};

	const advanceConnection = () => {
		if (!pendingIntegration) return;

		if (connectionStep < 2) {
			setConnectionStep((step) => step + 1);
			return;
		}

		connectRunwaySource(pendingIntegration.id);
		setPendingIntegration(null);
		setConnectionStep(0);
	};

	const continueToDashboard = () => {
		setDashboardUnlocked(true);
		window.setTimeout(() => {
			document.getElementById("money-flow")?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}, 50);
	};

	if (!hasMounted || !canViewForecasts) {
		return (
			<main className="page-wrap px-4 pb-8 pt-8">
				<section className="island-shell rounded-2xl p-6">
					<p className="island-kicker mb-2">Preparing live forecasts</p>
					<h1 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
						Connect a cloud provider and bank source to continue.
					</h1>
				</section>
			</main>
		);
	}

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
				<div className="rise-in">
					<p className="island-kicker mb-3">AI financial survival co-pilot</p>
					<h1 className="display-title mb-5 max-w-4xl text-4xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-6xl">
						Predict whether growth breaks your startup before cash runs out.
					</h1>
					<p className="mb-7 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)] sm:text-lg">
						Connect revenue, bank balance, and cloud spend. Ask what-if
						questions. See runway, risk, and recommended moves update in real
						time.
					</p>
					<div className="flex flex-wrap gap-3">
						<a
							href="#ai-cfo"
							className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-bold text-[var(--sea-ink)] no-underline hover:-translate-y-0.5"
						>
							Ask AI CFO
							<ArrowRight size={16} />
						</a>
					</div>
				</div>

				<div className="island-shell rise-in rounded-2xl p-4 sm:p-5">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<p className="island-kicker mb-1">Live forecast</p>
							<h2 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
								Startup survival model
							</h2>
						</div>
						<div className="rounded-lg border border-amber-500/30 bg-amber-100/70 px-3 py-2 text-xs font-extrabold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
							{connectedEnough ? activeScenario.risk : "BASELINE"} RISK
						</div>
					</div>
					<MoneyFlowChart
						data={chartData}
						danger={connectedEnough}
						scenarioId={connectedEnough ? activeScenario.id : "baseline"}
					/>
				</div>
			</section>

			<section id="connect" className="hidden">
				<div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
					<div>
						<p className="island-kicker mb-2">Step 1</p>
						<h2 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
							Connect your startup stack
						</h2>
					</div>
					<div className="min-h-6 text-sm font-bold text-[var(--sea-ink-soft)]">
						{connected.length}/{integrations.length} sources connected
					</div>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{integrations.map((integration) => {
						const Icon = integration.icon;
						const isConnected = connected.includes(integration.id);
						const mock = providerMocks[integration.id];

						return (
							<article
								className="feature-card rounded-lg p-4"
								key={integration.id}
							>
								<div className="mb-4 flex items-start justify-between gap-3">
									<div className="flex gap-3">
										<div className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] bg-white/70 text-[var(--lagoon-deep)] dark:bg-white/10">
											<Icon size={19} />
										</div>
										<div>
											<p className="m-0 text-xs font-extrabold uppercase text-[var(--kicker)]">
												{integration.category}
											</p>
											<h3 className="m-0 text-base font-extrabold text-[var(--sea-ink)]">
												{integration.name}
											</h3>
										</div>
									</div>
									{isConnected ? (
										<span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white">
											<Check size={16} />
										</span>
									) : null}
								</div>
								<p className="mb-4 text-sm leading-6 text-[var(--sea-ink-soft)]">
									{integration.detail}
								</p>
								{isConnected ? (
									<div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
										<p className="m-0 text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-200">
											Source data synced
										</p>
										<p className="m-0 mt-1 text-sm font-bold text-[var(--sea-ink)]">
											{mock.headline}
										</p>
										<div className="mt-3 grid gap-2">
											{mock.services.slice(0, 3).map((service) => (
												<div
													className="flex items-center justify-between gap-3 text-xs"
													key={service.name}
												>
													<span className="font-bold text-[var(--sea-ink-soft)]">
														{service.name}
													</span>
													<span className="font-extrabold text-[var(--sea-ink)]">
														{service.count} · {service.spend}
													</span>
												</div>
											))}
										</div>
									</div>
								) : null}
								<button
									className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-extrabold text-[var(--sea-ink)] hover:-translate-y-0.5 disabled:cursor-default disabled:bg-emerald-500/10 disabled:text-emerald-700 disabled:hover:translate-y-0 dark:disabled:text-emerald-200"
									disabled={isConnected}
									onClick={() => openConnection(integration)}
									type="button"
								>
									{isConnected ? "Connected" : "Connect"}
								</button>
							</article>
						);
					})}
				</div>
				<div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 sm:flex-row sm:items-center">
					<div>
						<p className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
							{connected.length > 0
								? "Connections are ready for analysis."
								: "Connect at least one source to generate the financial dataset."}
						</p>
						<p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
							The next screen turns connected cloud, bank, and Stripe data into
							budget, cash flow, and risk graphs.
						</p>
					</div>
					<button
						className="inline-flex items-center gap-2 rounded-lg border border-[rgba(23,58,64,0.18)] bg-[var(--sea-ink)] px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
						disabled={connected.length === 0}
						onClick={continueToDashboard}
						type="button"
					>
						Continue to financial view
						<ArrowRight size={16} />
					</button>
				</div>
			</section>

			{connectedProviders.length > 0 ? (
				<section className="mt-8">
					<div className="mb-4">
						<p className="island-kicker mb-2">Connected source data</p>
						<h2 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
							What the system discovered
						</h2>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						{connectedProviders.map((provider) => (
							<ProviderDataCard
								integration={provider}
								key={provider.id}
								mock={providerMocks[provider.id]}
							/>
						))}
					</div>
				</section>
			) : null}

			<section
				className={dashboardUnlocked ? "mt-10" : "hidden"}
				id="money-flow"
			>
				<div className="mb-4">
					<p className="island-kicker mb-2">Step 2</p>
					<h2 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
						Live money flow
					</h2>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<MetricCard
						icon={Wallet}
						label="Bank Balance"
						value="$410k"
						note="-4.8% this month"
					/>
					<MetricCard
						icon={Activity}
						label="Monthly Revenue"
						value={connectedEnough ? activeScenario.metrics.revenue : "$137k"}
						note="+18% trend"
					/>
					<MetricCard
						icon={Cloud}
						label="Infrastructure Cost"
						value={connectedEnough ? activeScenario.metrics.infraCost : "$66k"}
						note="+22% trend"
					/>
					<MetricCard
						icon={Banknote}
						label="Pending Payouts"
						value={connectedEnough ? activeScenario.metrics.payout : "$31k"}
						note="5.6 day lag"
					/>
					<MetricCard
						icon={TrendingDown}
						label="Estimated Runway"
						value={connectedEnough ? activeScenario.metrics.runway : "7.2 mo"}
						note="current burn"
					/>
				</div>

				<div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
					<div className="island-shell rounded-2xl p-4 sm:p-5">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="island-kicker mb-1">Cash, revenue, spend</p>
								<h3 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
									Six-month survival forecast
								</h3>
							</div>
							<div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--sea-ink-soft)]">
								<Legend color="#2563eb" label="Cash balance" />
								<Legend color="#16a34a" label="Revenue inflow" />
								<Legend color="#dc2626" label="Infra spend" />
							</div>
						</div>
						<MoneyFlowChart
							data={chartData}
							danger={connectedEnough}
							scenarioId={connectedEnough ? activeScenario.id : "baseline"}
						/>
					</div>

					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
						<FlowList title="Money Sources" rows={moneySources} good />
						<FlowList title="Money Sinks" rows={moneySinks} />
					</div>
				</div>
			</section>

			<section className={dashboardUnlocked ? "mt-10" : "hidden"}>
				<div className="mb-4">
					<p className="island-kicker mb-2">Budget intelligence</p>
					<h2 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
						Monthly budget and cost drivers
					</h2>
				</div>
				<div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
					<div className="island-shell rounded-2xl p-4 sm:p-5">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="island-kicker mb-1">Budget view</p>
								<h3 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
									Revenue vs monthly outgoing cash
								</h3>
							</div>
							<div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--sea-ink-soft)]">
								<Legend color="#16a34a" label="Revenue" />
								<Legend color="#2563eb" label="Cloud" />
								<Legend color="#7c3aed" label="Payroll" />
								<Legend color="#f59e0b" label="Tools" />
							</div>
						</div>
						<BudgetStackedBars data={monthlyBudget} />
					</div>
					<div className="grid gap-4">
						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<p className="island-kicker mb-1">Cloud and API spend</p>
							<h3 className="mb-4 text-lg font-extrabold text-[var(--sea-ink)]">
								Current monthly cost mix
							</h3>
							<ServiceSpendBars data={serviceSpend} />
						</div>
						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<p className="island-kicker mb-1">Chat context</p>
							<h3 className="mb-3 text-lg font-extrabold text-[var(--sea-ink)]">
								Data ready for AI CFO
							</h3>
							<ul className="m-0 space-y-2 p-0">
								{[
									"Provider inventories and service counts",
									"Monthly revenue, payouts, refunds, and fees",
									"Cloud spend by provider and service",
									"Budget trend, runway, and scenario forecasts",
								].map((item) => (
									<li
										className="flex gap-2 text-sm leading-6 text-[var(--sea-ink-soft)]"
										key={item}
									>
										<Check
											className="mt-1 shrink-0 text-emerald-600"
											size={15}
										/>
										{item}
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</section>

			<section
				id="ai-cfo"
				className={
					dashboardUnlocked
						? "mt-10 grid gap-4 lg:grid-cols-[0.86fr_1.14fr]"
						: "hidden"
				}
			>
				<div className="island-shell rounded-2xl p-4 sm:p-5">
					<p className="island-kicker mb-2">Step 3</p>
					<h2 className="mb-4 text-2xl font-extrabold text-[var(--sea-ink)]">
						AI CFO chat
					</h2>
					<div className="space-y-3">
						{scenarios.map((scenario) => (
							<button
								className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-bold leading-6 transition ${
									scenario.id === activeScenario.id
										? "border-[rgba(50,143,151,0.45)] bg-[rgba(79,184,178,0.16)] text-[var(--sea-ink)] shadow-[0_12px_24px_rgba(23,58,64,0.08)]"
										: "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:-translate-y-0.5 hover:text-[var(--sea-ink)]"
								}`}
								key={scenario.id}
								onClick={() => setActiveScenarioId(scenario.id)}
								type="button"
							>
								{scenario.prompt}
							</button>
						))}
					</div>
				</div>

				<div className="island-shell rounded-2xl p-4 sm:p-5">
					<div className="mb-4 flex items-start gap-3 border-b border-[var(--line)] pb-4">
						<div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
							<Bot size={20} />
						</div>
						<div>
							<p className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
								{activeScenario.prompt}
							</p>
							<p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
								Based on current metrics from connected revenue, cloud, and
								banking sources.
							</p>
						</div>
					</div>

					<div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
						<div>
							<ResponseSection icon={Sparkles} title="Forecast Summary">
								<p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
									{activeScenario.summary}
								</p>
								<div className="mt-3 grid gap-2 sm:grid-cols-2">
									{activeScenario.numbers.map(([label, value]) => (
										<div
											className="rounded-lg border border-[var(--line)] bg-white/55 p-3 dark:bg-white/5"
											key={label}
										>
											<p className="m-0 text-xs font-bold text-[var(--sea-ink-soft)]">
												{label}
											</p>
											<p className="m-0 mt-1 text-lg font-extrabold text-[var(--sea-ink)]">
												{value}
											</p>
										</div>
									))}
								</div>
							</ResponseSection>

							<ResponseSection icon={ShieldAlert} title="Risk Level">
								<div className="inline-flex rounded-lg border border-red-500/30 bg-red-100 px-3 py-2 text-sm font-extrabold text-red-700 dark:bg-red-950/40 dark:text-red-200">
									{activeScenario.risk}
								</div>
								<p className="mt-3 text-sm leading-6 text-[var(--sea-ink-soft)]">
									{activeScenario.keyRisk}
								</p>
							</ResponseSection>

							<ResponseSection icon={ArrowRight} title="Recommendation">
								<ul className="m-0 space-y-2 p-0">
									{activeScenario.recommendations.map((recommendation) => (
										<li
											className="flex gap-2 text-sm leading-6 text-[var(--sea-ink-soft)]"
											key={recommendation}
										>
											<Check
												className="mt-1 shrink-0 text-emerald-600"
												size={15}
											/>
											{recommendation}
										</li>
									))}
								</ul>
							</ResponseSection>
						</div>

						<aside className="rounded-2xl border border-[var(--line)] bg-white/55 p-4 dark:bg-white/5">
							<p className="island-kicker mb-2">AI Confidence Level</p>
							<div className="mb-4 flex items-end gap-2">
								<span className="text-4xl font-extrabold text-[var(--sea-ink)]">
									{activeScenario.confidence}%
								</span>
								<span className="pb-1 text-sm font-bold text-[var(--sea-ink-soft)]">
									confidence
								</span>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-[rgba(23,58,64,0.12)]">
								<div
									className="h-full rounded-full bg-[linear-gradient(90deg,#16a34a,#f59e0b)]"
									style={{ width: `${activeScenario.confidence}%` }}
								/>
							</div>
							<p className="mb-3 mt-5 text-sm font-extrabold text-[var(--sea-ink)]">
								Based on current metrics
							</p>
							<ul className="m-0 space-y-2 p-0">
								{activeScenario.basedOn.map((item) => (
									<li
										className="border-b border-[var(--line)] pb-2 text-sm leading-6 text-[var(--sea-ink-soft)] last:border-0 last:pb-0"
										key={item}
									>
										{item}
									</li>
								))}
							</ul>
						</aside>
					</div>
				</div>
			</section>

			{pendingIntegration ? (
				<ConnectionModal
					integration={pendingIntegration}
					mock={providerMocks[pendingIntegration.id]}
					onAdvance={advanceConnection}
					onClose={() => setPendingIntegration(null)}
					step={connectionStep}
				/>
			) : null}
		</main>
	);
}

function MetricCard({
	icon: Icon,
	label,
	value,
	note,
}: {
	icon: typeof Wallet;
	label: string;
	value: string;
	note: string;
}) {
	return (
		<article className="feature-card rounded-lg p-4">
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="m-0 text-xs font-extrabold uppercase text-[var(--kicker)]">
					{label}
				</p>
				<Icon className="text-[var(--lagoon-deep)]" size={18} />
			</div>
			<p className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
				{value}
			</p>
			<p className="m-0 mt-1 text-sm font-semibold text-[var(--sea-ink-soft)]">
				{note}
			</p>
		</article>
	);
}

function ConnectionModal({
	integration,
	mock,
	step,
	onAdvance,
	onClose,
}: {
	integration: Integration;
	mock: ProviderMock;
	step: number;
	onAdvance: () => void;
	onClose: () => void;
}) {
	const Icon = integration.icon;
	const [syncReady, setSyncReady] = useState(step !== 2);
	const steps = [
		{
			title: `Connect ${integration.name}`,
			body: integration.connectCopy,
			action: "Open authorization screen",
		},
		{
			title: integration.authLabel,
			body: "Review requested permissions and approve secure read-only access.",
			action: "Allow read-only access",
		},
		{
			title: "Syncing business data",
			body: "Pulling resource inventory, cost history, cash flow, and settlement timing.",
			action: "Finish sync",
		},
	];
	const current = steps[step];
	const isFinalSyncStep = step === 2;
	const isButtonDisabled = isFinalSyncStep && !syncReady;

	useEffect(() => {
		if (!isFinalSyncStep) {
			setSyncReady(true);
			return;
		}

		setSyncReady(false);
		const timeoutId = window.setTimeout(() => setSyncReady(true), 1000);

		return () => window.clearTimeout(timeoutId);
	}, [isFinalSyncStep]);

	return (
		<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
			<div className="w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-5">
				<div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
					<div className="flex gap-3">
						<div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
							<Icon size={21} />
						</div>
						<div>
							<p className="island-kicker mb-1">Secure authorization</p>
							<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
								{current.title}
							</h2>
						</div>
					</div>
					<button
						aria-label="Close connection modal"
						className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] bg-white/60 text-[var(--sea-ink)] hover:-translate-y-0.5 dark:bg-white/10"
						onClick={onClose}
						type="button"
					>
						<X size={17} />
					</button>
				</div>

				<div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
					<div className="rounded-xl border border-[var(--line)] bg-white/55 p-4 dark:bg-white/5">
						<div className="mb-4 flex gap-2">
							{steps.map((item, index) => (
								<div
									className={`h-2 flex-1 rounded-full ${
										index <= step ? "bg-[var(--lagoon-deep)]" : "bg-slate-300"
									}`}
									key={item.title}
								/>
							))}
						</div>
						<p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
							{current.body}
						</p>
						<div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3">
							<p className="m-0 text-xs font-extrabold uppercase text-[var(--kicker)]">
								Requested scope
							</p>
							<ul className="m-0 mt-2 space-y-2 p-0">
								{integration.scope.map((scope) => (
									<li
										className="flex gap-2 text-sm text-[var(--sea-ink-soft)]"
										key={scope}
									>
										<Check
											className="mt-0.5 shrink-0 text-emerald-600"
											size={15}
										/>
										{scope}
									</li>
								))}
							</ul>
						</div>
						<button
							className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--sea-ink)] px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-700"
							disabled={isButtonDisabled}
							onClick={onAdvance}
							type="button"
						>
							{isButtonDisabled ? (
								<Loader2 className="animate-spin" size={16} />
							) : (
								<ExternalLink size={16} />
							)}
							{isButtonDisabled ? "Syncing business data..." : current.action}
						</button>
					</div>

					<div className="rounded-xl border border-[var(--line)] bg-slate-950 p-4 text-white">
						{isFinalSyncStep ? (
							<>
								<p className="m-0 text-xs font-extrabold uppercase tracking-widest text-emerald-300">
									Preview data to import
								</p>
								<h3 className="mb-4 mt-2 text-lg font-extrabold">
									{mock.headline}
								</h3>
								<div className="grid gap-2 sm:grid-cols-3">
									{mock.monthlySpend ? (
										<DarkStat label="Monthly spend" value={mock.monthlySpend} />
									) : null}
									{mock.monthlyIn ? (
										<DarkStat label="Money in" value={mock.monthlyIn} />
									) : null}
									{mock.monthlyOut ? (
										<DarkStat label="Money out" value={mock.monthlyOut} />
									) : null}
									{mock.net ? (
										<DarkStat label="Net cash" value={mock.net} />
									) : null}
								</div>
								<div className="mt-4 space-y-2">
									{mock.services.slice(0, 4).map((service) => (
										<div
											className="rounded-lg border border-white/10 bg-white/5 p-3"
											key={service.name}
										>
											<div className="flex items-center justify-between gap-3">
												<span className="text-sm font-bold">
													{service.name}
												</span>
												<span className="text-sm font-extrabold text-emerald-300">
													{service.count}
												</span>
											</div>
											<p className="m-0 mt-1 text-xs text-slate-300">
												{service.spend} · {service.detail}
											</p>
										</div>
									))}
								</div>
							</>
						) : (
							<div className="grid min-h-[280px] place-items-center rounded-lg border border-white/10 bg-white/5 p-5 text-center">
								<div>
									<ShieldAlert
										className="mx-auto mb-3 text-emerald-300"
										size={28}
									/>
									<p className="m-0 text-xs font-extrabold uppercase tracking-widest text-emerald-300">
										Preview locked
									</p>
									<p className="m-0 mt-2 text-sm leading-6 text-slate-300">
										Imported provider data is shown only after authorization is
										approved and the final sync step starts.
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function DarkStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-white/10 bg-white/5 p-3">
			<p className="m-0 text-xs text-slate-300">{label}</p>
			<p className="m-0 mt-1 text-lg font-extrabold">{value}</p>
		</div>
	);
}

function ProviderDataCard({
	integration,
	mock,
}: {
	integration: Integration;
	mock: ProviderMock;
}) {
	const Icon = integration.icon;

	return (
		<article className="island-shell rounded-2xl p-4 sm:p-5">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="flex gap-3">
					<div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
						<Icon size={19} />
					</div>
					<div>
						<p className="island-kicker mb-1">{integration.category}</p>
						<h3 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
							{integration.name}
						</h3>
					</div>
				</div>
				<span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-200">
					Synced
				</span>
			</div>

			<div className="mb-4 grid gap-2 sm:grid-cols-3">
				{mock.monthlySpend ? (
					<MiniStat icon={Server} label="Spend" value={mock.monthlySpend} />
				) : null}
				{mock.monthlyIn ? (
					<MiniStat icon={DollarSign} label="Money in" value={mock.monthlyIn} />
				) : null}
				{mock.monthlyOut ? (
					<MiniStat
						icon={ReceiptText}
						label="Money out"
						value={mock.monthlyOut}
					/>
				) : null}
				{mock.net ? (
					<MiniStat icon={Wallet} label="Net" value={mock.net} />
				) : null}
			</div>

			<div className="space-y-2">
				{mock.services.map((service) => (
					<div
						className="grid gap-2 rounded-lg border border-[var(--line)] bg-white/50 p-3 dark:bg-white/5 sm:grid-cols-[1fr_auto]"
						key={service.name}
					>
						<div>
							<p className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
								{service.name}
							</p>
							<p className="m-0 mt-1 text-xs leading-5 text-[var(--sea-ink-soft)]">
								{service.detail}
							</p>
						</div>
						<div className="text-left sm:text-right">
							<p className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
								{service.count}
							</p>
							<p className="m-0 mt-1 text-xs font-bold text-red-600">
								{service.spend} · {service.trend}
							</p>
						</div>
					</div>
				))}
			</div>
		</article>
	);
}

function MiniStat({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Database;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-lg border border-[var(--line)] bg-white/55 p-3 dark:bg-white/5">
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="m-0 text-xs font-bold text-[var(--sea-ink-soft)]">
					{label}
				</p>
				<Icon className="text-[var(--lagoon-deep)]" size={15} />
			</div>
			<p className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
				{value}
			</p>
		</div>
	);
}

function FlowList({
	title,
	rows,
	good = false,
}: {
	title: string;
	rows: string[][];
	good?: boolean;
}) {
	return (
		<article className="feature-card rounded-lg p-4">
			<h3 className="mb-3 text-base font-extrabold text-[var(--sea-ink)]">
				{title}
			</h3>
			<div className="space-y-2">
				{rows.map(([name, value, trend]) => (
					<div
						className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/50 px-3 py-2 dark:bg-white/5"
						key={name}
					>
						<span className="text-sm font-bold text-[var(--sea-ink)]">
							{name}
						</span>
						<span className="text-right">
							<span className="block text-sm font-extrabold text-[var(--sea-ink)]">
								{value}
							</span>
							<span
								className={`block text-xs font-bold ${
									good ? "text-emerald-600" : "text-red-600"
								}`}
							>
								{trend}
							</span>
						</span>
					</div>
				))}
			</div>
		</article>
	);
}

function BudgetStackedBars({
	data,
}: {
	data: Array<{
		label: string;
		revenue: number;
		cloud: number;
		payroll: number;
		tools: number;
	}>;
}) {
	const max = Math.max(
		...data.map(
			(month) => month.revenue + month.cloud + month.payroll + month.tools,
		),
	);

	return (
		<div className="h-[320px]">
			<div className="grid h-full grid-cols-6 items-end gap-3">
				{data.map((month) => {
					const outgoing = month.cloud + month.payroll + month.tools;
					const revenueHeight = Math.max((month.revenue / max) * 100, 8);
					const cloudHeight = (month.cloud / max) * 100;
					const payrollHeight = (month.payroll / max) * 100;
					const toolsHeight = (month.tools / max) * 100;

					return (
						<div
							className="flex h-full flex-col justify-end gap-2"
							key={month.label}
						>
							<div className="flex min-h-0 flex-1 items-end gap-1">
								<div className="flex h-full flex-1 items-end">
									<div
										className="w-full rounded-t-lg bg-emerald-500"
										style={{ height: `${revenueHeight}%` }}
										title={`Revenue $${month.revenue}k`}
									/>
								</div>
								<div className="flex h-full flex-1 flex-col justify-end">
									<div
										className="bg-amber-500"
										style={{ height: `${toolsHeight}%` }}
										title={`Tools $${month.tools}k`}
									/>
									<div
										className="bg-violet-600"
										style={{ height: `${payrollHeight}%` }}
										title={`Payroll $${month.payroll}k`}
									/>
									<div
										className="rounded-t-lg bg-blue-600"
										style={{ height: `${cloudHeight}%` }}
										title={`Cloud $${month.cloud}k`}
									/>
								</div>
							</div>
							<div className="text-center">
								<p className="m-0 text-xs font-extrabold text-[var(--sea-ink)]">
									{month.label}
								</p>
								<p className="m-0 text-[0.68rem] font-bold text-[var(--sea-ink-soft)]">
									${month.revenue}k in / ${outgoing}k out
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ServiceSpendBars({
	data,
}: {
	data: Array<{ label: string; value: number; color: string }>;
}) {
	const max = Math.max(...data.map((item) => item.value));

	return (
		<div className="space-y-3">
			{data.map((item) => (
				<div key={item.label}>
					<div className="mb-1 flex items-center justify-between gap-3 text-sm">
						<span className="font-bold text-[var(--sea-ink)]">
							{item.label}
						</span>
						<span className="font-extrabold text-[var(--sea-ink)]">
							${item.value.toFixed(1)}k
						</span>
					</div>
					<div className="h-3 overflow-hidden rounded-full bg-[rgba(23,58,64,0.12)]">
						<div
							className="h-full rounded-full"
							style={{
								backgroundColor: item.color,
								width: `${Math.max((item.value / max) * 100, 8)}%`,
							}}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function ResponseSection({
	icon: Icon,
	title,
	children,
}: {
	icon: typeof Sparkles;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mb-5 last:mb-0">
			<div className="mb-3 flex items-center gap-2">
				<Icon className="text-[var(--lagoon-deep)]" size={17} />
				<h3 className="m-0 text-base font-extrabold text-[var(--sea-ink)]">
					{title}
				</h3>
			</div>
			{children}
		</section>
	);
}

function Legend({ color, label }: { color: string; label: string }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				className="h-2.5 w-2.5 rounded-full"
				style={{ backgroundColor: color }}
			/>
			{label}
		</span>
	);
}

function MoneyFlowChart({
	data,
	danger,
	scenarioId,
}: {
	data: ForecastPoint[];
	danger: boolean;
	scenarioId: string;
}) {
	const width = 720;
	const height = 310;
	const padding = { top: 24, right: 30, bottom: 38, left: 48 };
	const values = data.flatMap((point) => [
		point.cash,
		point.revenue,
		point.spend,
	]);
	const min = 0;
	const max = Math.max(...values, 440);
	const xStep = (width - padding.left - padding.right) / (data.length - 1);
	const y = (value: number) =>
		height -
		padding.bottom -
		((value - min) / (max - min)) * (height - padding.top - padding.bottom);
	const x = (index: number) => padding.left + index * xStep;
	const pathFor = (key: "cash" | "revenue" | "spend") =>
		data
			.map(
				(point, index) =>
					`${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`,
			)
			.join(" ");

	return (
		<div className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.38))] dark:bg-white/5">
			{danger ? (
				<div className="pointer-events-none absolute bottom-[38px] right-[8%] top-6 w-[25%] rounded-t-lg bg-red-500/10 ring-1 ring-red-500/20" />
			) : null}
			<svg
				aria-label="Forecast chart"
				className="h-auto w-full"
				key={scenarioId}
				role="img"
				viewBox={`0 0 ${width} ${height}`}
			>
				{[0, 110, 220, 330, 440].map((tick) => (
					<g key={tick}>
						<line
							stroke="rgba(23,58,64,0.1)"
							strokeDasharray="4 7"
							x1={padding.left}
							x2={width - padding.right}
							y1={y(tick)}
							y2={y(tick)}
						/>
						<text
							fill="currentColor"
							fontSize="12"
							opacity="0.58"
							textAnchor="end"
							x={padding.left - 10}
							y={y(tick) + 4}
						>
							${tick}k
						</text>
					</g>
				))}
				{data.map((point, index) => (
					<text
						fill="currentColor"
						fontSize="12"
						fontWeight="700"
						key={point.label}
						opacity="0.65"
						textAnchor="middle"
						x={x(index)}
						y={height - 12}
					>
						{point.label}
					</text>
				))}
				<path
					d={pathFor("cash")}
					fill="none"
					stroke="#2563eb"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				<path
					d={pathFor("revenue")}
					fill="none"
					stroke="#16a34a"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				<path
					d={pathFor("spend")}
					fill="none"
					stroke="#dc2626"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				{data.map((point, index) => (
					<g key={`${point.label}-${point.cash}`}>
						<circle cx={x(index)} cy={y(point.cash)} fill="#2563eb" r="5" />
						<circle cx={x(index)} cy={y(point.revenue)} fill="#16a34a" r="5" />
						<circle cx={x(index)} cy={y(point.spend)} fill="#dc2626" r="5" />
					</g>
				))}
			</svg>
			<div className="absolute left-4 top-4 rounded-lg border border-[var(--line)] bg-white/80 px-3 py-2 text-xs font-extrabold text-[var(--sea-ink)] shadow-sm dark:bg-slate-950/70">
				{danger ? "Scenario projection applied" : "Baseline operating plan"}
			</div>
		</div>
	);
}
