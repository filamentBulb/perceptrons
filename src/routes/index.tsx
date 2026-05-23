import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import {
	ArrowRight,
	Check,
	Cloud,
	CreditCard,
	ExternalLink,
	Landmark,
	Loader2,
	Server,
	ShieldCheck,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { connectRunwaySource, runwayStore } from "../lib/runway-store";

export const Route = createFileRoute("/")({
	component: ConnectSources,
});

type Integration = {
	id: string;
	name: string;
	category: "Cloud" | "Revenue" | "Banking";
	detail: string;
	authLabel: string;
	icon: typeof Cloud;
	scopes: string[];
	summary: string;
	stats: Array<[string, string]>;
	services: Array<[string, string, string]>;
};

const integrations: Integration[] = [
	{
		id: "aws",
		name: "Amazon Web Services",
		category: "Cloud",
		detail: "EC2, ECS Fargate, CloudWatch Logs, S3, ALB public prices",
		authLabel: "AWS Price List Bulk API",
		icon: Cloud,
		scopes: [
			"AmazonEC2",
			"AmazonECS",
			"AmazonCloudWatch",
			"AmazonS3",
			"AWSELB",
		],
		summary: "AWS pricing uses public regional price list JSON files.",
		stats: [
			["Monthly spend", "$42,380"],
			["Projected growth", "+22%"],
			["Optimization", "$9,800"],
		],
		services: [
			["EC2 instances", "12", "$14,800/mo"],
			["ECS services", "9", "$9,600/mo"],
			["Amplify apps", "3", "$1,900/mo"],
			["RDS databases", "4", "$8,700/mo"],
			["S3/data transfer", "21 TB", "$7,380/mo"],
		],
	},
	{
		id: "gcp",
		name: "Google Cloud Platform",
		category: "Cloud",
		detail:
			"Compute Engine, Cloud Run, Cloud Logging, Cloud Storage, Load Balancing",
		authLabel: "Cloud Billing Catalog API",
		icon: Cloud,
		scopes: ["Compute Engine", "Cloud Run", "Cloud Logging", "Cloud Storage"],
		summary: "GCP pricing uses public billing catalogue SKUs where available.",
		stats: [
			["Monthly spend", "$21,640"],
			["API calls", "18.4M"],
			["Projected growth", "+27%"],
		],
		services: [
			["Compute Engine VPS", "7", "$7,900/mo"],
			["Cloud Run services", "11", "$5,200/mo"],
			["Vertex AI jobs", "4", "$4,850/mo"],
			["API Gateway", "18.4M calls", "$2,110/mo"],
			["BigQuery", "9.2 TB", "$1,580/mo"],
		],
	},
	{
		id: "azure",
		name: "Microsoft Azure",
		category: "Cloud",
		detail: "VMs, AKS node VMs, Log Analytics, Blob Storage, App Gateway",
		authLabel: "Azure Retail Prices API",
		icon: Cloud,
		scopes: [
			"Virtual Machines",
			"Azure Monitor",
			"Storage",
			"Application Gateway",
		],
		summary: "Azure pricing uses the unauthenticated retail prices API.",
		stats: [
			["Region", "Germany West Central"],
			["Default VM", "D2s v5"],
			["Source", "Retail API"],
		],
		services: [
			["Virtual Machines", "D2s v5", "public hourly rate"],
			["AKS", "node VM cost", "derived from VM SKU"],
			["Log Analytics", "ingest + retention", "public unit rate"],
			["Blob Storage", "Hot LRS", "public GB-month rate"],
			["Application Gateway", "Standard v2", "public hourly rate"],
		],
	},
	{
		id: "cloudflare",
		name: "Cloudflare",
		category: "Cloud",
		detail: "Workers, Workers Logpush, R2, and included load balancing model",
		authLabel: "Cloudflare pricing docs",
		icon: Zap,
		scopes: ["Workers", "Workers Logpush", "R2", "Load Balancing"],
		summary:
			"Cloudflare pricing is parsed from official pricing documentation.",
		stats: [
			["Monthly spend", "$7,180"],
			["Bandwidth", "42 TB"],
			["Cache hit rate", "82%"],
		],
		services: [
			["CDN bandwidth", "42 TB", "$2,300/mo"],
			["Workers", "96M req", "$3,240/mo"],
			["Images", "1.8M variants", "$910/mo"],
			["R2 storage", "8 TB", "$730/mo"],
		],
	},
	{
		id: "stripe",
		name: "Stripe",
		category: "Revenue",
		detail: "Subscriptions, usage charges, payouts, refunds, fees",
		authLabel: "Stripe Connect",
		icon: CreditCard,
		scopes: ["Balance", "Charges", "Payouts", "Refunds"],
		summary: "Stripe shows growth, payout lag, refunds, and processing fees.",
		stats: [
			["Money received", "$137,240"],
			["Money out", "$31,760"],
			["Net Stripe cash", "$105,480"],
		],
		services: [
			["Subscription revenue", "2,184 paid", "$104,600 in"],
			["Usage charges", "41,220 events", "$32,640 in"],
			["Pending payouts", "5.6 days", "$22,400 held"],
			["Fees/refunds", "2.8% fees", "$9,360 out"],
		],
	},
	{
		id: "banking",
		name: "Open Banking",
		category: "Banking",
		detail: "Operating balance, vendor payments, payroll, cash reserve",
		authLabel: "Open Banking consent",
		icon: Landmark,
		scopes: [
			"Operating balance",
			"Vendor payments",
			"Payroll",
			"Cash reserves",
		],
		summary: "Bank data confirms outgoing cash and runway pressure.",
		stats: [
			["Bank balance", "$410,000"],
			["Monthly out", "$203,600"],
			["Runway", "7.2 mo"],
		],
		services: [
			["Payroll", "22 people", "$102,000 out"],
			["Cloud vendors", "5 vendors", "$66,000 out"],
			["Tools and APIs", "28 vendors", "$35,600 out"],
			["Cash reserve", "Target", "$120,000 min"],
		],
	},
];

function ForecastLink({ enabled }: { enabled: boolean }) {
	if (!enabled) {
		return (
			<div>
				<button
					className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-[var(--line)] bg-slate-200 px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-[0_10px_24px_rgba(23,58,64,0.08)] dark:bg-slate-700 dark:text-white"
					disabled
					type="button"
				>
					Open live forecasts
					<ArrowRight size={16} />
				</button>
				<p className="m-0 mt-2 text-xs font-bold text-[var(--sea-ink-soft)]">
					Select at least one public pricing source.
				</p>
			</div>
		);
	}

	return (
		<a
			className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgba(23,58,64,0.18)] bg-[var(--sea-ink)] px-4 py-2.5 text-sm font-extrabold text-white no-underline shadow-[0_18px_34px_rgba(23,58,64,0.18)]"
			href="/dashboard"
		>
			Open public-price forecasts
			<ArrowRight size={16} />
		</a>
	);
}

