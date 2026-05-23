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
import { Slider } from "#/components/ui/slider";

export const Route = createFileRoute("/dashboard")({ component: App });

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

const CLOUD_PROVIDER_IDS = ["aws", "gcp", "azure", "cloudflare"] as const;
type CloudProviderId = (typeof CLOUD_PROVIDER_IDS)[number];

type ScaleBreakdownItem = {
	label: string;
	cost: number;
};

type ScaleTier = {
	users: number;
	dau: number;
	concurrent: number;
	total: number;
	note: string;
	breakdown: ReadonlyArray<ScaleBreakdownItem>;
};

type CloudScaleModel = {
	name: string;
	colorClass: string;
	tiers: ReadonlyArray<ScaleTier>;
};

const cloudProviders: Array<{
	id: CloudProviderId;
	name: string;
	spend: number;
	growth: number;
	color: string;
}> = [
	{ id: "aws", name: "AWS", spend: 42380, growth: 22, color: "bg-orange-500" },
	{ id: "gcp", name: "GCP", spend: 21640, growth: 27, color: "bg-blue-500" },
	{
		id: "azure",
		name: "Azure",
		spend: 18200,
		growth: 18,
		color: "bg-cyan-500",
	},
	{
		id: "cloudflare",
		name: "Cloudflare",
		spend: 7180,
		growth: 15,
		color: "bg-yellow-500",
	},
];

