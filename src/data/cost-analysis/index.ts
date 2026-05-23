import rawData from "./aws-cost-analysis.json";

type SummaryStage = {
	stage: string;
	monthlyUsd: number;
	annualUsd: number;
};

export type AwsCostMeta = {
	generated: string;
	region: string;
	pricingSource: string;
};

export const awsCostStageSummary: SummaryStage[] = rawData.summary.stages;

export const awsCostAnalysisMeta: AwsCostMeta = {
	generated: rawData.meta.generated,
	region: rawData.meta.region,
	pricingSource: rawData.meta.pricingSource,
};
