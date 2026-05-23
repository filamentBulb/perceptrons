import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Slider } from "#/components/ui/slider";
import {
	cloudPricingEstimate,
	cloudPricingProviderTotals,
} from "#/data/cloud-pricing";
import {
	latestStartupSnapshot,
	startupDashboardData,
	startupDataset,
} from "#/data/startup-dataset";

export const Route = createFileRoute("/scale-cost-simulator")({
	component: App,
});

const CLOUD_PROVIDER_IDS = ["aws", "gcp", "azure", "cloudflare"] as const;
type CloudProviderId = (typeof CLOUD_PROVIDER_IDS)[number];

type ScaleTier = {
	users: number;
	dau: number;
	concurrent: number;
	total: number;
	cloudTotal: number;
	aiTokenTotal: number;
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
const currentAiTokenSpend = startupDashboardData.aiTokenUsage.totalCostUsd;
const ONE_MILLION_USERS = 1000000;
const CLOUD_PRICING_REFERENCE_USERS = 100000;
const PRODUCTION_HEADROOM_MULTIPLIER = 2.5;
const CLOUD_SCALE_EXPONENT = 0.85;
const publicCloudBaseline =
	cloudPricingEstimate.summary.currentMonthlyCost *
	PRODUCTION_HEADROOM_MULTIPLIER;
const publicCloudProviderTotal = cloudPricingProviderTotals.reduce(
	(sum, provider) => sum + provider.monthlyCostUsd,
	0,
);
const edpDiscountScenarios = [
	{ stage: "EDP Conservative 15%", discount: 0.15 },
	{ stage: "EDP Mid 25%", discount: 0.25 },
	{ stage: "EDP Aggressive 35%", discount: 0.35 },
];

function App() {
	const [users, setUsers] = useState<number>(currentUsers);
	const tier = makeScaleTier(users);

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="mb-8">
				<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div>
						<p className="island-kicker mb-2">What-if model</p>
						<h1 className="display-title m-0 text-3xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-5xl">
							Scale Cost Simulator
						</h1>
					</div>
				</div>
			</section>

			<ScaleCostSimulator tier={tier} users={users} onUsersChange={setUsers} />

			{users >= ONE_MILLION_USERS ? (
				<section className="mt-8">
					<AwsCostScenarios monthlyCost={tier.total} />
				</section>
			) : null}
		</main>
	);
}

