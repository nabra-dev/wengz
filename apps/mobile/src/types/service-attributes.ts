export type AttributeType =
  | "text"
  | "select"
  | "multiselect"
  | "textarea"
  | "number"
  | "file"
  | "voice";

export type AttributeOptionWithCost = {
  value: string;
  creditCost?: number;
  labelI18n?: Record<string, string>;
};

export type ServiceAttribute = {
  question: string;
  questionI18n?: Record<string, string>;
  required: boolean;
  type: AttributeType;
  options?: string[];
  optionsWithCost?: AttributeOptionWithCost[];
  placeholder?: string;
  placeholderI18n?: Record<string, string>;
  helpText?: string;
  helpTextI18n?: Record<string, string>;
  min?: number;
  max?: number;
  creditImpact?: number;
  includedQuantity?: number;
  maxFiles?: number;
  maxSizeMB?: number;
};

export type AttributeResponse = {
  question: string;
  answer: string | string[];
};

function getOptionCost(attribute: ServiceAttribute, value: string): number | null {
  const option = attribute.optionsWithCost?.find((o) => o.value === value);
  if (option) return option.creditCost ?? 0;
  if (attribute.creditImpact) {
    const numericValue = Number.parseFloat(value);
    if (!Number.isNaN(numericValue)) return numericValue * attribute.creditImpact;
  }
  return attribute.creditImpact ?? null;
}

function calculateSingleAttributeCredits(
  attribute: ServiceAttribute,
  answer: string | string[]
): number {
  if (attribute.type === "file" || attribute.type === "voice") return 0;
  if (attribute.type === "select") {
    const optionCost = getOptionCost(attribute, answer as string);
    if (optionCost !== null) return optionCost;
  }
  if (attribute.type === "multiselect") {
    if (!Array.isArray(answer)) return 0;
    return answer
      .map((val) => getOptionCost(attribute, val))
      .filter((c): c is number => c !== null)
      .reduce((sum, c) => sum + c, 0);
  }
  if (Array.isArray(answer)) return 0;
  const numericValue = Number.parseFloat(answer);
  if (Number.isNaN(numericValue)) return 0;
  const creditImpact = attribute.creditImpact || 0;
  if (attribute.includedQuantity !== undefined) {
    return Math.max(0, numericValue - attribute.includedQuantity) * creditImpact;
  }
  return creditImpact * numericValue;
}

export function calculateAttributeCredits(
  attributes: ServiceAttribute[],
  responses: AttributeResponse[]
): number {
  if (!attributes?.length || !responses?.length) return 0;
  const responseMap = new Map(responses.map((r) => [r.question, r.answer]));
  let total = 0;
  for (const attribute of attributes) {
    const answer = responseMap.get(attribute.question);
    if (!answer) continue;
    total += calculateSingleAttributeCredits(attribute, answer);
  }
  return total;
}

export function localizedAttrText(
  base: string | undefined,
  i18nMap: Record<string, string> | undefined,
  locale: string
): string {
  return i18nMap?.[locale] || i18nMap?.en || base || "";
}