function ConnectSources() {
	const connected = useStore(runwayStore, (state) => state.connectedSourceIds);
	const [active, setActive] = useState<Integration | null>(null);
	const [step, setStep] = useState(0);

	const connectedIntegrations = integrations.filter((integration) =>
		connected.includes(integration.id),
	);
	const hasConnectedCloud = connectedIntegrations.some(
		(integration) => integration.category === "Cloud",
	);
	const canOpenForecasts = hasConnectedCloud;

	const openModal = (integration: Integration) => {
		if (connected.includes(integration.id)) return;
		setActive(integration);
		setStep(0);
	};

	const advance = () => {
		if (!active) return;
		if (step < 2) {
			setStep((current) => current + 1);
			return;
		}
		connectRunwaySource(active.id);
		setActive(null);
		setStep(0);
	};

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="mb-10">
				<p className="island-kicker mb-3">Public pricing setup</p>
				<h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-6xl">
					Choose public cloud pricing sources.
				</h1>
				<p className="mb-7 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)] sm:text-lg">
					Use official retail pricing APIs and docs to prepare a hypothetical
					cloud budget forecast. No provider account credentials are needed.
				</p>
				<ForecastLink enabled={canOpenForecasts} />
			</section>

			<section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{integrations.map((integration) => {
					const Icon = integration.icon;
					const isConnected = connected.includes(integration.id);

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
							{isConnected ? <SyncedPreview integration={integration} /> : null}
							<button
								className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-extrabold text-[var(--sea-ink)] hover:-translate-y-0.5 disabled:cursor-default disabled:border-emerald-600 disabled:bg-emerald-100 disabled:text-emerald-900 disabled:hover:translate-y-0 dark:disabled:border-emerald-400 dark:disabled:bg-emerald-900 dark:disabled:text-emerald-50"
								disabled={isConnected}
								onClick={() => openModal(integration)}
								type="button"
							>
								{isConnected ? "Selected" : "Select"}
							</button>
						</article>
					);
				})}
			</section>

			{active ? (
				<ConnectionModal
					integration={active}
					onAdvance={advance}
					onClose={() => setActive(null)}
					step={step}
				/>
			) : null}
		</main>
	);
}

