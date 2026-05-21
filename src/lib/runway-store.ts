import { Store } from "@tanstack/store";

type RunwayState = {
	connectedSourceIds: string[];
};

const STORAGE_KEY = "runway-ai-cfo-state";

function readInitialState(): RunwayState {
	if (typeof window === "undefined") {
		return { connectedSourceIds: [] };
	}

	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return { connectedSourceIds: [] };
		}

		const parsed = JSON.parse(stored) as Partial<RunwayState>;
		return {
			connectedSourceIds: Array.isArray(parsed.connectedSourceIds)
				? parsed.connectedSourceIds.filter(
						(sourceId): sourceId is string => typeof sourceId === "string",
					)
				: [],
		};
	} catch {
		return { connectedSourceIds: [] };
	}
}

export const runwayStore = new Store<RunwayState>(readInitialState());

export function connectRunwaySource(sourceId: string) {
	runwayStore.setState((state) => {
		if (state.connectedSourceIds.includes(sourceId)) {
			return state;
		}

		return {
			...state,
			connectedSourceIds: [...state.connectedSourceIds, sourceId],
		};
	});
}

runwayStore.subscribe(() => {
	if (typeof window === "undefined") return;

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runwayStore.state));
});
