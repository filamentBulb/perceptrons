import type * as React from "react";
import { cn } from "#/lib/utils";

export function Textarea({
	className,
	...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(
				"w-full rounded-lg border border-[var(--line)] bg-white/75 px-3 py-2 text-[var(--sea-ink)] outline-none transition placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon-deep)] dark:bg-white/10",
				className,
			)}
			{...props}
		/>
	);
}
