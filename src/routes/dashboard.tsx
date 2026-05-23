import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowDownRight,
	ArrowRight,
	ArrowUpRight,
	Bot,
	ChevronDown,
	Cloud,
	CreditCard,
	DollarSign,
	Landmark,
} from "lucide-react";
import { type ElementType, useEffect, useRef, useState } from "react";
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

// Generate future months data starting from May
const MONTH_NAMES = [
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
	"Jan",
	"Feb",
	"Mar",
	"Apr",
];

function generateFutureMonthsData(monthCount: number) {
	const result = [];
	// Get the last month's data (May) from historical data
	const lastMonth = monthlyData[monthlyData.length - 1];

	// Calculate average growth rates from historical data
	const revenueGrowthRate =
		monthlyData.length >= 2
			? (lastMonth.revenue - monthlyData[0].revenue) /
				monthlyData[0].revenue /
				(monthlyData.length - 1)
			: 0.15; // default 15% per month
	const expenseGrowthRate =
		monthlyData.length >= 2
			? (lastMonth.expenses - monthlyData[0].expenses) /
				monthlyData[0].expenses /
				(monthlyData.length - 1)
			: 0.12; // default 12% per month

	for (let i = 0; i < monthCount; i++) {
		const monthName = MONTH_NAMES[i];
		result.push({
			month: monthName,
			revenue: Math.round(lastMonth.revenue * (1 + revenueGrowthRate) ** i),
			funding: 0, // No future funding projections
			expenses: Math.round(lastMonth.expenses * (1 + expenseGrowthRate) ** i),
		});
	}

	return result;
}

const currentCloudSpend = Object.values(
	startupDashboardData.cloudExpenses,
).reduce((sum, spend) => sum + spend, 0);
const currentAiTokenSpend = startupDashboardData.aiTokenUsage.totalCostUsd;
const currentAiTokenUsage = startupDashboardData.aiTokenUsage.totalTokens;
const currentRevenue = latestStartupSnapshot.revenueUsd;
const currentPayroll = startupDataset.businessMetrics.payrollUsd;
const currentMarketingSpend = startupDataset.businessMetrics.marketingSpendUsd;
const currentSaasToolsSpend = startupDataset.businessMetrics.saasToolsUsd;
const currentExpenses =
	currentCloudSpend +
	currentAiTokenSpend +
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
	const [selectedMonths, setSelectedMonths] = useState<number>(6);

	const totalCloudSpend = currentCloudSpend;
	const latestFundingRound = startupDataset.fundingRounds[0];
	const fundingRaised = startupDataset.company.fundingRaisedUsd;
	const spikeScenario = startupDataset.dangerScenarios[0];

	// Generate future months data based on selected month count
	const filteredMonthlyData = generateFutureMonthsData(selectedMonths);

	const maxValue = Math.max(
		...filteredMonthlyData.map((point) =>
			Math.max(point.revenue, point.expenses),
		),
	);

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="mb-8">
				<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div className="flex-1">
						<h1 className="display-title m-0 text-3xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-5xl">
							Dashboard
						</h1>
					</div>
					<div className="flex flex-wrap gap-2">
						<a
							href="/"
							className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-bold text-[var(--sea-ink)] no-underline hover:-translate-y-0.5"
						>
							Configure Sources
							<ArrowRight size={16} />
						</a>
					</div>
				</div>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
						icon={Bot}
						label="AI Usage"
						value={`${(currentAiTokenUsage / 1000000).toFixed(1)}M tokens · $${(currentAiTokenSpend / 1000).toFixed(1)}k`}
						change="OpenAI + Anthropic"
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
							<h2 className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
								Revenue vs Expenses
							</h2>
						</div>
						<div className="flex flex-wrap gap-2">
							<MonthRangeSelector
								value={selectedMonths}
								onChange={setSelectedMonths}
							/>
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
							data={filteredMonthlyData}
							maxValue={maxValue}
							selectedMetric={selectedMetric}
						/>
					</div>
				</div>
			</section>

			{/* <section className="mt-8">
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
			</section> */}
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

function MonthRangeSelector({
	value,
	onChange,
}: {
	value: number;
	onChange: (value: number) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		}

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-sm font-bold text-[var(--sea-ink)] transition-colors hover:bg-white/75 dark:hover:bg-white/10"
			>
				{value} {value === 1 ? "Month" : "Months"}
				<ChevronDown
					size={16}
					className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>
			{isOpen && (
				<div className="absolute right-0 top-full z-10 mt-2 max-h-60 w-32 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-2 shadow-lg">
					<div className="space-y-1">
						{Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
							<button
								key={month}
								type="button"
								onClick={() => {
									onChange(month);
									setIsOpen(false);
								}}
								className={`block w-full rounded-md px-3 py-1.5 text-left text-sm font-bold transition-colors hover:bg-[var(--lagoon)]/20 ${
									value === month
										? "bg-[var(--lagoon)]/20 text-[var(--lagoon-deep)]"
										: "text-[var(--sea-ink)]"
								}`}
							>
								{month} {month === 1 ? "Month" : "Months"}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function RevenueExpenseChart({
	data,
	maxValue,
	selectedMetric,
}: {
	data: Array<{
		month: string;
		revenue: number;
		funding: number;
		expenses: number;
	}>;
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
								<div className="absolute -top-20 left-1/2 z-10 w-max min-w-44 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-left shadow-lg">
									<p className="m-0 mb-1 text-xs font-bold text-[var(--sea-ink-soft)]">
										{item.month}
									</p>
									<p className="m-0 whitespace-nowrap text-sm font-bold text-emerald-600">
										Revenue: ${(item.revenue / 1000).toFixed(1)}k
									</p>
									{item.funding > 0 && (
										<p className="m-0 whitespace-nowrap text-sm font-bold text-blue-600">
											Funding: ${(item.funding / 1000000).toFixed(1)}M
										</p>
									)}
									<p className="m-0 whitespace-nowrap text-sm font-bold text-red-600">
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

function formatSignedPercent(value: number) {
	const sign = value > 0 ? "+" : "";

	return `${sign}${value.toFixed(0)}%`;
}