const CLOUD_SCALE_MODELS: Record<CloudProviderId, CloudScaleModel> = {
	aws: {
		name: "AWS",
		colorClass: "bg-orange-500",
		tiers: [
			{
				users: 100,
				dau: 10,
				concurrent: 5,
				total: 84,
				note: "t4g.small + minimal NAT",
				breakdown: [
					{ label: "EC2 (Compute)", cost: 15 },
					{ label: "Load Balancer", cost: 18 },
					{ label: "S3 Storage", cost: 1 },
					{ label: "CloudWatch Logs", cost: 2 },
					{ label: "Aurora DB", cost: 15 },
					{ label: "ElastiCache", cost: 0 },
					{ label: "Data Transfer Out", cost: 1 },
					{ label: "Networking & EBS", cost: 32 },
				],
			},
			{
				users: 10_000,
				dau: 1_000,
				concurrent: 50,
				total: 273,
				note: "1x c6i.xlarge, db.t4g.medium",
				breakdown: [
					{ label: "EC2 (Compute)", cost: 130 },
					{ label: "Load Balancer", cost: 20 },
					{ label: "S3 Storage", cost: 1 },
					{ label: "CloudWatch Logs", cost: 10 },
					{ label: "Aurora DB", cost: 60 },
					{ label: "ElastiCache", cost: 12 },
					{ label: "Data Transfer Out", cost: 5 },
					{ label: "Networking & EBS", cost: 35 },
				],
			},
			{
				users: 100_000,
				dau: 10_000,
				concurrent: 500,
				total: 905,
				note: "2x c6i.xlarge, db.r6g.large",
				breakdown: [
					{ label: "EC2 (Compute)", cost: 500 },
					{ label: "Load Balancer", cost: 25 },
					{ label: "S3 Storage", cost: 5 },
					{ label: "CloudWatch Logs", cost: 60 },
					{ label: "Aurora DB", cost: 200 },
					{ label: "ElastiCache", cost: 25 },
					{ label: "Data Transfer Out", cost: 30 },
					{ label: "Networking & EBS", cost: 60 },
				],
			},
			{
				users: 1_000_000,
				dau: 100_000,
				concurrent: 5_000,
				total: 7270,
				note: "18-20x c6i.xlarge/2xlarge, Aurora cluster",
				breakdown: [
					{ label: "EC2 (Compute)", cost: 5000 },
					{ label: "Load Balancer", cost: 200 },
					{ label: "S3 Storage", cost: 20 },
					{ label: "CloudWatch Logs", cost: 550 },
					{ label: "Aurora DB", cost: 750 },
					{ label: "ElastiCache", cost: 150 },
					{ label: "Data Transfer Out", cost: 300 },
					{ label: "Networking & EBS", cost: 300 },
				],
			},
		],
	},
	gcp: {
		name: "GCP",
		colorClass: "bg-blue-500",
		tiers: [
			{
				users: 100,
				dau: 10,
				concurrent: 5,
				total: 63,
				note: "Cloud Run + small Cloud SQL",
				breakdown: [
					{ label: "Compute", cost: 12 },
					{ label: "Cloud Load Balancing", cost: 16 },
					{ label: "Cloud Storage", cost: 1 },
					{ label: "Cloud Logging", cost: 2 },
					{ label: "Cloud SQL", cost: 13 },
					{ label: "Memorystore", cost: 0 },
					{ label: "Egress", cost: 1 },
					{ label: "VPC & Disks", cost: 18 },
				],
			},
			{
				users: 10_000,
				dau: 1_000,
				concurrent: 50,
				total: 218,
				note: "GCE autoscale + db-custom-2",
				breakdown: [
					{ label: "Compute", cost: 105 },
					{ label: "Cloud Load Balancing", cost: 16 },
					{ label: "Cloud Storage", cost: 1 },
					{ label: "Cloud Logging", cost: 8 },
					{ label: "Cloud SQL", cost: 48 },
					{ label: "Memorystore", cost: 10 },
					{ label: "Egress", cost: 4 },
					{ label: "VPC & Disks", cost: 26 },
				],
			},
			{
				users: 100_000,
				dau: 10_000,
				concurrent: 500,
				total: 790,
				note: "regional MIG + Cloud SQL HA",
				breakdown: [
					{ label: "Compute", cost: 430 },
					{ label: "Cloud Load Balancing", cost: 24 },
					{ label: "Cloud Storage", cost: 4 },
					{ label: "Cloud Logging", cost: 55 },
					{ label: "Cloud SQL", cost: 170 },
					{ label: "Memorystore", cost: 22 },
					{ label: "Egress", cost: 25 },
					{ label: "VPC & Disks", cost: 60 },
				],
			},
			{
				users: 1_000_000,
				dau: 100_000,
				concurrent: 5_000,
				total: 6420,
				note: "multi-zone compute + regional SQL",
				breakdown: [
					{ label: "Compute", cost: 4200 },
					{ label: "Cloud Load Balancing", cost: 180 },
					{ label: "Cloud Storage", cost: 18 },
					{ label: "Cloud Logging", cost: 520 },
					{ label: "Cloud SQL", cost: 730 },
					{ label: "Memorystore", cost: 130 },
					{ label: "Egress", cost: 280 },
					{ label: "VPC & Disks", cost: 362 },
				],
			},
		],
	},
	azure: {
		name: "Azure",
		colorClass: "bg-cyan-500",
		tiers: [
			{
				users: 100,
				dau: 10,
				concurrent: 5,
				total: 72,
				note: "small App Service + Azure SQL",
				breakdown: [
					{ label: "Compute", cost: 14 },
					{ label: "App Gateway", cost: 20 },
					{ label: "Blob Storage", cost: 1 },
					{ label: "Azure Monitor", cost: 2 },
					{ label: "Azure SQL", cost: 16 },
					{ label: "Azure Cache", cost: 0 },
					{ label: "Bandwidth", cost: 1 },
					{ label: "Networking & Disks", cost: 18 },
				],
			},
			{
				users: 10_000,
				dau: 1_000,
				concurrent: 50,
				total: 246,
				note: "B-series app tier + Standard SQL",
				breakdown: [
					{ label: "Compute", cost: 118 },
					{ label: "App Gateway", cost: 24 },
					{ label: "Blob Storage", cost: 1 },
					{ label: "Azure Monitor", cost: 9 },
					{ label: "Azure SQL", cost: 55 },
					{ label: "Azure Cache", cost: 12 },
					{ label: "Bandwidth", cost: 5 },
					{ label: "Networking & Disks", cost: 22 },
				],
			},
			{
				users: 100_000,
				dau: 10_000,
				concurrent: 500,
				total: 860,
				note: "VM scale set + zone-redundant SQL",
				breakdown: [
					{ label: "Compute", cost: 470 },
					{ label: "App Gateway", cost: 38 },
					{ label: "Blob Storage", cost: 4 },
					{ label: "Azure Monitor", cost: 58 },
					{ label: "Azure SQL", cost: 190 },
					{ label: "Azure Cache", cost: 24 },
					{ label: "Bandwidth", cost: 28 },
					{ label: "Networking & Disks", cost: 48 },
				],
			},
			{
				users: 1_000_000,
				dau: 100_000,
				concurrent: 5_000,
				total: 6890,
				note: "scale sets + business critical SQL",
				breakdown: [
					{ label: "Compute", cost: 4500 },
					{ label: "App Gateway", cost: 240 },
					{ label: "Blob Storage", cost: 19 },
					{ label: "Azure Monitor", cost: 530 },
					{ label: "Azure SQL", cost: 780 },
					{ label: "Azure Cache", cost: 140 },
					{ label: "Bandwidth", cost: 300 },
					{ label: "Networking & Disks", cost: 381 },
				],
			},
		],
	},
	cloudflare: {
		name: "Cloudflare",
		colorClass: "bg-yellow-500",
		tiers: [
			{
				users: 100,
				dau: 10,
				concurrent: 5,
				total: 25,
				note: "Workers + R2 starter edge stack",
				breakdown: [
					{ label: "Workers", cost: 5 },
					{ label: "CDN & WAF", cost: 10 },
					{ label: "R2 Storage", cost: 1 },
					{ label: "Logs", cost: 2 },
					{ label: "D1 Database", cost: 3 },
					{ label: "KV", cost: 2 },
					{ label: "Egress", cost: 0 },
					{ label: "Networking", cost: 2 },
				],
			},
			{
				users: 10_000,
				dau: 1_000,
				concurrent: 50,
				total: 96,
				note: "Workers paid + light D1/R2 usage",
				breakdown: [
					{ label: "Workers", cost: 25 },
					{ label: "CDN & WAF", cost: 20 },
					{ label: "R2 Storage", cost: 2 },
					{ label: "Logs", cost: 8 },
					{ label: "D1 Database", cost: 15 },
					{ label: "KV", cost: 8 },
					{ label: "Egress", cost: 0 },
					{ label: "Networking", cost: 18 },
				],
			},
			{
				users: 100_000,
				dau: 10_000,
				concurrent: 500,
				total: 340,
				note: "edge-first app + heavier D1 reads",
				breakdown: [
					{ label: "Workers", cost: 105 },
					{ label: "CDN & WAF", cost: 45 },
					{ label: "R2 Storage", cost: 6 },
					{ label: "Logs", cost: 42 },
					{ label: "D1 Database", cost: 70 },
					{ label: "KV", cost: 22 },
					{ label: "Egress", cost: 0 },
					{ label: "Networking", cost: 50 },
				],
			},
			{
				users: 1_000_000,
				dau: 100_000,
				concurrent: 5_000,
				total: 2600,
				note: "high-volume Workers + regional data tier",
				breakdown: [
					{ label: "Workers", cost: 850 },
					{ label: "CDN & WAF", cost: 220 },
					{ label: "R2 Storage", cost: 20 },
					{ label: "Logs", cost: 360 },
					{ label: "D1 Database", cost: 760 },
					{ label: "KV", cost: 160 },
					{ label: "Egress", cost: 0 },
					{ label: "Networking", cost: 230 },
				],
			},
		],
	},
};

const TIER_LABELS = ["100", "10K", "100K", "1M"] as const;

function formatMonthlyCost(value: number) {
	return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
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
						Scale cost simulator
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
						{selectedProvider.name} at {TIER_LABELS[idx]} users
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
				max={TIER_LABELS.length - 1}
				step={1}
				onValueChange={([value]) => setIdx(value)}
				className="my-4"
			/>
			<div className="mb-4 flex justify-between text-xs font-bold text-[var(--sea-ink-soft)]">
				{TIER_LABELS.map((label) => (
					<span key={label}>{label}</span>
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
						href="/"
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

			<section className="mt-8">
				<CloudProviderScaleSlider />
			</section>

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
						</button>
					);
				})}
			</div>
		</div>
	);
}
