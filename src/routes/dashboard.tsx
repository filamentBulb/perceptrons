import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import {
	Activity,
	ArrowLeft,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { startupDashboardData as dashboardData } from "#/data/startup-dataset";
import { runwayStore } from "../lib/runway-store";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Dashboard() {
	const connected = useStore(runwayStore, (state) => state.connectedSourceIds);

	const totalCloudCost = Object.values(dashboardData.cloudExpenses).reduce(
		(a, b) => a + b,
		0,
	);
	const netIncome =
		dashboardData.monthlyRevenue - dashboardData.monthlyExpenses;
	const incomeToSpendRatio = (
		dashboardData.monthlyRevenue / dashboardData.monthlyExpenses
	).toFixed(2);
	const healthStatus =
		parseFloat(incomeToSpendRatio) > 1.2
			? "Healthy"
			: parseFloat(incomeToSpendRatio) > 1
				? "Stable"
				: "At Risk";
	const healthColor =
		healthStatus === "Healthy"
			? "text-emerald-500"
			: healthStatus === "Stable"
				? "text-yellow-500"
				: "text-red-500";

	return (
		<div className="min-h-screen bg-[var(--surface)] px-4 pb-12 pt-8">
			<div className="page-wrap mx-auto">
				{/* Header */}
				<div className="mb-8 flex items-center justify-between">
					<div>
						<Link
							to="/"
							className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] no-underline"
						>
							<ArrowLeft size={16} />
							Back to connections
						</Link>
						<h1 className="text-3xl font-extrabold text-[var(--sea-ink)]">
							Financial Dashboard
						</h1>
						<p className="mt-2 text-[var(--sea-ink-soft)]">
							Live insights from {connected.length} connected source
							{connected.length !== 1 ? "s" : ""}
						</p>
					</div>
					<div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-center">
						<p className="text-xs font-bold uppercase text-[var(--kicker)]">
							Health Status
						</p>
						<p className={`text-2xl font-extrabold ${healthColor}`}>
							{healthStatus}
						</p>
					</div>
				</div>

				{/* Key Metrics */}
				<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<MetricCard
						icon={Wallet}
						label="Current Balance"
						value={`$${(dashboardData.currentBalance / 1000).toFixed(0)}k`}
						change="+2.8%"
						positive
					/>
					<MetricCard
						icon={TrendingUp}
						label="Monthly Revenue"
						value={`$${(dashboardData.monthlyRevenue / 1000).toFixed(0)}k`}
						change="+18%"
						positive
					/>
					<MetricCard
						icon={TrendingDown}
						label="Monthly Expenses"
						value={`$${(dashboardData.monthlyExpenses / 1000).toFixed(0)}k`}
						change={`Burn $${(dashboardData.netBurn / 1000).toFixed(0)}k`}
						positive={false}
					/>
					<MetricCard
						icon={Activity}
						label="Runway"
						value={`${dashboardData.runway} mo`}
						change="Healthy"
						positive
					/>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					{/* Revenue vs Expenses Chart */}
					<div className="island-shell rounded-2xl p-6">
						<div className="mb-4 flex items-center justify-between">
							<div>
								<p className="island-kicker mb-1">6-month trend</p>
								<h2 className="text-lg font-extrabold text-[var(--sea-ink)]">
									Revenue vs Expenses
								</h2>
							</div>
							<div className="flex gap-3 text-xs font-bold">
								<span className="flex items-center gap-1.5">
									<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
									Revenue
								</span>
								<span className="flex items-center gap-1.5">
									<span className="h-2.5 w-2.5 rounded-full bg-red-500" />
									Expenses
								</span>
							</div>
						</div>
						<RevenueExpensesChart data={dashboardData.monthlyTrend} />
					</div>

					{/* Income to Spend Ratio */}
					<div className="island-shell rounded-2xl p-6">
						<div className="mb-4">
							<p className="island-kicker mb-1">Financial health</p>
							<h2 className="text-lg font-extrabold text-[var(--sea-ink)]">
								Income to Spend Ratio
							</h2>
						</div>
						<div className="mb-6 text-center">
							<div className={`text-6xl font-extrabold ${healthColor}`}>
								{incomeToSpendRatio}
							</div>
							<p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
								For every $1 spent, you earn ${incomeToSpendRatio}
							</p>
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3">
								<span className="text-sm font-bold text-[var(--sea-ink)]">
									Net Income
								</span>
								<span
									className={`text-lg font-extrabold ${netIncome > 0 ? "text-emerald-500" : "text-red-500"}`}
								>
									{netIncome < 0 ? "-" : ""}$
									{Math.abs(netIncome / 1000).toFixed(1)}k
								</span>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3">
								<span className="text-sm font-bold text-[var(--sea-ink)]">
									Net Burn Rate
								</span>
								<span className="text-lg font-extrabold text-[var(--sea-ink)]">
									${(dashboardData.netBurn / 1000).toFixed(1)}k/mo
								</span>
							</div>
						</div>
					</div>

					{/* Cloud Expenses Breakdown */}
					<div className="island-shell rounded-2xl p-6">
						<div className="mb-4">
							<p className="island-kicker mb-1">Current month</p>
							<h2 className="text-lg font-extrabold text-[var(--sea-ink)]">
								Cloud Expenses by Category
							</h2>
						</div>
						<div className="mb-4 text-center">
							<div className="text-4xl font-extrabold text-[var(--sea-ink)]">
								${(totalCloudCost / 1000).toFixed(1)}k
							</div>
							<p className="text-sm text-[var(--sea-ink-soft)]">
								Total cloud spend
							</p>
						</div>
						<div className="space-y-3">
							{Object.entries(dashboardData.cloudExpenses).map(
								([provider, cost]) => {
									const percentage = ((cost / totalCloudCost) * 100).toFixed(0);
									return (
										<div key={provider} className="space-y-1">
											<div className="flex items-center justify-between text-sm">
												<span className="font-bold capitalize text-[var(--sea-ink)]">
													{cloudExpenseLabel(provider)}
												</span>
												<span className="font-extrabold text-[var(--sea-ink)]">
													${(cost / 1000).toFixed(1)}k
												</span>
											</div>
											<div className="h-2 overflow-hidden rounded-full bg-[var(--surface)]">
												<div
													className="h-full rounded-full bg-gradient-to-r from-[var(--lagoon)] to-[var(--lagoon-deep)]"
													style={{ width: `${percentage}%` }}
												/>
											</div>
										</div>
									);
								},
							)}
						</div>
					</div>

					{/* Projected Cloud Costs */}
					<div className="island-shell rounded-2xl p-6">
						<div className="mb-4">
							<p className="island-kicker mb-1">6-month forecast</p>
							<h2 className="text-lg font-extrabold text-[var(--sea-ink)]">
								Projected Cloud Costs
							</h2>
						</div>
						<ProjectedCostsChart data={dashboardData.projectedCosts} />
					</div>
				</div>
			</div>
		</div>
	);
}

