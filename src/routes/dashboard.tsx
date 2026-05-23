import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowDownRight,
	ArrowRight,
	ArrowUpRight,
	Cloud,
	CreditCard,
	DollarSign,
	Landmark,
	TrendingUp,
} from "lucide-react";
import { type ElementType, useState } from "react";
import { Slider } from "#/components/ui/slider";
import {
	latestStartupSnapshot,
	startupDashboardData,
	startupDataset,
} from "#/data/startup-dataset";

export const Route = createFileRoute("/dashboard")({ component: App });

const monthlyData = startupDashboardData.monthlyTrend.map((point) => ({
	month: point.month,
	revenue: point.revenue * 1000,
	funding: point.funding * 1000,
	totalCashIn: point.totalCashIn * 1000,
	expenses: point.expenses * 1000,
	cloudCost: point.cloud * 1000,
}));

const cloudCategories = Object.entries(startupDashboardData.cloudExpenses).map(
	([id, spend]) => ({
		id,
		name: cloudExpenseLabel(id),
		spend,
		growth: cloudGrowthLabel(id),
	}),
);

const CLOUD_PROVIDER_IDS = ["aws", "gcp", "azure", "cloudflare"] as const;
type CloudProviderId = (typeof CLOUD_PROVIDER_IDS)[number];

type ScaleTier = {
	label: string;
	users: number;
	dau: number;
	concurrent: number;
	total: number;
	note: string;
	breakdown: Array<{ label: string; cost: number }>;
};

const CLOUD_SCALE_MODELS: Record<
	CloudProviderId,
	{ name: string; colorClass: string; tiers: ScaleTier[] }
> = {
	aws: {
		name: "AWS",
		colorClass: "bg-orange-500",
		tiers: makeScaleTiers(
			[84, 273, 905, 7270],
			[
				"starter VM + managed database",
				"single app node + managed database",
				"small autoscaled fleet + database replica",
				"multi-zone fleet + larger database cluster",
			],
		),
	},
	gcp: {
		name: "GCP",
		colorClass: "bg-blue-500",
		tiers: makeScaleTiers(
			[63, 218, 790, 6420],
			[
				"Cloud Run + small database",
				"autoscaled app services + managed SQL",
				"regional app fleet + HA database",
				"multi-zone compute + regional SQL",
			],
		),
	},
	azure: {
		name: "Azure",
		colorClass: "bg-cyan-500",
		tiers: makeScaleTiers(
			[72, 246, 860, 6890],
			[
				"small App Service + Azure SQL",
				"standard app tier + managed SQL",
				"VM scale set + zone-redundant SQL",
				"scale sets + business critical SQL",
			],
		),
	},
	cloudflare: {
		name: "Cloudflare",
		colorClass: "bg-yellow-500",
		tiers: makeScaleTiers(
			[25, 96, 340, 2600],
			[
				"Workers + R2 starter stack",
				"Workers paid + light data usage",
				"edge-first app + heavier reads",
				"high-volume Workers + regional data tier",
			],
		),
	},
};

