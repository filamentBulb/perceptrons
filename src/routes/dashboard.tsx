import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import {
	Activity,
	AlertTriangle,
	ArrowLeft,
	ArrowUpRight,
	BarChart3,
	Cloud,
	DollarSign,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { runwayStore } from "../lib/runway-store";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

// Mock data based on connected providers
const dashboardData = {
	currentBalance: 410000,
	monthlyRevenue: 137240,
	monthlyExpenses: 79620,
	runway: 7.2,

	// Cloud provider costs
	cloudExpenses: {
		aws: 42380,
		gcp: 21640,
		azure: 8420,
		cloudflare: 7180,
	},

	// Revenue sources
	revenueStreams: {
		stripe: 137240,
		subscriptions: 104600,
		usage: 32640,
	},

	// Monthly trend data for charts
	monthlyTrend: [
		{ month: "Dec", revenue: 118, expenses: 68, balance: 340 },
		{ month: "Jan", revenue: 125, expenses: 72, balance: 365 },
		{ month: "Feb", revenue: 131, expenses: 75, balance: 385 },
		{ month: "Mar", revenue: 137, expenses: 79, balance: 410 },
		{ month: "Apr", revenue: 145, expenses: 83, balance: 438 },
		{ month: "May", revenue: 152, expenses: 88, balance: 465 },
	],

	// Projected costs
	projectedCosts: [
		{ month: "Apr", aws: 42, gcp: 22, azure: 8, cloudflare: 7 },
		{ month: "May", aws: 48, gcp: 24, azure: 9, cloudflare: 8 },
		{ month: "Jun", aws: 51, gcp: 26, azure: 10, cloudflare: 9 },
		{ month: "Jul", aws: 55, gcp: 28, azure: 11, cloudflare: 9 },
		{ month: "Aug", aws: 58, gcp: 30, azure: 12, cloudflare: 10 },
		{ month: "Sep", aws: 62, gcp: 32, azure: 13, cloudflare: 11 },
	],
};

function Dashboard() {
	const connected = useStore(runwayStore, (state) => state.connectedSourceIds);

	const totalCloudCost = Object.values(dashboardData.cloudExpenses).reduce((a, b) => a + b, 0);
	const netIncome = dashboardData.monthlyRevenue - dashboardData.monthlyExpenses;
	const incomeToSpendRatio = (dashboardData.monthlyRevenue / dashboardData.monthlyExpenses).toFixed(2);
	const healthStatus = parseFloat(incomeToSpendRatio) > 1.2 ? "Healthy" : parseFloat(incomeToSpendRatio) > 1 ? "Stable" : "At Risk";
	const healthColor = healthStatus === "Healthy" ? "text-emerald-500" : healthStatus === "Stable" ? "text-yellow-500" : "text-red-500";

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
							Live insights from {connected.length} connected source{connected.length !== 1 ? 's' : ''}
						</p>
					</div>
					<div className={`rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-center`}>
						<p className="text-xs font-bold uppercase text-[var(--kicker)]">Health Status</p>
						<p className={`text-2xl font-extrabold ${healthColor}`}>{healthStatus}</p>
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
						change="+14%"
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
								<span className="text-sm font-bold text-[var(--sea-ink)]">Net Income</span>
								<span className={`text-lg font-extrabold ${netIncome > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
									${(netIncome / 1000).toFixed(1)}k
								</span>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3">
								<span className="text-sm font-bold text-[var(--sea-ink)]">Burn Rate</span>
								<span className="text-lg font-extrabold text-[var(--sea-ink)]">
									${(dashboardData.monthlyExpenses / 1000).toFixed(1)}k/mo
								</span>
							</div>
						</div>
					</div>

					{/* Cloud Expenses Breakdown */}
					<div className="island-shell rounded-2xl p-6">
						<div className="mb-4">
							<p className="island-kicker mb-1">Current month</p>
							<h2 className="text-lg font-extrabold text-[var(--sea-ink)]">
								Cloud Expenses by Provider
							</h2>
						</div>
						<div className="mb-4 text-center">
							<div className="text-4xl font-extrabold text-[var(--sea-ink)]">
								${(totalCloudCost / 1000).toFixed(1)}k
							</div>
							<p className="text-sm text-[var(--sea-ink-soft)]">Total cloud spend</p>
						</div>
						<div className="space-y-3">
							{Object.entries(dashboardData.cloudExpenses).map(([provider, cost]) => {
								const percentage = ((cost / totalCloudCost) * 100).toFixed(0);
								return (
									<div key={provider} className="space-y-1">
										<div className="flex items-center justify-between text-sm">
											<span className="font-bold capitalize text-[var(--sea-ink)]">
												{provider === 'gcp' ? 'GCP' : provider === 'aws' ? 'AWS' : provider.charAt(0).toUpperCase() + provider.slice(1)}
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
							})}
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

				{/* Insights */}
				<div className="mt-6 grid gap-4 lg:grid-cols-3">
					<InsightCard
						icon={AlertTriangle}
						title="Cost Trend Alert"
						description="Cloud costs increased 14% this month. Consider optimizing AWS EC2 instances."
						type="warning"
					/>
					<InsightCard
						icon={TrendingUp}
						title="Revenue Growth"
						description="Revenue up 18% month-over-month. Subscription renewals are strong."
						type="success"
					/>
					<InsightCard
						icon={Cloud}
						title="Provider Mix"
						description="AWS represents 53% of cloud spend. Diversification opportunity exists."
						type="info"
					/>
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
				<p className="text-xs font-extrabold uppercase text-[var(--kicker)]">{label}</p>
				<Icon className="text-[var(--lagoon-deep)]" size={18} />
			</div>
			<p className="mb-1 text-2xl font-extrabold text-[var(--sea-ink)]">{value}</p>
			<p className={`text-xs font-bold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
				{change}
			</p>
		</div>
	);
}

function RevenueExpensesChart({
	data,
}: {
	data: Array<{ month: string; revenue: number; expenses: number; balance: number }>;
}) {
	const maxValue = Math.max(...data.map((d) => Math.max(d.revenue, d.expenses)));

	return (
		<div className="h-64">
			<div className="flex h-full items-end justify-between gap-2">
				{data.map((point, index) => {
					const revenueHeight = (point.revenue / maxValue) * 100;
					const expensesHeight = (point.expenses / maxValue) * 100;

					return (
						<div key={index} className="flex flex-1 flex-col items-center gap-2">
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
							<p className="text-xs font-bold text-[var(--sea-ink-soft)]">{point.month}</p>
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
	data: Array<{ month: string; aws: number; gcp: number; azure: number; cloudflare: number }>;
}) {
	const maxValue = Math.max(...data.map((d) => d.aws + d.gcp + d.azure + d.cloudflare));

	return (
		<div className="h-64">
			<div className="flex h-full items-end justify-between gap-2">
				{data.map((point, index) => {
					const total = point.aws + point.gcp + point.azure + point.cloudflare;
					const totalHeight = (total / maxValue) * 100;

					return (
						<div key={index} className="flex flex-1 flex-col items-center gap-2">
							<div className="flex w-full flex-1 flex-col justify-end">
								<div
									className="w-full rounded-t-lg bg-gradient-to-t from-[var(--lagoon)] to-[var(--lagoon-deep)]"
									style={{ height: `${totalHeight}%` }}
									title={`Total: $${total}k`}
								/>
							</div>
							<div className="text-center">
								<p className="text-xs font-bold text-[var(--sea-ink-soft)]">{point.month}</p>
								<p className="text-xs font-extrabold text-[var(--sea-ink)]">${total}k</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function InsightCard({
	icon: Icon,
	title,
	description,
	type,
}: {
	icon: React.ElementType;
	title: string;
	description: string;
	type: "success" | "warning" | "info";
}) {
	const config = {
		success: {
			bg: "bg-emerald-500/10",
			border: "border-emerald-500/20",
			text: "text-emerald-700 dark:text-emerald-300",
			icon: "text-emerald-600",
		},
		warning: {
			bg: "bg-yellow-500/10",
			border: "border-yellow-500/20",
			text: "text-yellow-700 dark:text-yellow-300",
			icon: "text-yellow-600",
		},
		info: {
			bg: "bg-blue-500/10",
			border: "border-blue-500/20",
			text: "text-blue-700 dark:text-blue-300",
			icon: "text-blue-600",
		},
	};

	const style = config[type];

	return (
		<div className={`${style.bg} border ${style.border} rounded-xl p-4`}>
			<div className="mb-2 flex items-center gap-2">
				<Icon className={style.icon} size={18} />
				<h3 className={`text-sm font-extrabold ${style.text}`}>{title}</h3>
			</div>
			<p className="text-sm text-[var(--sea-ink-soft)]">{description}</p>
		</div>
	);
}
