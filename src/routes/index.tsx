import { createFileRoute } from "@tanstack/react-router";
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
import { useMemo, useState } from "react";
import {
	cloudPricingDatasetSummary,
	cloudPricingInputs,
	cloudPricingLineItems,
	cloudPricingServiceEstimates,
	cloudPricingUnpricedItems,
	formatPricingUsd,
	providerLabel,
	serviceEstimatesByProvider,
	sourceLabel,
	topPricingLines,
} from "#/data/cloud-pricing";
import { cloudBudgetForecast } from "#/data/cloud-forecast";
import { realProviderData } from "#/data/providers";
import type {
	CloudPricingLineItem,
	CloudPricingServiceEstimate,
	CloudForecastPoint,
	CloudScenario,
	ProviderMock,
} from "#/lib/provider-types";
import { connectRunwaySource, runwayStore } from "../lib/runway-store";

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

const integrations: Integration[] = [
	{
		id: "aws",
		name: "Amazon Web Services",
		category: "Cloud",
		detail: "EC2, ECS, CloudWatch Logs, S3, ALB retail prices",
		icon: Cloud,
		authLabel: "AWS Price List Bulk API",
		scope: ["AmazonEC2", "AmazonECS", "AmazonCloudWatch", "AmazonS3", "AWSELB"],
		connectCopy: "Use public AWS price list files. No AWS account credentials are required.",
	},
	{
		id: "gcp",
		name: "Google Cloud Platform",
		category: "Cloud",
		detail: "Compute Engine, Cloud Run, Logging, Storage, Load Balancing",
		icon: Cloud,
		authLabel: "Cloud Billing Catalog API",
		scope: ["Compute Engine", "Cloud Run", "Cloud Logging", "Cloud Storage"],
		connectCopy: "Use public billing catalogue SKUs for the selected European region.",
	},
	{
		id: "azure",
		name: "Microsoft Azure",
		category: "Cloud",
		detail: "VMs, AKS node VMs, Log Analytics, Blob Storage, App Gateway",
		icon: Cloud,
		authLabel: "Azure Retail Prices API",
		scope: [
			"Virtual Machines",
			"Azure Monitor",
			"Storage",
			"Application Gateway",
		],
		connectCopy: "Use unauthenticated Azure retail rates. No tenant access is required.",
	},
	{
		id: "cloudflare",
		name: "Cloudflare",
		category: "Cloud",
		detail: "Workers, Workers Logpush, R2, included load balancing model",
		icon: Zap,
		authLabel: "Cloudflare pricing docs",
		scope: ["Workers", "Workers Logpush", "R2", "Load Balancing"],
		connectCopy: "Read official Cloudflare pricing docs and mark plan-dependent rows.",
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

const mockProviderData: Record<string, ProviderMock> = {
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

const providerMocks: Record<string, ProviderMock> = {
	...mockProviderData,
	...(realProviderData as Record<string, ProviderMock>),
};

const cloudForecast = cloudBudgetForecast;
const monthlyBudget = cloudForecast.monthlyBudget;
const serviceSpend = cloudForecast.serviceSpend;
const baseChart = cloudForecast.chart;
const scenarios: CloudScenario[] = cloudForecast.scenarios;
const pricingTopLines = topPricingLines(10);
const pricingRegions = Object.entries(cloudPricingInputs.regions);
const pricingServiceGroups = serviceEstimatesByProvider();
const pricingUnpricedRows = cloudPricingUnpricedItems;

function compactUsd(amount: number): string {
	return amount >= 1000
		? `$${(amount / 1000).toFixed(1)}k`
		: `$${amount.toFixed(0)}`;
}

const sourceRows = cloudForecast.sourceRows.length
	? cloudForecast.sourceRows
	: [["Cloud data", "Missing", "run scraper.py"]];

const providerCostRows = serviceSpend.length
	? serviceSpend.map((item) => [
			item.label,
			`$${item.value.toFixed(2)}k`,
			item.isEstimated ? "unpriced gaps" : "official price",
		])
	: [["No provider data", "$0", "missing"]];

const fallbackScenario: CloudScenario = {
	id: "missing-cloud-data",
	prompt: "Run the public pricing scraper",
	headline: "No public pricing estimate is available yet.",
	summary:
		"Run scraper.py --pricing-estimates to produce the official retail-price JSON.",
	numbers: [["Current run-rate", "$0"]],
	risk: "HIGH",
	keyRisk: "The forecast has no public pricing data.",
	recommendations: ["Generate src/data/cloud-pricing/estimate.json from official pricing sources."],
	confidence: 0,
	basedOn: ["No src/data/cloud-pricing/estimate.json rows"],
	metrics: {
		infraCost: "$0",
		forecast: "$0",
		savings: "$0",
		confidence: "0% priced",
	},
	chart: baseChart,
};

function App() {
	const connected = useStore(runwayStore, (state) => state.connectedSourceIds);
	const [pendingIntegration, setPendingIntegration] =
		useState<Integration | null>(null);
	const [connectionStep, setConnectionStep] = useState(0);
	const [dashboardUnlocked, setDashboardUnlocked] = useState(true);
	const [activeScenarioId, setActiveScenarioId] = useState(
		scenarios[0]?.id ?? "current-trend",
	);

	const activeScenario = useMemo(
		() =>
			scenarios.find((scenario) => scenario.id === activeScenarioId) ??
			scenarios[0] ??
			fallbackScenario,
		[activeScenarioId],
	);

	const hasConnectedCloud = connected.some((sourceId) =>
		integrations.some(
			(integration) =>
				integration.id === sourceId && integration.category === "Cloud",
		),
	);
	const chartData = activeScenario.chart;
	const connectedProviders = integrations.filter((integration) =>
		connected.includes(integration.id),
	);

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

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
				<div className="rise-in">
					<p className="island-kicker mb-3">Cloud budget forecaster</p>
					<h1 className="display-title mb-5 max-w-4xl text-4xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-6xl">
						Forecast whether cloud growth breaks your infrastructure budget.
					</h1>
					<p className="mb-7 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)] sm:text-lg">
						Use official public retail prices, editable usage quantities, and
						cloud-only what-if scenarios without connecting provider accounts.
					</p>
					<div className="flex flex-wrap gap-3">
						<a
							href="#ai-cfo"
							className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-bold text-[var(--sea-ink)] no-underline hover:-translate-y-0.5"
						>
							Review cloud scenarios
							<ArrowRight size={16} />
						</a>
					</div>
				</div>

				<div className="island-shell rise-in rounded-2xl p-4 sm:p-5">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<p className="island-kicker mb-1">Cloud forecast</p>
							<h2 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
								Six-month budget model
							</h2>
						</div>
						<div className="rounded-lg border border-amber-500/30 bg-amber-100/70 px-3 py-2 text-xs font-extrabold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
							{hasConnectedCloud
								? activeScenario.risk
								: cloudForecast.summary.risk}{" "}
							RISK
						</div>
					</div>
					<MoneyFlowChart
						data={chartData}
						danger={activeScenario.id !== scenarios[0]?.id}
						scenarioId={activeScenario.id}
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
							The next screen uses cloud billing data for provider budgets,
							forecast confidence, and what-if scenarios.
						</p>
					</div>
					<button
						className="inline-flex items-center gap-2 rounded-lg border border-[rgba(23,58,64,0.18)] bg-[var(--sea-ink)] px-4 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
						disabled={connected.length === 0}
						onClick={continueToDashboard}
						type="button"
					>
						Continue to cloud budget
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
						Cloud budget forecast
					</h2>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<MetricCard
						icon={Cloud}
						label="Monthly Estimate"
						value={compactUsd(cloudForecast.summary.currentMonthlyCost)}
						note={`${cloudForecast.summary.estimatedCoveragePct.toFixed(0)}% unpriced`}
					/>
					<MetricCard
						icon={Activity}
						label="Next Month"
						value={compactUsd(cloudForecast.summary.nextMonthForecast)}
						note={`${cloudForecast.summary.trendPct.toFixed(0)}% trend`}
					/>
					<MetricCard
						icon={Banknote}
						label="6-Month Budget"
						value={compactUsd(cloudForecast.summary.sixMonthForecastTotal)}
						note="baseline forecast"
					/>
					<MetricCard
						icon={TrendingDown}
						label="Optimized Target"
						value={compactUsd(cloudForecast.summary.optimizedSixMonthTotal)}
						note={`${activeScenario.metrics.savings} possible savings`}
					/>
					<MetricCard
						icon={ShieldAlert}
						label="Price Coverage"
						value={`${cloudForecast.summary.actualCoveragePct.toFixed(0)}%`}
						note="official source inputs"
					/>
				</div>

				<div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
					<div className="island-shell rounded-2xl p-4 sm:p-5">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="island-kicker mb-1">Run-rate, baseline, target</p>
								<h3 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
									Six-month cloud forecast
								</h3>
							</div>
							<div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--sea-ink-soft)]">
								<Legend color="#2563eb" label="Baseline" />
								<Legend color="#16a34a" label="Optimized" />
								<Legend color="#dc2626" label="Run-rate" />
							</div>
						</div>
						<MoneyFlowChart
							data={chartData}
							danger={activeScenario.id !== scenarios[0]?.id}
							scenarioId={activeScenario.id}
						/>
					</div>

					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
						<FlowList title="Source Quality" rows={sourceRows} good />
						<FlowList title="Provider Run-Rate" rows={providerCostRows} />
					</div>
				</div>
			</section>

			<section className={dashboardUnlocked ? "mt-10" : "hidden"}>
				<div className="mb-4">
					<p className="island-kicker mb-2">Pricing dataset</p>
					<h2 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
						Real public cloud prices behind the forecast
					</h2>
				</div>
				<div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
					<div className="grid gap-4">
						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<p className="island-kicker mb-1">Dataset health</p>
							<h3 className="mb-4 text-lg font-extrabold text-[var(--sea-ink)]">
								Generated pricing coverage
							</h3>
							<div className="grid gap-3 sm:grid-cols-2">
								<DatasetStat
									label="Catalogue rows"
									value={String(cloudPricingDatasetSummary.catalogueItems)}
								/>
								<DatasetStat
									label="Priced estimate rows"
									value={String(cloudPricingDatasetSummary.pricedLineItems)}
								/>
								<DatasetStat
									label="Unpriced rows"
									value={String(cloudPricingDatasetSummary.unpricedLineItems)}
								/>
								<DatasetStat
									label="Price coverage"
									value={`${cloudPricingDatasetSummary.priceCoveragePct.toFixed(0)}%`}
								/>
							</div>
							<div className="mt-4 space-y-2">
								{pricingRegions.map(([provider, region]) => (
									<div
										className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2 text-sm first:border-0 first:pt-0"
										key={provider}
									>
										<span className="font-bold text-[var(--sea-ink)]">
											{providerLabel(provider)}
										</span>
										<span className="font-semibold text-[var(--sea-ink-soft)]">
											{region}
										</span>
									</div>
								))}
							</div>
						</div>

						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<p className="island-kicker mb-1">Remaining gaps</p>
							<h3 className="mb-3 text-lg font-extrabold text-[var(--sea-ink)]">
								Unpriced public rows
							</h3>
							<UnpricedRows rows={pricingUnpricedRows} />
						</div>
					</div>

					<div className="grid gap-4">
						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
								<div>
									<p className="island-kicker mb-1">Line items</p>
									<h3 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
										Top priced SKUs
									</h3>
								</div>
								<p className="m-0 text-xs font-bold text-[var(--sea-ink-soft)]">
									{cloudPricingLineItems.length} total line items
								</p>
							</div>
							<PricingLineTable rows={pricingTopLines} />
						</div>

						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
								<div>
									<p className="island-kicker mb-1">Service totals</p>
									<h3 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
										Monthly estimate by provider
									</h3>
								</div>
								<p className="m-0 text-xs font-bold text-[var(--sea-ink-soft)]">
									{cloudPricingServiceEstimates.length} service rows
								</p>
							</div>
							<ServiceEstimateMatrix groups={pricingServiceGroups} />
						</div>
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
									Baseline vs optimized cloud budget
								</h3>
							</div>
							<div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--sea-ink-soft)]">
								<Legend color="#2563eb" label="Baseline" />
								<Legend color="#16a34a" label="Optimized" />
								<Legend color="#dc2626" label="Current run-rate" />
							</div>
						</div>
						<CloudBudgetBars data={monthlyBudget} />
					</div>
					<div className="grid gap-4">
						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<p className="island-kicker mb-1">Cloud spend</p>
							<h3 className="mb-4 text-lg font-extrabold text-[var(--sea-ink)]">
								Current provider mix
							</h3>
							<ServiceSpendBars data={serviceSpend} />
						</div>
						<div className="island-shell rounded-2xl p-4 sm:p-5">
							<p className="island-kicker mb-1">Forecast context</p>
							<h3 className="mb-3 text-lg font-extrabold text-[var(--sea-ink)]">
								Data quality checks
							</h3>
							<ul className="m-0 space-y-2 p-0">
								{[
									"Cloud provider costs are numeric, not display-only strings",
									"Retail prices come from official public APIs or docs",
									"Usage quantities live in src/data/cloud-pricing/inputs.json",
									"Warnings are shown when a SKU cannot be priced",
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
								{cloudForecast.warnings.slice(0, 3).map((item) => (
									<li
										className="flex gap-2 text-sm leading-6 text-amber-700 dark:text-amber-200"
										key={item}
									>
										<ShieldAlert
											className="mt-1 shrink-0 text-amber-600"
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
						Cloud scenario planner
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
								Based on generated public pricing data from scraper.py --pricing-estimates.
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

							<ResponseSection icon={ShieldAlert} title="Budget Risk">
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
							<p className="island-kicker mb-2">Forecast Confidence</p>
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
	const steps = [
		{
			title: `Connect ${integration.name}`,
			body: integration.connectCopy,
			action: "Use pricing source",
		},
		{
			title: integration.authLabel,
			body: "Review the official pricing source and selected service family.",
			action: "Confirm source",
		},
		{
			title: "Loading pricing model",
			body: "Applying the generated public pricing JSON to the budget scenario.",
			action: "Finish",
		},
	];
	const current = steps[step];

	return (
		<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
			<div className="w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-5">
				<div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
					<div className="flex gap-3">
						<div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
							<Icon size={21} />
						</div>
						<div>
							<p className="island-kicker mb-1">Pricing source flow</p>
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
								Pricing source
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
							className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--sea-ink)] px-4 py-2.5 text-sm font-extrabold text-white"
							onClick={onAdvance}
							type="button"
						>
							{step === 2 ? (
								<Loader2 className="animate-spin" size={16} />
							) : (
								<ExternalLink size={16} />
							)}
							{current.action}
						</button>
					</div>

					<div className="rounded-xl border border-[var(--line)] bg-slate-950 p-4 text-white">
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
							{mock.net ? <DarkStat label="Net cash" value={mock.net} /> : null}
						</div>
						<div className="mt-4 space-y-2">
							{mock.services.slice(0, 4).map((service) => (
								<div
									className="rounded-lg border border-white/10 bg-white/5 p-3"
									key={service.name}
								>
									<div className="flex items-center justify-between gap-3">
										<span className="text-sm font-bold">{service.name}</span>
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
	const sourceLabel =
		mock.costActual?.isEstimated || !mock.source ? "Estimate" : "Actual";

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
					{sourceLabel}
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
								{service.isEstimated ? " · estimate" : ""}
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

function DatasetStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-[var(--line)] bg-white/55 p-3 dark:bg-white/5">
			<p className="m-0 text-xs font-bold text-[var(--sea-ink-soft)]">
				{label}
			</p>
			<p className="m-0 mt-1 text-2xl font-extrabold text-[var(--sea-ink)]">
				{value}
			</p>
		</div>
	);
}

function PricingLineTable({ rows }: { rows: CloudPricingLineItem[] }) {
	if (!rows.length) {
		return (
			<p className="m-0 text-sm text-[var(--sea-ink-soft)]">
				No priced line items are available in the generated dataset.
			</p>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border border-[var(--line)]">
			<div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--line)] bg-white/65 px-3 py-2 text-xs font-extrabold uppercase text-[var(--kicker)] dark:bg-white/5 sm:grid-cols-[1fr_0.68fr_0.55fr_auto]">
				<span>SKU</span>
				<span className="hidden sm:block">Source</span>
				<span className="hidden text-right sm:block">Unit</span>
				<span className="text-right">Monthly</span>
			</div>
			{rows.map((row) => (
				<div
					className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--line)] px-3 py-3 last:border-0 sm:grid-cols-[1fr_0.68fr_0.55fr_auto]"
					key={`${row.provider}-${row.service}-${row.sku}`}
				>
					<div className="min-w-0">
						<p className="m-0 truncate text-sm font-extrabold text-[var(--sea-ink)]">
							{providerLabel(row.provider)} · {row.service}
						</p>
						<p className="m-0 mt-1 truncate text-xs font-bold text-[var(--sea-ink-soft)]">
							{row.sku} · {row.quantity.toLocaleString()} {row.quantityUnit}
						</p>
					</div>
					<p className="m-0 hidden text-xs font-semibold text-[var(--sea-ink-soft)] sm:block">
						{sourceLabel(row.sourceType)}
					</p>
					<p className="m-0 hidden text-right text-xs font-semibold text-[var(--sea-ink-soft)] sm:block">
						{formatPricingUsd(row.unitPriceUsd)} / {row.unit}
					</p>
					<p className="m-0 text-right text-sm font-extrabold text-[var(--sea-ink)]">
						{formatPricingUsd(row.monthlyCostUsd)}
					</p>
				</div>
			))}
		</div>
	);
}

function ServiceEstimateMatrix({
	groups,
}: {
	groups: Record<string, CloudPricingServiceEstimate[]>;
}) {
	const providers = Object.entries(groups);

	if (!providers.length) {
		return (
			<p className="m-0 text-sm text-[var(--sea-ink-soft)]">
				No service estimates are available in the generated dataset.
			</p>
		);
	}

	return (
		<div className="grid gap-3 md:grid-cols-2">
			{providers.map(([provider, rows]) => (
				<div
					className="rounded-lg border border-[var(--line)] bg-white/50 p-3 dark:bg-white/5"
					key={provider}
				>
					<div className="mb-2 flex items-center justify-between gap-3">
						<h4 className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
							{providerLabel(provider)}
						</h4>
						<span className="text-xs font-bold text-[var(--sea-ink-soft)]">
							{rows.length} services
						</span>
					</div>
					<div className="space-y-2">
						{rows.map((row) => (
							<div
								className="flex items-center justify-between gap-3 text-sm"
								key={`${provider}-${row.service}`}
							>
								<span className="font-semibold text-[var(--sea-ink-soft)]">
									{row.service}
								</span>
								<span className="font-extrabold text-[var(--sea-ink)]">
									{formatPricingUsd(row.monthlyCostUsd)}
								</span>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function UnpricedRows({ rows }: { rows: string[] }) {
	if (!rows.length) {
		return (
			<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-700 dark:text-emerald-200">
				Every configured estimate row has a public price.
			</div>
		);
	}

	return (
		<ul className="m-0 space-y-2 p-0">
			{rows.map((row) => (
				<li
					className="rounded-lg border border-amber-500/25 bg-amber-100/60 px-3 py-2 text-sm font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
					key={row}
				>
					{row}
				</li>
			))}
		</ul>
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

function CloudBudgetBars({
	data,
}: {
	data: Array<{
		label: string;
		baseline: number;
		optimized: number;
		runRate: number;
		estimatedPct: number;
	}>;
}) {
	const max = Math.max(
		...data.flatMap((month) => [month.baseline, month.runRate]),
		1,
	);

	return (
		<div className="h-[320px]">
			<div className="grid h-full grid-cols-6 items-end gap-3">
				{data.map((month) => {
					const baselineHeight = Math.max((month.baseline / max) * 100, 8);
					const optimizedHeight = Math.max((month.optimized / max) * 100, 6);
					const runRateHeight = Math.max((month.runRate / max) * 100, 6);

					return (
						<div
							className="flex h-full flex-col justify-end gap-2"
							key={month.label}
						>
							<div className="flex min-h-0 flex-1 items-end gap-1.5">
								<div className="flex h-full flex-1 items-end">
									<div
										className="w-full rounded-t-lg bg-blue-600"
										style={{ height: `${baselineHeight}%` }}
										title={`Baseline $${month.baseline}k`}
									/>
								</div>
								<div className="flex h-full flex-1 items-end">
									<div
										className="w-full rounded-t-lg bg-emerald-500"
										style={{ height: `${optimizedHeight}%` }}
										title={`Optimized $${month.optimized}k`}
									/>
								</div>
								<div className="flex h-full flex-1 items-end">
									<div
										className="w-full rounded-t-lg bg-red-600"
										style={{ height: `${runRateHeight}%` }}
										title={`Run-rate $${month.runRate}k`}
									/>
								</div>
							</div>
							<div className="text-center">
								<p className="m-0 text-xs font-extrabold text-[var(--sea-ink)]">
									{month.label}
								</p>
								<p className="m-0 text-[0.68rem] font-bold text-[var(--sea-ink-soft)]">
									${month.baseline}k baseline
								</p>
								<p className="m-0 text-[0.62rem] font-bold text-[var(--sea-ink-soft)]">
									{month.estimatedPct.toFixed(0)}% unpriced
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
	data: Array<{
		label: string;
		value: number;
		color: string;
		isEstimated: boolean;
		sourceKind: string;
	}>;
}) {
	const max = Math.max(...data.map((item) => item.value), 1);

	return (
		<div className="space-y-3">
			{data.map((item) => (
				<div key={item.label}>
					<div className="mb-1 flex items-center justify-between gap-3 text-sm">
						<span className="font-bold text-[var(--sea-ink)]">
							{item.label}
						</span>
						<span className="font-extrabold text-[var(--sea-ink)]">
							${item.value.toFixed(2)}k
						</span>
					</div>
					<p className="m-0 mb-1 text-xs font-bold text-[var(--sea-ink-soft)]">
						{item.isEstimated ? "Unpriced gaps" : "Official price"} ·{" "}
						{item.sourceKind.replaceAll("_", " ")}
					</p>
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
	data: CloudForecastPoint[];
	danger: boolean;
	scenarioId: string;
}) {
	const width = 720;
	const height = 310;
	const padding = { top: 24, right: 30, bottom: 38, left: 48 };
	const values = data.flatMap((point) => [
		point.baseline,
		point.optimized,
		point.runRate,
	]);
	const min = 0;
	const max = Math.max(...values, 10);
	const xStep = (width - padding.left - padding.right) / (data.length - 1);
	const y = (value: number) =>
		height -
		padding.bottom -
		((value - min) / (max - min)) * (height - padding.top - padding.bottom);
	const x = (index: number) => padding.left + index * xStep;
	const pathFor = (key: "baseline" | "optimized" | "runRate") =>
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
				{[0, max * 0.25, max * 0.5, max * 0.75, max].map((tick) => (
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
							${tick.toFixed(tick >= 10 ? 0 : 1)}k
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
					d={pathFor("baseline")}
					fill="none"
					stroke="#2563eb"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				<path
					d={pathFor("optimized")}
					fill="none"
					stroke="#16a34a"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				<path
					d={pathFor("runRate")}
					fill="none"
					stroke="#dc2626"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				{data.map((point, index) => (
					<g key={`${point.label}-${point.baseline}`}>
						<circle cx={x(index)} cy={y(point.baseline)} fill="#2563eb" r="5" />
						<circle
							cx={x(index)}
							cy={y(point.optimized)}
							fill="#16a34a"
							r="5"
						/>
						<circle cx={x(index)} cy={y(point.runRate)} fill="#dc2626" r="5" />
					</g>
				))}
			</svg>
			<div className="absolute left-4 top-4 rounded-lg border border-[var(--line)] bg-white/80 px-3 py-2 text-xs font-extrabold text-[var(--sea-ink)] shadow-sm dark:bg-slate-950/70">
				{danger ? "Scenario projection applied" : "Baseline cloud forecast"}
			</div>
		</div>
	);
}
