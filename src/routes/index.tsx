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
import { useState } from "react";

export const Route = createFileRoute("/")({ component: App });

// Mock monthly data for 12 months
const monthlyData = [
	{ month: "Jan", revenue: 128400, expenses: 89200, cloudCost: 71600 },
	{ month: "Feb", revenue: 133200, expenses: 92800, cloudCost: 74600 },
	{ month: "Mar", revenue: 137240, expenses: 95400, cloudCost: 76800 },
	{ month: "Apr", revenue: 142800, expenses: 98600, cloudCost: 79400 },
	{ month: "May", revenue: 151600, expenses: 103200, cloudCost: 83200 },
	{ month: "Jun", revenue: 156400, expenses: 107800, cloudCost: 87000 },
	{ month: "Jul", revenue: 163200, expenses: 112400, cloudCost: 90800 },
	{ month: "Aug", revenue: 171800, expenses: 118200, cloudCost: 95600 },
	{ month: "Sep", revenue: 179400, expenses: 124600, cloudCost: 101200 },
	{ month: "Oct", revenue: 188600, expenses: 131800, cloudCost: 107400 },
	{ month: "Nov", revenue: 196200, expenses: 138400, cloudCost: 113200 },
	{ month: "Dec", revenue: 205800, expenses: 146200, cloudCost: 120600 },
];

const cloudProviders = [
	{ name: "AWS", spend: 42380, growth: 22, color: "bg-orange-500" },
	{ name: "GCP", spend: 21640, growth: 27, color: "bg-blue-500" },
	{ name: "Azure", spend: 18200, growth: 18, color: "bg-cyan-500" },
	{ name: "Cloudflare", spend: 7180, growth: 15, color: "bg-yellow-500" },
];

