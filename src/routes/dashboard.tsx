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
import { awsCostAnalysisMeta, awsCostStageSummary } from "#/data/cost-analysis";
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
	expenses: point.expenses * 1000,
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
	users: number;
	dau: number;
	concurrent: number;
	total: number;
	note: string;
	breakdown: Array<{ label: string; cost: number }>;
};

const CLOUD_SCALE_MODELS: Record<
	CloudProviderId,
	{ name: string; colorClass: string; allocation: number }
> = {
	aws: {
		name: "AWS",
		colorClass: "bg-orange-500",
		allocation: 0.42,
	},
	gcp: {
		name: "GCP",
		colorClass: "bg-blue-500",
		allocation: 0.28,
	},
	azure: {
		name: "Azure",
		colorClass: "bg-cyan-500",
		allocation: 0.19,
	},
	cloudflare: {
		name: "Cloudflare",
		colorClass: "bg-yellow-500",
		allocation: 0.11,
	},
};

const currentUsers = latestStartupSnapshot.mau;
const currentCloudSpend = Object.values(
	startupDashboardData.cloudExpenses,
).reduce((sum, spend) => sum + spend, 0);
const currentCloudSpendFromSnapshots = latestStartupSnapshot.cloudSpendUsd;
const currentCloudSpendDelta =
	currentCloudSpend - currentCloudSpendFromSnapshots;
const currentRevenue = latestStartupSnapshot.revenueUsd;
const currentPayroll = startupDataset.businessMetrics.payrollUsd;
const currentMarketingSpend = startupDataset.businessMetrics.marketingSpendUsd;
const currentSaasToolsSpend = startupDataset.businessMetrics.saasToolsUsd;
const currentExpenses =
	currentCloudSpend +
	currentPayroll +
	currentMarketingSpend +
	currentSaasToolsSpend;
const netBurn = Math.max(0, currentExpenses - currentRevenue);
const bankBalance = startupDataset.company.currentCashUsd;
const runway = netBurn === 0 ? Number.POSITIVE_INFINITY : bankBalance / netBurn;
const cloudSpendGrowthPct =
	startupDataset.monthlySnapshots.length < 2
		? 0
		: ((currentCloudSpend -
				startupDataset.monthlySnapshots[
					startupDataset.monthlySnapshots.length - 2
				].cloudSpendUsd) /
				startupDataset.monthlySnapshots[
					startupDataset.monthlySnapshots.length - 2
				].cloudSpendUsd) *
			100;

