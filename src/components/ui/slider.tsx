import type * as React from "react";
import { cn } from "#/lib/utils";

type SliderProps = Omit<
	React.InputHTMLAttributes<HTMLInputElement>,
	"type" | "value" | "onChange"
> & {
	value?: number[];
	onValueChange?: (value: number[]) => void;
};

export function Slider({
	className,
	value = [0],
	onValueChange,
	min = 0,
	max = 100,
	step = 1,
	...props
}: SliderProps) {
	return (
		<input
			className={cn("w-full accent-[var(--lagoon-deep)]", className)}
			max={max}
			min={min}
			onChange={(event) => onValueChange?.([Number(event.target.value)])}
			step={step}
			type="range"
			value={value[0] ?? 0}
			{...props}
		/>
	);
}
