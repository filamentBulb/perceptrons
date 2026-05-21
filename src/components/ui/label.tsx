import type * as React from "react";
import { cn } from "#/lib/utils";

export function Label({
	className,
	...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: callers provide htmlFor when the label is associated with a form control
		<label
			className={cn("block text-sm font-bold text-[var(--sea-ink)]", className)}
			{...props}
		/>
	);
}
