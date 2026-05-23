import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { startupDashboardData, startupDataset } from "#/data/startup-dataset";

export const Route = createFileRoute("/expense-breakdown")({ component: App });

const cloudCategories = Object.entries(startupDashboardData.cloudExpenses).map(
	([id, spend]) => ({
		id,
		name: cloudExpenseLabel(id),
		spend,
		growth: cloudGrowthLabel(id),
	}),
);
const aiTokenCategories = startupDashboardData.aiTokenUsage.services.map(
	(service) => ({
		id: service.id,
		name: service.name,
		spend: service.costUsd,
		growth: `${(service.tokensUsed / 1000000).toFixed(1)}M tokens/mo · ${service.usage}`,
	}),
);
const expenseCategories = [...cloudCategories, ...aiTokenCategories];

const currentCloudSpend = Object.values(
	startupDashboardData.cloudExpenses,
).reduce((sum, spend) => sum + spend, 0);
const currentAiTokenSpend = startupDashboardData.aiTokenUsage.totalCostUsd;
const currentCostDriverSpend = currentCloudSpend + currentAiTokenSpend;
const currentRevenue = startupDataset.businessMetrics.mrrUsd;
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
const latestFundingRound = startupDataset.fundingRounds[0];

function App() {
	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="mb-8">
				<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div>
						<p className="island-kicker mb-2">Expense breakdown</p>
						<h1 className="display-title m-0 text-3xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-5xl">
							Cloud, AI, cash flow, and runway
						</h1>
					</div>
				
				</div>
			</section>

			<div className="grid gap-8 lg:grid-cols-2">
				<section>
					<div className="island-shell rounded-2xl p-4 sm:p-6">
						<div className="mb-4">
							<p className="island-kicker mb-2">Expense breakdown</p>
							<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
								Cloud & AI Cost Categories
							</h2>
						</div>
						<div className="space-y-3">
							{expenseCategories.map((category) => (
								<div
									key={category.id}
									className="rounded-lg border border-[var(--line)] bg-white/50 p-4 dark:bg-white/5"
								>
									<div className="mb-3 flex items-center justify-between gap-3">
										<h3 className="m-0 text-base font-extrabold text-[var(--sea-ink)]">
											{category.name}
										</h3>
										<span className="shrink-0 text-lg font-extrabold text-[var(--sea-ink)]">
											${(category.spend / 1000).toFixed(1)}k
										</span>
									</div>
									<div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
										<div
											className="h-full rounded-full bg-[var(--lagoon-deep)]"
											style={{
												width: `${(category.spend / currentCostDriverSpend) * 100}%`,
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
								Total Cloud + AI Spend: $
								{(currentCostDriverSpend / 1000).toFixed(1)}k/mo
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
								label="AI Token Spend"
								value={`-$${(currentAiTokenSpend / 1000).toFixed(1)}k`}
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
		</main>
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
