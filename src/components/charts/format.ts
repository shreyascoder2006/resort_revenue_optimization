export type ChartFormat = "percent" | "currency" | "score" | "days" | "number";

export function formatChartValue(format: ChartFormat, value: number): string {
  switch (format) {
    case "percent":
      return `${value}%`;
    case "currency":
      return `$${value}`;
    case "score":
      return value.toFixed(2);
    case "days":
      return `${value}d`;
    default:
      return `${value}`;
  }
}
