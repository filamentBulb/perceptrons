import {
	createContext,
	type HTMLAttributes,
	type ReactNode,
	useContext,
	useState,
} from "react";
import { cn } from "#/lib/utils";

type SelectContextValue = {
	value: string;
	onValueChange?: (value: string) => void;
};

const SelectContext = createContext<SelectContextValue>({
	value: "",
});

export function Select({
	value,
	onValueChange,
	children,
}: {
	name?: string;
	value: string;
	onValueChange?: (value: string) => void;
	children: ReactNode;
}) {
	return (
		<SelectContext.Provider value={{ value, onValueChange }}>
			<div className="relative">{children}</div>
		</SelectContext.Provider>
	);
}

export function SelectTrigger({
	className,
	children,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"rounded-lg border border-[var(--line)] bg-white/75 px-3 py-2 text-[var(--sea-ink)] dark:bg-white/10",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
	const { value } = useContext(SelectContext);
	return <span>{value || placeholder}</span>;
}

export function SelectContent({
	className,
	children,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-2",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function SelectGroup({ children }: { children: ReactNode }) {
	return <div className="space-y-1">{children}</div>;
}

export function SelectLabel({ children }: { children: ReactNode }) {
	return (
		<div className="px-2 py-1 text-xs font-extrabold uppercase text-[var(--kicker)]">
			{children}
		</div>
	);
}

export function SelectItem({
	value,
	className,
	children,
}: {
	value: string;
	className?: string;
	children: ReactNode;
}) {
	const { onValueChange } = useContext(SelectContext);
	const [isSelected, setIsSelected] = useState(false);

	return (
		<button
			className={cn(
				"block w-full rounded-md px-2 py-1.5 text-left text-sm font-bold hover:bg-[var(--link-bg-hover)]",
				isSelected && "bg-[rgba(79,184,178,0.16)]",
				className,
			)}
			onClick={() => {
				setIsSelected(true);
				onValueChange?.(value);
			}}
			type="button"
		>
			{children}
		</button>
	);
}