function ScaleCostSimulator({
	tier,
	users,
	onUsersChange,
}: {
	tier: ScaleTier;
	users: number;
	onUsersChange: (users: number) => void;
}) {
	const comparisonTotals = CLOUD_PROVIDER_IDS.map((providerId) => {
		const provider = CLOUD_SCALE_MODELS[providerId];
		const publicProviderTotal = cloudPricingProviderTotals.find(
			(total) => total.id === providerId,
		)?.monthlyCostUsd;
		const allocation =
			publicCloudProviderTotal > 0 && typeof publicProviderTotal === "number"
				? publicProviderTotal / publicCloudProviderTotal
				: provider.allocation;

		return {
			id: providerId,
			name: provider.name,
			colorClass: provider.colorClass,
			total: Math.round(tier.cloudTotal * allocation),
		};
	});

	return (
		<div className="island-shell rounded-2xl p-4 sm:p-6">
			<div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
				<div>
					<p className="island-kicker mb-2">What-if / cloud providers</p>
					<h2 className="m-0 text-xl font-extrabold text-[var(--sea-ink)]">
						Cloud and AI cost at scale
					</h2>
				</div>
				<div className="rounded-lg border border-[var(--line)] bg-white/50 px-3 py-2 text-sm font-bold text-[var(--sea-ink)] dark:bg-white/5">
					Current MAU: {currentUsers.toLocaleString()}
				</div>
			</div>

			<div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
				<div className="rounded-xl border border-[var(--line)] bg-white/50 p-4 dark:bg-white/5">
					<p className="m-0 text-sm font-bold text-[var(--sea-ink-soft)]">
						Cloud and AI vendors at {tier.users.toLocaleString()} users
					</p>
					<div className="mt-1 text-4xl font-extrabold text-[var(--sea-ink)]">
						${formatMonthlyCost(tier.total)}/mo
					</div>
					<div className="mt-2 flex flex-wrap gap-2 text-xs font-extrabold">
						<span className="rounded-lg border border-[var(--line)] bg-white/60 px-2 py-1 text-[var(--sea-ink)] dark:bg-white/10">
							Cloud ${formatMonthlyCost(tier.cloudTotal)}
						</span>
						<span className="rounded-lg border border-[var(--line)] bg-white/60 px-2 py-1 text-[var(--sea-ink)] dark:bg-white/10">
							AI ${formatMonthlyCost(tier.aiTokenTotal)}
						</span>
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
				onValueChange={([value]) => onUsersChange(value)}
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

function makeScaleTier(users: number): ScaleTier {
	const normalizedUsers = Math.max(100, users);
	const cloudScaleRatio = normalizedUsers / CLOUD_PRICING_REFERENCE_USERS;
	const aiScaleRatio = normalizedUsers / currentUsers;
	const cloudTotal = Math.round(
		publicCloudBaseline * cloudScaleRatio ** CLOUD_SCALE_EXPONENT,
	);
	const aiTokenTotal = Math.round(currentAiTokenSpend * aiScaleRatio ** 1.08);
	const total = cloudTotal + aiTokenTotal;

	return {
		users: normalizedUsers,
		dau: Math.round(
			normalizedUsers *
				(startupDataset.productMetrics.dau / startupDataset.productMetrics.mau),
		),
		concurrent: Math.max(1, Math.round(normalizedUsers * 0.005)),
		total,
		cloudTotal,
		aiTokenTotal,
		note:
			normalizedUsers === currentUsers
				? "public cloud baseline plus production headroom"
				: "cloud uses public-pricing scale; AI tokens scale slightly faster",
		breakdown: splitScaleCost(cloudTotal, aiTokenTotal),
	};
}

function splitScaleCost(cloudTotal: number, aiTokenTotal: number) {
	const cloudRows = cloudPricingProviderTotals.map((provider) => ({
		key: provider.id,
		label: provider.label,
		currentCost: provider.monthlyCostUsd,
	}));
	const cloudBreakdown = cloudRows.map((provider, index) => {
		const isLast = index === cloudRows.length - 1;
		const allocatedCost = isLast
			? cloudTotal -
				cloudRows
					.slice(0, -1)
					.reduce(
						(sum, row) =>
							sum +
							Math.round(
								cloudTotal *
									(row.currentCost / Math.max(publicCloudProviderTotal, 1)),
							),
						0,
					)
			: Math.round(
					cloudTotal *
						(provider.currentCost / Math.max(publicCloudProviderTotal, 1)),
				);

		return {
			label: provider.label,
			cost: allocatedCost,
		};
	});

	const aiBreakdown = startupDashboardData.aiTokenUsage.services.map(
		(service) => ({
			label: service.name,
			cost: Math.round(aiTokenTotal * (service.costUsd / currentAiTokenSpend)),
		}),
	);

	return [...cloudBreakdown, ...aiBreakdown];
}

function formatMonthlyCost(value: number) {
	return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

const STAGE_COLORS: Record<number, string> = {
	0: "border-emerald-500/20 bg-emerald-500/5",
	1: "border-emerald-500/30 bg-emerald-500/10",
	2: "border-emerald-600/40 bg-emerald-500/15",
};

function formatUsd(n: number) {
	if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
	return `$${n.toFixed(0)}`;
}

function AwsCostScenarios({ monthlyCost }: { monthlyCost: number }) {
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
					Based on the simulator&apos;s {ONE_MILLION_USERS.toLocaleString()}{" "}
					user monthly cost.
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-3">
				{edpDiscountScenarios.map((scenario, i) => {
					const discountedMonthlyCost = monthlyCost * (1 - scenario.discount);

					return (
						<div
							key={scenario.stage}
							className={`rounded-xl border p-4 ${STAGE_COLORS[i] ?? STAGE_COLORS[0]}`}
						>
							<p className="island-kicker mb-2 text-[10px]">{scenario.stage}</p>
							<p className="m-0 text-2xl font-extrabold text-[var(--sea-ink)]">
								{formatUsd(discountedMonthlyCost)}
							</p>
							<p className="m-0 text-xs text-[var(--sea-ink-soft)]">/mo</p>
							<p className="m-0 mt-2 text-xs font-bold text-[var(--sea-ink-soft)]">
								{formatUsd(discountedMonthlyCost * 12)} / yr
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
