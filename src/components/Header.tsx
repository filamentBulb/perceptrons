import { Link } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import { hasRequiredForecastSources, runwayStore } from "../lib/runway-store";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	const connectedSourceIds = useStore(
		runwayStore,
		(state) => state.connectedSourceIds,
	);
	const [showConnectToast, setShowConnectToast] = useState(false);
	const canOpenAiCfo = hasRequiredForecastSources(connectedSourceIds);

	useEffect(() => {
		if (!showConnectToast) return;

		const timeoutId = window.setTimeout(() => {
			setShowConnectToast(false);
		}, 2600);

		return () => window.clearTimeout(timeoutId);
	}, [showConnectToast]);

	return (
		<header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
			<nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
				<h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
					>
						<span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
						Runway AI CFO
					</Link>
				</h2>

				<div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
					<Link
						to="/"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Home
					</Link>
					<Link
						to="/"
						hash="ai-cfo"
						className="nav-link"
						onClick={(event) => {
							if (canOpenAiCfo) return;

							event.preventDefault();
							setShowConnectToast(true);
						}}
					>
						AI CFO
					</Link>
				</div>

				<div className="ml-auto flex items-center gap-1.5 sm:gap-2">
					<ThemeToggle />
				</div>
			</nav>
			{showConnectToast ? (
				<div className="fixed right-4 top-20 z-[90] max-w-sm rounded-lg border border-amber-500/30 bg-amber-100 px-4 py-3 text-sm font-extrabold text-amber-950 shadow-xl dark:bg-amber-900 dark:text-amber-50">
					Connect at least one cloud provider and one bank source first.
				</div>
			) : null}
		</header>
	);
}
