import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<main className="page-wrap px-4 pb-8 pt-8">
			<section className="rise-in flex min-h-[60vh] flex-col items-center justify-center text-center">
				<h1 className="display-title mb-3 max-w-4xl text-4xl leading-[1.02] font-bold text-[var(--sea-ink)] sm:text-6xl">
					AI RUNWAY CFO
				</h1>
				<p className="mb-7 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)] sm:text-lg">
					Forecast your cloud growth and runway
				</p>
				<div className="flex flex-wrap gap-3">
					<a
						href="/connect"
						className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-bold text-[var(--sea-ink)] no-underline hover:-translate-y-0.5"
					>
						Connect Providers
						<ArrowRight size={16} />
					</a>
				</div>
			</section>
		</main>
	);
}