function App() {
	const [selectedMetric, setSelectedMetric] = useState<"revenue" | "expenses">(
		"revenue",
	);

	const totalCloudSpend = cloudCategories.reduce(
		(sum, category) => sum + category.spend,
		0,
	);
	const currentRevenue = startupDashboardData.monthlyRevenue;
	const currentExpenses = startupDashboardData.monthlyExpenses;
	const netBurn = startupDashboardData.netBurn;
	const bankBalance = startupDashboardData.currentBalance;
	const runway = startupDashboardData.runway;
	const latestFundingRound = startupDataset.fundingRounds[0];
	const fundingRaised = startupDataset.company.fundingRaisedUsd;
	const spikeScenario = startupDataset.dangerScenarios[0];

	const maxValue = Math.max(
		...monthlyData.map((point) => Math.max(point.revenue, point.expenses)),
	);

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="mb-8">
				<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div>
						<p className="island-kicker mb-2">
							{startupDataset.company.stage} AI SaaS forecast
						</p>
						<h1 className="display-title m-0 max-w-3xl text-3xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-5xl">
							AI Runway CFO Dashboard
						</h1>
						<p className="mt-2 text-[var(--sea-ink-soft)]">
							{latestStartupSnapshot.mau.toLocaleString()} MAU,{" "}
							{startupDataset.productMetrics.payingCustomers.toLocaleString()}{" "}
							paying customers, and{" "}
							{startupDataset.productMetrics.requestsPerMonth.toLocaleString()}{" "}
							requests/month.
						</p>
					</div>
					<a
						href="/"
						className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-bold text-[var(--sea-ink)] no-underline hover:-translate-y-0.5"
					>
						Configure Sources
						<ArrowRight size={16} />
					</a>
				</div>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<MetricCard
						icon={CreditCard}
						label="Monthly Revenue"
						value={`$${(currentRevenue / 1000).toFixed(1)}k`}
						change={`+${startupDataset.businessMetrics.revenueGrowthPct}%`}
						trend="up"
					/>
					<MetricCard
						icon={Cloud}
						label="Cloud Expenses"
						value={`$${(totalCloudSpend / 1000).toFixed(1)}k`}
						change="+80% MoM"
						trend="down"
					/>
					<MetricCard
						icon={DollarSign}
						label="Funding Raised"
						value={`$${(fundingRaised / 1000000).toFixed(1)}M`}
						change={`${latestFundingRound?.month ?? "Mar"} ${latestFundingRound?.type ?? "round"}`}
						trend="up"
					/>
					<MetricCard
						icon={Landmark}
						label="Runway"
						value={`${runway.toFixed(1)} mo`}
						change={`${(spikeScenario?.runwayMonths ?? 0).toFixed(1)} mo in spike`}
						trend="down"
					/>
				</div>
			</section>

			<section className="mb-8">
				<div className="island-shell rounded-2xl p-4 sm:p-6">
					<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
						<div>
							<p className="island-kicker mb-2">5-month trend</p>
							<h2 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
								Revenue vs Expenses
							</h2>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setSelectedMetric("revenue")}
								className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
									selectedMetric === "revenue"
										? "bg-emerald-500 text-white"
										: "bg-[var(--surface-strong)] text-[var(--sea-ink)]"
								}`}
							>
								Revenue
							</button>
							<button
								type="button"
								onClick={() => setSelectedMetric("expenses")}
								className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
									selectedMetric === "expenses"
										? "bg-red-500 text-white"
										: "bg-[var(--surface-strong)] text-[var(--sea-ink)]"
								}`}
							>
								Expenses
							</button>
						</div>
					</div>

					<div className="relative h-80">
						<RevenueExpenseChart
							data={monthlyData}
							maxValue={maxValue}
							selectedMetric={selectedMetric}
						/>
					</div>
				</div>
			</section>

			<div className="grid gap-8 lg:grid-cols-2">
				<section>
					<div className="island-shell rounded-2xl p-4 sm:p-6">
						<div className="mb-4">
							<p className="island-kicker mb-2">Expense breakdown</p>
							<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
								Cloud Cost Categories
							</h2>
						</div>
						<div className="space-y-3">
							{cloudCategories.map((category) => (
								<div
									key={category.id}
									className="rounded-lg border border-[var(--line)] bg-white/50 p-4 dark:bg-white/5"
								>
									<div className="mb-3 flex items-center justify-between">
										<h3 className="m-0 text-base font-extrabold text-[var(--sea-ink)]">
											{category.name}
										</h3>
										<span className="text-lg font-extrabold text-[var(--sea-ink)]">
											${(category.spend / 1000).toFixed(1)}k
										</span>
									</div>
									<div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
										<div
											className="h-full rounded-full bg-[var(--lagoon-deep)]"
											style={{
												width: `${(category.spend / totalCloudSpend) * 100}%`,
											}}
										/>
									</div>
									<p className="m-0 text-xs text-[var(--sea-ink-soft)]">
										{category.growth}
									</p>
								</div>
							))}
						</div>
						<div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
							<p className="m-0 text-sm font-bold text-emerald-700 dark:text-emerald-200">
								Total Cloud Spend: ${(totalCloudSpend / 1000).toFixed(1)}k/mo
							</p>
						</div>
					</div>
				</section>

				<section>
					<div className="island-shell rounded-2xl p-4 sm:p-6">
						<div className="mb-4">
							<p className="island-kicker mb-2">Forecast</p>
							<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
								Cash Flow & Runway
							</h2>
						</div>
						<div className="mb-4 rounded-lg border border-[var(--line)] bg-white/50 p-4 dark:bg-white/5">
							<p className="m-0 text-sm text-[var(--sea-ink-soft)]">
								Current Balance
							</p>
							<p className="m-0 mt-1 text-3xl font-extrabold text-[var(--sea-ink)]">
								${(bankBalance / 1000).toFixed(0)}k
							</p>
						</div>
						<div className="space-y-3">
							<RunwayRow
								label="MRR"
								value={`$${(currentRevenue / 1000).toFixed(1)}k`}
							/>
							<RunwayRow
								label="Monthly Operating Costs"
								value={`$${(currentExpenses / 1000).toFixed(1)}k`}
							/>
							<RunwayRow
								label={`${latestFundingRound?.month ?? "Mar"} Funding Inflow`}
								value={`$${((latestFundingRound?.amountUsd ?? 0) / 1000000).toFixed(1)}M`}
								highlight
							/>
							<RunwayRow
								label="Net Burn Rate"
								value={`-$${(netBurn / 1000).toFixed(1)}k`}
								danger
							/>
							<RunwayRow
								label="Runway"
								value={`${runway.toFixed(1)} months`}
								highlight
							/>
						</div>
						<div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
							<p className="m-0 text-xs font-bold uppercase text-amber-700 dark:text-amber-200">
								Funding Context
							</p>
							<p className="m-0 mt-1 text-sm text-[var(--sea-ink)]">
								{latestFundingRound?.type ?? "Series A"} added $
								{((latestFundingRound?.amountUsd ?? 0) / 1000000).toFixed(1)}M
								in {latestFundingRound?.month ?? "Mar"}, lifting cash runway
								while operating burn remains visible.
							</p>
						</div>
					</div>
				</section>
			</div>

			<section className="mt-8">
				<CloudProviderScaleSlider />
			</section>

			<section className="mt-8">
				<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 sm:p-6">
					<div className="flex gap-3">
						<TrendingUp className="shrink-0 text-red-600" size={24} />
						<div>
							<h3 className="m-0 mb-2 text-lg font-extrabold text-red-700 dark:text-red-300">
								Expense Spike Detected
							</h3>
							<p className="m-0 mb-3 text-sm leading-6 text-[var(--sea-ink)]">
								Cloud spend rose from $14k in January to $97k in May while
								revenue rose from $38k to $146k. Infrastructure is scaling
								faster than revenue.
							</p>
							<div className="flex flex-wrap gap-2">
								<span className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white">
									Compute/GPU $58k
								</span>
								<span className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white">
									Requests 420M/mo
								</span>
								<span className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white">
									Runway {runway.toFixed(1)} mo
								</span>
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}

