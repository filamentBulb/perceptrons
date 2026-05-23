import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Cloud, CreditCard, DollarSign } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/connect")({ component: App });

const cloudProviders = [
	{ id: "aws", name: "Amazon Web Services (AWS)" },
	{ id: "gcp", name: "Google Cloud Platform (GCP)" },
	{ id: "azure", name: "Microsoft Azure" },
	{ id: "cloudflare", name: "Cloudflare" },
];

const fundingRounds = [
	{ id: "seed", name: "Seed Round", amount: "$500k - $2M" },
	{ id: "series-a", name: "Series A", amount: "$2M - $15M" },
	{ id: "series-b", name: "Series B", amount: "$15M - $50M" },
	{ id: "series-c", name: "Series C+", amount: "$50M+" },
];

function App() {
	const [selectedCloud, setSelectedCloud] = useState("");
	const [selectedStripe, setSelectedStripe] = useState("");
	const [selectedFunding, setSelectedFunding] = useState("");

	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="mb-8 text-center">
				<h1 className="display-title mb-3 text-3xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-4xl">
					AI RUNWAY CFO
				</h1>
				<p className="mb-7 max-w-2xl mx-auto text-base leading-7 text-[var(--sea-ink-soft)] sm:text-lg">
					Forecast your cloud growth and runway
				</p>
			</section>

			<section className="mx-auto max-w-2xl space-y-6">
				{/* Cloud Provider Dropdown */}
				<div className="island-shell rounded-xl p-5">
					<div className="mb-4 flex items-center gap-3">
						<div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
							<Cloud size={20} />
						</div>
						<div>
							<p className="island-kicker mb-0.5">Cloud Infrastructure</p>
							<h2 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
								Select Cloud Provider
							</h2>
						</div>
					</div>
					<div className="relative">
						<select
							value={selectedCloud}
							onChange={(e) => setSelectedCloud(e.target.value)}
							className="w-full appearance-none rounded-lg border border-[var(--line)] bg-white px-4 py-3 pr-10 text-base font-medium text-[var(--sea-ink)] shadow-sm transition-colors hover:border-[var(--sea-ink)] focus:border-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 dark:bg-[var(--surface-strong)] dark:text-white"
						>
							<option value="">Choose a cloud provider...</option>
							{cloudProviders.map((provider) => (
								<option key={provider.id} value={provider.id}>
									{provider.name}
								</option>
							))}
						</select>
						<ChevronDown
							className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
							size={20}
						/>
					</div>
					{selectedCloud && (
						<p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
							✓ {cloudProviders.find((p) => p.id === selectedCloud)?.name} selected
						</p>
					)}
				</div>

				{/* Stripe Dropdown */}
				<div className="island-shell rounded-xl p-5">
					<div className="mb-4 flex items-center gap-3">
						<div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
							<CreditCard size={20} />
						</div>
						<div>
							<p className="island-kicker mb-0.5">Payment Processing</p>
							<h2 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
								Select Stripe Account
							</h2>
						</div>
					</div>
					<div className="relative">
						<select
							value={selectedStripe}
							onChange={(e) => setSelectedStripe(e.target.value)}
							className="w-full appearance-none rounded-lg border border-[var(--line)] bg-white px-4 py-3 pr-10 text-base font-medium text-[var(--sea-ink)] shadow-sm transition-colors hover:border-[var(--sea-ink)] focus:border-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 dark:bg-[var(--surface-strong)] dark:text-white"
						>
							<option value="">Choose Stripe account type...</option>
							<option value="live">Live Account (Production)</option>
							<option value="test">Test Account (Development)</option>
						</select>
						<ChevronDown
							className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
							size={20}
						/>
					</div>
					{selectedStripe && (
						<p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
							✓ {selectedStripe === "live" ? "Live Account" : "Test Account"} selected
						</p>
					)}
				</div>

				{/* Funding/Capital Raised Dropdown */}
				<div className="island-shell rounded-xl p-5">
					<div className="mb-4 flex items-center gap-3">
						<div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--sea-ink)] text-white">
							<DollarSign size={20} />
						</div>
						<div>
							<p className="island-kicker mb-0.5">Funding</p>
							<h2 className="m-0 text-lg font-extrabold text-[var(--sea-ink)]">
								Capital Raised
							</h2>
						</div>
					</div>
					<div className="relative">
						<select
							value={selectedFunding}
							onChange={(e) => setSelectedFunding(e.target.value)}
							className="w-full appearance-none rounded-lg border border-[var(--line)] bg-white px-4 py-3 pr-10 text-base font-medium text-[var(--sea-ink)] shadow-sm transition-colors hover:border-[var(--sea-ink)] focus:border-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 dark:bg-[var(--surface-strong)] dark:text-white"
						>
							<option value="">Select funding stage...</option>
							{fundingRounds.map((round) => (
								<option key={round.id} value={round.id}>
									{round.name} ({round.amount})
								</option>
							))}
						</select>
						<ChevronDown
							className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
							size={20}
						/>
					</div>
					{selectedFunding && (
						<p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
							✓ {fundingRounds.find((r) => r.id === selectedFunding)?.name} selected
						</p>
					)}
				</div>

				{/* Continue Button */}
				<div className="pt-4 text-center">
					<a
						href="/"
						className={`inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-base font-extrabold no-underline shadow-lg transition-all ${
							selectedCloud && selectedStripe && selectedFunding
								? "border-[rgba(23,58,64,0.18)] bg-[var(--sea-ink)] text-white hover:scale-105 hover:text-white"
								: "cursor-not-allowed border-[var(--line)] bg-slate-200 text-slate-500 dark:bg-slate-700"
						}`}
					>
						Continue to Dashboard
						<ArrowRight size={20} />
					</a>
					{(!selectedCloud || !selectedStripe || !selectedFunding) && (
						<p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
							Please select all options to continue
						</p>
					)}
				</div>
			</section>
		</main>
	);
}