function App() {
	const [selectedMetric, setSelectedMetric] = useState<"revenue" | "expenses">(
		"revenue",
	);

	const totalCloudSpend = cloudProviders.reduce(
		(sum, provider) => sum + provider.spend,
		0,
	);
	const currentRevenue = monthlyData[monthlyData.length - 1].revenue;
	const currentExpenses = monthlyData[monthlyData.length - 1].expenses;
	const monthlyProfit = currentRevenue - currentExpenses;
	const bankBalance = 410000;
	const runway = bankBalance / currentExpenses;

	const maxValue = Math.max(
		...monthlyData.map((d) => Math.max(d.revenue, d.expenses)),
	);

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="mb-8">
				<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div>
						<p className="island-kicker mb-2">Public-price forecast</p>
						<h1 className="display-title m-0 max-w-3xl text-3xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-5xl">
							AI Runway CFO Dashboard
						</h1>
					</div>
					<a
						href="/connect"
						className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-bold text-[var(--sea-ink)] no-underline hover:-translate-y-0.5"
					>
						Configure Sources
						<ArrowRight size={16} />
					</a>
				</div>

				{/* Key Metrics */}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<MetricCard
						icon={CreditCard}
						label="Monthly Revenue"
						value={`$${(currentRevenue / 1000).toFixed(1)}k`}
						change="+12.4%"
						trend="up"
					/>
					<MetricCard
						icon={Cloud}
						label="Cloud Expenses"
						value={`$${(totalCloudSpend / 1000).toFixed(1)}k`}
						change="+22%"
						trend="down"
					/>
					<MetricCard
						icon={DollarSign}
						label="Net Profit"
						value={`$${(monthlyProfit / 1000).toFixed(1)}k`}
						change="+8.2%"
						trend="up"
					/>
					<MetricCard
						icon={Landmark}
						label="Runway"
						value={`${runway.toFixed(1)} mo`}
						change="-0.3 mo"
						trend="down"
					/>
				</div>
			</section>

			{/* Revenue vs Expenses Chart */}
			<section className="mb-8">
				<div className="island-shell rounded-2xl p-4 sm:p-6">
					<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
						<div>
							<p className="island-kicker mb-2">12-Month Trend</p>
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
				{/* Cloud Provider Breakdown */}
				<section>
					<div className="island-shell rounded-2xl p-4 sm:p-6">
						<div className="mb-4">
							<p className="island-kicker mb-2">Expense breakdown</p>
							<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
								Cloud Providers
							</h2>
						</div>
						<div className="space-y-3">
							{cloudProviders.map((provider) => (
								<div
									key={provider.name}
									className="rounded-lg border border-[var(--line)] bg-white/50 p-4 dark:bg-white/5"
								>
									<div className="mb-3 flex items-center justify-between">
										<h3 className="m-0 text-base font-extrabold text-[var(--sea-ink)]">
											{provider.name}
										</h3>
										<span className="text-lg font-extrabold text-[var(--sea-ink)]">
											${(provider.spend / 1000).toFixed(1)}k
										</span>
									</div>
									<div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
										<div
											className={`h-full ${provider.color}`}
											style={{
												width: `${(provider.spend / totalCloudSpend) * 100}%`,
											}}
										/>
									</div>
									<p className="m-0 text-xs text-[var(--sea-ink-soft)]">
										Growth: +{provider.growth}% MoM
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

				{/* Cash Flow Projection */}
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
							<div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-white/50 p-3 dark:bg-white/5">
								<span className="text-sm font-bold text-[var(--sea-ink-soft)]">
									Monthly Burn Rate
								</span>
								<span className="text-base font-extrabold text-red-600">
									-${(currentExpenses / 1000).toFixed(1)}k
								</span>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-white/50 p-3 dark:bg-white/5">
								<span className="text-sm font-bold text-[var(--sea-ink-soft)]">
									Monthly Profit
								</span>
								<span className="text-base font-extrabold text-emerald-600">
									+${(monthlyProfit / 1000).toFixed(1)}k
								</span>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
								<span className="text-sm font-bold text-emerald-700 dark:text-emerald-200">
									Runway (Current Rate)
								</span>
								<span className="text-base font-extrabold text-emerald-700 dark:text-emerald-200">
									{runway.toFixed(1)} months
								</span>
							</div>
						</div>
						<div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
							<p className="m-0 text-xs font-bold uppercase text-amber-700 dark:text-amber-200">
								Optimization Opportunity
							</p>
							<p className="m-0 mt-1 text-sm text-[var(--sea-ink)]">
								Reducing cloud spend by 15% could extend runway by 0.8 months
							</p>
						</div>
					</div>
				</section>
			</div>

			{/* Expense Spikes Alert */}
			<section className="mt-8">
				<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 sm:p-6">
					<div className="flex gap-3">
						<TrendingUp className="shrink-0 text-red-600" size={24} />
						<div>
							<h3 className="m-0 mb-2 text-lg font-extrabold text-red-700 dark:text-red-300">
								Expense Spike Detected
							</h3>
							<p className="m-0 mb-3 text-sm leading-6 text-[var(--sea-ink)]">
								Cloud expenses increased by 22% in the last quarter. AWS EC2 and
								GCP Compute Engine are the primary drivers.
							</p>
							<div className="flex flex-wrap gap-2">
								<span className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white">
									AWS +22%
								</span>
								<span className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white">
									GCP +27%
								</span>
								<span className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white">
									Azure +18%
								</span>
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}

function MetricCard({
	icon: Icon,
	label,
	value,
	change,
	trend,
}: {
	icon: React.ElementType;
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
			{/* Y-axis labels */}
			<div className="absolute left-0 top-0 flex h-full w-12 flex-col justify-between text-right text-xs font-bold text-[var(--sea-ink-soft)]">
				<span>${(maxValue / 1000).toFixed(0)}k</span>
				<span>${(maxValue / 2000).toFixed(0)}k</span>
				<span>$0</span>
			</div>

			{/* Chart area */}
			<div className="ml-14 flex h-full items-end justify-between gap-1">
				{data.map((item, index) => {
					const revenueHeight = (item.revenue / maxValue) * 100;
					const expenseHeight = (item.expenses / maxValue) * 100;
					const isHovered = hoveredIndex === index;

					return (
						<div
							key={item.month}
							className="relative flex flex-1 flex-col items-center"
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
						>
							{/* Tooltip */}
							{isHovered && (
								<div className="absolute -top-20 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 shadow-lg">
									<p className="m-0 mb-1 text-xs font-bold text-[var(--sea-ink-soft)]">
										{item.month}
									</p>
									<p className="m-0 text-sm font-bold text-emerald-600">
										Revenue: ${(item.revenue / 1000).toFixed(1)}k
									</p>
									<p className="m-0 text-sm font-bold text-red-600">
										Expenses: ${(item.expenses / 1000).toFixed(1)}k
									</p>
								</div>
							)}

							{/* Bars */}
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

							{/* Month label */}
							<span className="text-xs font-bold text-[var(--sea-ink-soft)]">
								{item.month}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
