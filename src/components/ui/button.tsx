import type * as React from "react";
import { cn } from "#/lib/utils";

export function Button({
	className,
	type = "button",
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--sea-ink)] px-4 py-2 text-sm font-extrabold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60",
				className,
			)}
			type={type}
			{...props}
		/>
	);
}