function CloudProviderScaleSlider() {
	const [idx, setIdx] = useState(3);
	const [selectedProviderId, setSelectedProviderId] =
		useState<CloudProviderId>("aws");
	const selectedProvider = CLOUD_SCALE_MODELS[selectedProviderId];
	const tier = selectedProvider.tiers[idx] ?? selectedProvider.tiers[0];
	const comparisonTotals = CLOUD_PROVIDER_IDS.map((providerId) => {
		const provider = CLOUD_SCALE_MODELS[providerId];
		const providerTier = provider.tiers[idx] ?? provider.tiers[0];

		return {
			id: providerId,
			name: provider.name,
			colorClass: provider.colorClass,
			total: providerTier.total,
		};
	});

	return (
		<div className="island-shell rounded-2xl p-4 sm:p-6">
			<div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
				<div>
					<p className="island-kicker mb-2">What-if / cloud providers</p>
					<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
						Scale Cost Simulator
					</h2>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:flex">
					{CLOUD_PROVIDER_IDS.map((providerId) => {
						const provider = CLOUD_SCALE_MODELS[providerId];
						const isSelected = providerId === selectedProviderId;

						return (
							<button
								key={providerId}
								type="button"
								aria-pressed={isSelected}
								onClick={() => setSelectedProviderId(providerId)}
								className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
									isSelected
										? "border-[var(--sea-ink)] bg-[var(--sea-ink)] text-white"
										: "border-[var(--line)] bg-white/50 text-[var(--sea-ink)] hover:border-[var(--sea-ink)] dark:bg-white/5"
								}`}
							>
								<span
									className={`h-2.5 w-2.5 rounded-full ${provider.colorClass}`}
									aria-hidden="true"
								/>
								{provider.name}
							</button>
						);
					})}
				</div>
			</div>

			<div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
				<div className="rounded-xl border border-[var(--line)] bg-white/50 p-4 dark:bg-white/5">
					<p className="m-0 text-sm font-bold text-[var(--sea-ink-soft)]">
						{selectedProvider.name} at {tier.label} users
					</p>
					<div className="mt-1 text-4xl font-extrabold text-[var(--sea-ink)]">
						${formatMonthlyCost(tier.total)}/mo
					</div>
					<p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
						{tier.dau.toLocaleString()} DAU / {tier.concurrent.toLocaleString()}{" "}
						concurrent / {tier.note}
					</p>
				</div>
				<div className="grid grid-cols-2 gap-2">
					{comparisonTotals.map((provider) => (
						<div
							key={provider.id}
							className={`rounded-lg border p-3 ${
								provider.id === selectedProviderId
									? "border-[var(--sea-ink)] bg-[var(--surface-strong)]"
									: "border-[var(--line)] bg-white/40 dark:bg-white/5"
							}`}
						>
							<div className="mb-2 flex items-center gap-2">
								<span
									className={`h-2 w-2 rounded-full ${provider.colorClass}`}
									aria-hidden="true"
								/>
								<span className="text-xs font-bold text-[var(--sea-ink-soft)]">
									{provider.name}
								</span>
							</div>
							<p className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
								${formatMonthlyCost(provider.total)}
							</p>
						</div>
					))}
				</div>
			</div>

			<Slider
				value={[idx]}
				min={0}
				max={3}
				step={1}
				onValueChange={([value]) => setIdx(value)}
				className="my-4"
			/>
			<div className="mb-4 flex justify-between text-xs font-bold text-[var(--sea-ink-soft)]">
				{selectedProvider.tiers.map((scaleTier) => (
					<span key={scaleTier.label}>{scaleTier.label}</span>
				))}
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				{tier.breakdown.map((item) => {
					const percentage =
						item.cost === 0 ? 0 : (item.cost / tier.total) * 100;

					return (
						<div key={item.label} className="space-y-1">
							<div className="flex items-center justify-between gap-3 text-sm">
								<span className="font-bold text-[var(--sea-ink)]">
									{item.label}
								</span>
								<span className="font-extrabold text-[var(--sea-ink)]">
									${formatMonthlyCost(item.cost)}
								</span>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
								<div
									className={`h-full rounded-full ${selectedProvider.colorClass}`}
									style={{ width: `${percentage}%` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function MetricCard({
	icon: Icon,
	label,
	value,
	change,
	trend,
}: {
	icon: ElementType;
	label: string;
	value: string;
	change: string;
	trend: "up" | "down";
}) {
	return (
		<div className="island-shell rounded-xl p-4">
			<div className="mb-3 flex items-center justify-between">
				<div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
					<Icon size={18} />
				</div>
				<div
					className={`flex items-center gap-1 text-xs font-bold ${
						trend === "up" ? "text-emerald-600" : "text-red-600"
					}`}
				>
					{trend === "up" ? (
						<ArrowUpRight size={14} />
					) : (
						<ArrowDownRight size={14} />
					)}
					{change}
				</div>
			</div>
			<p className="m-0 text-xs font-bold text-[var(--sea-ink-soft)]">
				{label}
			</p>
			<p className="m-0 mt-1 text-2xl font-extrabold text-[var(--sea-ink)]">
				{value}
			</p>
		</div>
	);
}

function RunwayRow({
	label,
	value,
	danger = false,
	highlight = false,
}: {
	label: string;
	value: string;
	danger?: boolean;
	highlight?: boolean;
}) {
	return (
		<div
			className={`flex items-center justify-between rounded-lg border p-3 ${
				highlight
					? "border-emerald-500/20 bg-emerald-500/10"
					: "border-[var(--line)] bg-white/50 dark:bg-white/5"
			}`}
		>
			<span
				className={`text-sm font-bold ${
					highlight
						? "text-emerald-700 dark:text-emerald-200"
						: "text-[var(--sea-ink-soft)]"
				}`}
			>
				{label}
			</span>
			<span
				className={`text-base font-extrabold ${
					danger
						? "text-red-600"
						: highlight
							? "text-emerald-700 dark:text-emerald-200"
							: "text-[var(--sea-ink)]"
				}`}
			>
				{value}
			</span>
		</div>
	);
}

function RevenueExpenseChart({
	data,
	maxValue,
	selectedMetric,
}: {
	data: typeof monthlyData;
	maxValue: number;
	selectedMetric: "revenue" | "expenses";
}) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	return (
		<div className="relative h-full w-full">
			<div className="absolute left-0 top-0 flex h-full w-12 flex-col justify-between text-right text-xs font-bold text-[var(--sea-ink-soft)]">
				<span>${(maxValue / 1000).toFixed(0)}k</span>
				<span>${(maxValue / 2000).toFixed(0)}k</span>
				<span>$0</span>
			</div>

			<div className="ml-14 flex h-full items-end justify-between gap-1">
				{data.map((item, index) => {
					const revenueHeight = (item.revenue / maxValue) * 100;
					const expenseHeight = (item.expenses / maxValue) * 100;
					const isHovered = hoveredIndex === index;

					return (
						<button
							type="button"
							key={item.month}
							className="relative flex flex-1 flex-col items-center appearance-none border-0 bg-transparent p-0"
							aria-label={`${item.month}: revenue $${(item.revenue / 1000).toFixed(1)}k, expenses $${(item.expenses / 1000).toFixed(1)}k`}
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
							onFocus={() => setHoveredIndex(index)}
							onBlur={() => setHoveredIndex(null)}
						>
							{isHovered && (
								<div className="absolute -top-20 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 shadow-lg">
									<p className="m-0 mb-1 text-xs font-bold text-[var(--sea-ink-soft)]">
										{item.month}
									</p>
									<p className="m-0 text-sm font-bold text-emerald-600">
										Revenue: ${(item.revenue / 1000).toFixed(1)}k
									</p>
									{item.funding > 0 && (
										<p className="m-0 text-sm font-bold text-blue-600">
											Funding: ${(item.funding / 1000000).toFixed(1)}M
										</p>
									)}
									<p className="m-0 text-sm font-bold text-red-600">
										Expenses: ${(item.expenses / 1000).toFixed(1)}k
									</p>
								</div>
							)}

							<div className="relative mb-2 flex w-full gap-0.5">
								{selectedMetric === "revenue" && (
									<div
										className="w-full rounded-t-sm bg-emerald-500 transition-all hover:bg-emerald-600"
										style={{ height: `${revenueHeight * 2.8}px` }}
									/>
								)}
								{selectedMetric === "expenses" && (
									<div
										className="w-full rounded-t-sm bg-red-500 transition-all hover:bg-red-600"
										style={{ height: `${expenseHeight * 2.8}px` }}
									/>
								)}
							</div>

							<span className="text-xs font-bold text-[var(--sea-ink-soft)]">
								{item.month}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function makeScaleTiers(totals: number[], notes: string[]): ScaleTier[] {
	const scale = [
		{ label: "100", users: 100, dau: 10, concurrent: 5 },
		{ label: "10K", users: 10000, dau: 1000, concurrent: 50 },
		{ label: "100K", users: 100000, dau: 10000, concurrent: 500 },
		{ label: "1M", users: 1000000, dau: 100000, concurrent: 5000 },
	];

	return scale.map((tier, index) => ({
		...tier,
		total: totals[index] ?? 0,
		note: notes[index] ?? "scaled infrastructure",
		breakdown: splitScaleCost(totals[index] ?? 0),
	}));
}

function splitScaleCost(total: number) {
	return [
		{ label: "Compute", cost: Math.round(total * 0.58) },
		{ label: "Database", cost: Math.round(total * 0.12) },
		{ label: "Storage", cost: Math.round(total * 0.05) },
		{ label: "Bandwidth/CDN", cost: Math.round(total * 0.1) },
		{ label: "Observability", cost: Math.round(total * 0.05) },
		{ label: "AI APIs", cost: Math.round(total * 0.07) },
		{ label: "Misc infra", cost: Math.round(total * 0.03) },
	];
}

function formatMonthlyCost(value: number) {
	return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function cloudExpenseLabel(key: string) {
	const labels: Record<string, string> = {
		computeGpuUsd: "Compute/GPU",
		databasesUsd: "Databases",
		storageUsd: "Storage",
		bandwidthCdnUsd: "Bandwidth/CDN",
		observabilityLoggingUsd: "Observability/logging",
		aiApisUsd: "AI APIs",
		miscInfraUsd: "Misc infra",
	};

	return labels[key] ?? key;
}

function cloudGrowthLabel(key: string) {
	const labels: Record<string, string> = {
		computeGpuUsd: "GPU inference is the main May cost driver.",
		databasesUsd: "Database scaling follows request and workspace growth.",
		storageUsd: "Storage is growing steadily with model artifacts and exports.",
		bandwidthCdnUsd: "Bandwidth rises with active usage and API traffic.",
		observabilityLoggingUsd: "Logging volume tracks request growth.",
		aiApisUsd: "External AI calls remain meaningful but below GPU spend.",
		miscInfraUsd: "Smaller networking and support infrastructure costs.",
	};

	return labels[key] ?? "Infrastructure cost category.";
}
