import type * as React from "react";
import { cn } from "#/lib/utils";

type SwitchProps = Omit<
	React.ButtonHTMLAttributes<HTMLButtonElement>,
	"onChange"
> & {
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
};

export function Switch({
	className,
	checked = false,
	onCheckedChange,
	...props
}: SwitchProps) {
	return (
		<button
			aria-checked={checked}
			className={cn(
				"relative h-6 w-11 rounded-full border border-[var(--line)] transition",
				checked ? "bg-[var(--lagoon-deep)]" : "bg-slate-300",
				className,
			)}
			onClick={() => onCheckedChange?.(!checked)}
			role="switch"
			type="button"
			{...props}
		>
			<span
				className={cn(
					"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
					checked ? "left-5" : "left-0.5",
				)}
			/>
		</button>
	);
}