function MetricCard({
	icon: Icon,
	label,
	value,
	change,
	positive,
}: {
	icon: React.ElementType;
	label: string;
	value: string;
	change: string;
	positive: boolean;
}) {
	return (
		<div className="island-shell rounded-xl p-4">
			<div className="mb-3 flex items-center justify-between">
				<p className="text-xs font-extrabold uppercase text-[var(--kicker)]">
					{label}
				</p>
				<Icon className="text-[var(--lagoon-deep)]" size={18} />
			</div>
			<p className="mb-1 text-2xl font-extrabold text-[var(--sea-ink)]">
				{value}
			</p>
			<p
				className={`text-xs font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}
			>
				{change}
			</p>
		</div>
	);
}

function RevenueExpensesChart({
	data,
}: {
	data: Array<{
		month: string;
		revenue: number;
		expenses: number;
		cloud: number;
	}>;
}) {
	const maxValue = Math.max(
		...data.map((d) => Math.max(d.revenue, d.expenses)),
	);

	return (
		<div className="h-64">
			<div className="flex h-full items-end justify-between gap-2">
				{data.map((point) => {
					const revenueHeight = (point.revenue / maxValue) * 100;
					const expensesHeight = (point.expenses / maxValue) * 100;

					return (
						<div
							key={point.month}
							className="flex flex-1 flex-col items-center gap-2"
						>
							<div className="flex w-full flex-1 items-end justify-center gap-1">
								<div
									className="w-full rounded-t-lg bg-emerald-500"
									style={{ height: `${revenueHeight}%` }}
									title={`Revenue: $${point.revenue}k`}
								/>
								<div
									className="w-full rounded-t-lg bg-red-500"
									style={{ height: `${expensesHeight}%` }}
									title={`Expenses: $${point.expenses}k`}
								/>
							</div>
							<p className="text-xs font-bold text-[var(--sea-ink-soft)]">
								{point.month}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ProjectedCostsChart({
	data,
}: {
	data: Array<{
		month: string;
		computeGpu: number;
		databases: number;
		storage: number;
		bandwidthCdn: number;
		observability: number;
		aiApis: number;
		miscInfra: number;
	}>;
}) {
	const maxValue = Math.max(...data.map(projectedCostTotal));

	return (
		<div className="h-64">
			<div className="flex h-full items-end justify-between gap-2">
				{data.map((point) => {
					const total = projectedCostTotal(point);
					const totalHeight = (total / maxValue) * 100;

					return (
						<div
							key={point.month}
							className="flex flex-1 flex-col items-center gap-2"
						>
							<div className="flex w-full flex-1 flex-col justify-end">
								<div
									className="w-full rounded-t-lg bg-gradient-to-t from-[var(--lagoon)] to-[var(--lagoon-deep)]"
									style={{ height: `${totalHeight}%` }}
									title={`Total: $${total}k`}
								/>
							</div>
							<div className="text-center">
								<p className="text-xs font-bold text-[var(--sea-ink-soft)]">
									{point.month}
								</p>
								<p className="text-xs font-extrabold text-[var(--sea-ink)]">
									${total}k
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function projectedCostTotal(point: {
	computeGpu: number;
	databases: number;
	storage: number;
	bandwidthCdn: number;
	observability: number;
	aiApis: number;
	miscInfra: number;
}) {
	return (
		point.computeGpu +
		point.databases +
		point.storage +
		point.bandwidthCdn +
		point.observability +
		point.aiApis +
		point.miscInfra
	);
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