function SyncedPreview({ integration }: { integration: Integration }) {
	return (
		<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
			<p className="m-0 text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-200">
				Pricing source selected
			</p>
			<p className="m-0 mt-1 text-sm font-bold text-[var(--sea-ink)]">
				{integration.summary}
			</p>
		</div>
	);
}

function ConnectionModal({
	integration,
	step,
	onAdvance,
	onClose,
}: {
	integration: Integration;
	step: number;
	onAdvance: () => void;
	onClose: () => void;
}) {
	const Icon = integration.icon;
	const [syncReady, setSyncReady] = useState(step !== 2);
	const steps = [
		{
			title: `Select ${integration.name}`,
			body: "Use the official public pricing source for this provider.",
			action: "Use pricing source",
		},
		{
			title: integration.authLabel,
			body: "Review the public service families included in this estimate.",
			action: "Confirm source",
		},
		{
			title: "Loading pricing model",
			body: "Applying the generated retail-price JSON to the forecast context.",
			action: `Select ${integration.name}`,
		},
	];
	const current = steps[step];
	const isFinalSyncStep = step === 2;
	const isButtonDisabled = isFinalSyncStep && !syncReady;

	useEffect(() => {
		if (!isFinalSyncStep) {
			setSyncReady(true);
			return;
		}

		setSyncReady(false);
		const timeoutId = window.setTimeout(() => setSyncReady(true), 1000);

		return () => window.clearTimeout(timeoutId);
	}, [isFinalSyncStep]);

	return (
		<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
			<div className="w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-5">
				<div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
					<div className="flex gap-3">
						<div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
							<Icon size={21} />
						</div>
						<div>
							<p className="island-kicker mb-1">Pricing source</p>
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
								Included pricing families
							</p>
							<ul className="m-0 mt-2 space-y-2 p-0">
								{integration.scopes.map((scope) => (
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
							className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-950 bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)] hover:-translate-y-0.5 disabled:cursor-wait disabled:border-slate-400 disabled:bg-slate-300 disabled:text-slate-700 disabled:hover:translate-y-0 dark:border-white dark:bg-white dark:text-slate-950 dark:disabled:border-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-white"
							disabled={isButtonDisabled}
							onClick={onAdvance}
							type="button"
						>
							{isButtonDisabled ? (
								<Loader2 className="animate-spin" size={16} />
							) : (
								<ExternalLink size={16} />
							)}
							{isButtonDisabled ? "Loading pricing data..." : current.action}
						</button>
					</div>

					<div className="rounded-xl border border-[var(--line)] bg-slate-950 p-4 text-white">
						<p className="m-0 text-xs font-extrabold uppercase tracking-widest text-emerald-300">
							Preview cloud data
						</p>
						<h3 className="mb-4 mt-2 text-lg font-extrabold">
							{integration.summary}
						</h3>
						{isFinalSyncStep ? (
							<>
								<div className="mb-4 grid gap-2 sm:grid-cols-3">
									{integration.stats.map(([label, value]) => (
										<div className="rounded-lg bg-white/10 p-3" key={label}>
											<p className="m-0 text-xs text-slate-300">{label}</p>
											<p className="m-0 mt-1 text-lg font-extrabold">{value}</p>
										</div>
									))}
								</div>
								<div className="space-y-2">
									{integration.services
										.slice(0, 4)
										.map(([name, count, spend]) => (
											<div
												className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
												key={name}
											>
												<div className="flex items-center gap-2">
													<Server size={15} />
													<span className="text-sm font-bold">{name}</span>
												</div>
												<span className="text-right text-sm font-extrabold text-emerald-300">
													{count} · {spend}
												</span>
											</div>
										))}
								</div>
							</>
						) : (
							<div className="grid min-h-[280px] place-items-center rounded-lg border border-white/10 bg-white/5 p-5 text-center">
								<div>
									<ShieldCheck
										className="mx-auto mb-3 text-emerald-300"
										size={28}
									/>
									<p className="m-0 text-xs font-extrabold uppercase tracking-widest text-emerald-300">
										Preview locked
									</p>
									<p className="m-0 mt-2 text-sm leading-6 text-slate-300">
										Imported provider data is shown only after authorization is
										approved and the final sync step starts.
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