function App() {
	const [selectedMetric, setSelectedMetric] = useState<"revenue" | "expenses">(
		"revenue",
	);

	const totalCloudSpend = currentCloudSpend;
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
					<div className="flex-1 text-center">
						<h1 className="display-title m-0 text-3xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-5xl">
							AI Runway CFO Dashboard
						</h1>
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
						change={`${formatSignedPercent(cloudSpendGrowthPct)} MoM`}
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
								highlight
							/>
							<RunwayRow
								label="Cloud Expenses"
								value={`-$${(currentCloudSpend / 1000).toFixed(1)}k`}
								danger
							/>
							<RunwayRow
								label="Payroll"
								value={`-$${(currentPayroll / 1000).toFixed(1)}k`}
							/>
							<RunwayRow
								label="Marketing"
								value={`-$${(currentMarketingSpend / 1000).toFixed(1)}k`}
							/>
							<RunwayRow
								label="SaaS Tools"
								value={`-$${(currentSaasToolsSpend / 1000).toFixed(1)}k`}
							/>
							<RunwayRow
								label="Monthly Operating Costs"
								value={`-$${(currentExpenses / 1000).toFixed(1)}k`}
								danger
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
				<AwsCostScenarios />
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
	const [users, setUsers] = useState(currentUsers);
	const tier = makeScaleTier(users);
	const comparisonTotals = CLOUD_PROVIDER_IDS.map((providerId) => {
		const provider = CLOUD_SCALE_MODELS[providerId];

		return {
			id: providerId,
			name: provider.name,
			colorClass: provider.colorClass,
			total: Math.round(tier.total * provider.allocation),
		};
	});
	const cloudSpendSyncsWithDashboard =
		users === currentUsers && currentCloudSpendDelta === 0;

	return (
		<div className="island-shell rounded-2xl p-4 sm:p-6">
			<div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
				<div>
					<p className="island-kicker mb-2">What-if / cloud providers</p>
					<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
						Scale Cost Simulator
					</h2>
				</div>
				<div className="rounded-lg border border-[var(--line)] bg-white/50 px-3 py-2 text-sm font-bold text-[var(--sea-ink)] dark:bg-white/5">
					Current MAU: {currentUsers.toLocaleString()}
				</div>
			</div>

			<div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
				<div className="rounded-xl border border-[var(--line)] bg-white/50 p-4 dark:bg-white/5">
					<p className="m-0 text-sm font-bold text-[var(--sea-ink-soft)]">
						Combined cloud providers at {tier.users.toLocaleString()} users
					</p>
					<div className="mt-1 text-4xl font-extrabold text-[var(--sea-ink)]">
						${formatMonthlyCost(tier.total)}/mo
					</div>
					<p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
						{tier.dau.toLocaleString()} DAU / {tier.concurrent.toLocaleString()}{" "}
						concurrent / {tier.note}
					</p>
					{cloudSpendSyncsWithDashboard && (
						<p className="m-0 mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-200">
							Matches Cloud Expenses dashboard bill.
						</p>
					)}
				</div>
				<div className="grid grid-cols-2 gap-2">
					{comparisonTotals.map((provider) => (
						<div
							key={provider.id}
							className="rounded-lg border border-[var(--line)] bg-white/40 p-3 dark:bg-white/5"
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
				value={[users]}
				min={100}
				max={1000000}
				step={100}
				onValueChange={([value]) => setUsers(value)}
				className="my-4"
				aria-label="Monthly active users"
			/>
			<div className="mb-4 flex justify-between text-xs font-bold text-[var(--sea-ink-soft)]">
				<span>100</span>
				<span>{currentUsers.toLocaleString()} current</span>
				<span>1M</span>
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
									className="h-full rounded-full bg-[var(--lagoon-deep)]"
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

const STAGE_COLORS: Record<number, string> = {
	0: "border-[var(--line)] bg-white/40 dark:bg-white/5",
	1: "border-amber-500/30 bg-amber-500/5",
	2: "border-emerald-500/20 bg-emerald-500/5",
	3: "border-emerald-500/30 bg-emerald-500/10",
	4: "border-emerald-600/40 bg-emerald-500/15",
};

function formatUsd(n: number) {
	if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
	return `$${n.toFixed(0)}`;
}

function AwsCostScenarios() {
	const meta = awsCostAnalysisMeta;

	return (
		<div className="island-shell rounded-2xl p-4 sm:p-6">
			<div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
				<div>
					<p className="island-kicker mb-2">AWS · 1,000,000 users</p>
					<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
						Cost Scenarios
					</h2>
				</div>
				<p className="m-0 text-xs text-[var(--sea-ink-soft)]">
					Region {meta.region} · {meta.pricingSource}
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				{awsCostStageSummary.map((s, i) => (
					<div
						key={s.stage}
						className={`rounded-xl border p-4 ${STAGE_COLORS[i] ?? STAGE_COLORS[0]}`}
					>
						<p className="island-kicker mb-2 text-[10px]">{s.stage}</p>
						<p className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
							{formatUsd(s.monthlyUsd)}
						</p>
						<p className="m-0 text-xs text-[var(--sea-ink-soft)]">/mo</p>
						<p className="m-0 mt-2 text-xs font-bold text-[var(--sea-ink-soft)]">
							{formatUsd(s.annualUsd)} / yr
						</p>
					</div>
				))}
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

function makeScaleTier(users: number): ScaleTier {
	const normalizedUsers = Math.max(100, users);
	const scaleRatio = normalizedUsers / currentUsers;
	const total = Math.round(currentCloudSpend * scaleRatio);

	return {
		users: normalizedUsers,
		dau: Math.round(
			normalizedUsers *
				(startupDataset.productMetrics.dau / startupDataset.productMetrics.mau),
		),
		concurrent: Math.max(1, Math.round(normalizedUsers * 0.005)),
		total,
		note:
			normalizedUsers === currentUsers
				? "current dashboard baseline"
				: "linear estimate from current MAU and cloud bill",
		breakdown: splitScaleCost(total),
	};
}

function splitScaleCost(total: number) {
	const categories = Object.entries(startupDashboardData.cloudExpenses);

	return categories.map(([key, currentCost], index) => {
		const isLast = index === categories.length - 1;
		const allocatedCost = isLast
			? total -
				categories
					.slice(0, -1)
					.reduce(
						(sum, [, cost]) =>
							sum + Math.round(total * (cost / currentCloudSpend)),
						0,
					)
			: Math.round(total * (currentCost / currentCloudSpend));

		return {
			label: cloudExpenseLabel(key),
			cost: allocatedCost,
		};
	});
}

function formatMonthlyCost(value: number) {
	return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function formatSignedPercent(value: number) {
	const sign = value > 0 ? "+" : "";

	return `${sign}${value.toFixed(0)}%`;
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
