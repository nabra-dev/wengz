/**
 * Service Attributes Validation Utilities
 * Helper functions to validate client responses against service Q&A attributes
 */

import {
  ServiceAttribute,
  AttributeResponse,
  resolveAttributeMaxFiles,
} from "@/types/service-attributes";
import { isAllowedUploadUrl } from "@/lib/upload-url";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type ValidateAttributeOptions = {
  /** Required to validate file/voice upload URLs belong to this user */
  userId?: string;
};

/**
 * Validates client responses against service attributes
 */
export function validateAttributeResponses(
  attributes: ServiceAttribute[],
  responses: AttributeResponse[],
  options?: ValidateAttributeOptions
): ValidationResult {
  if (!attributes || attributes.length === 0) {
    return { valid: true, errors: [] };
  }

  const responseMap = new Map(responses.map((r) => [r.question, r.answer]));

  const errors = attributes
    .map((attribute) => validateSingleAttribute(attribute, responseMap, options))
    .filter((error): error is string => error !== null);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Collects upload URLs from file/voice attribute answers for ACL checks.
 */
export function collectAttributeMediaUrls(
  attributes: ServiceAttribute[] | null | undefined,
  responses: AttributeResponse[] | null | undefined
): string[] {
  if (!attributes?.length || !responses?.length) return [];
  const mediaQuestions = new Set(
    attributes.filter((a) => a.type === "file" || a.type === "voice").map((a) => a.question)
  );
  const urls: string[] = [];
  for (const response of responses) {
    if (!mediaQuestions.has(response.question)) continue;
    if (Array.isArray(response.answer)) {
      urls.push(...response.answer.filter((u) => typeof u === "string" && u.trim()));
    } else if (typeof response.answer === "string" && response.answer.trim()) {
      urls.push(response.answer.trim());
    }
  }
  return urls;
}

function validateSingleAttribute(
  attribute: ServiceAttribute,
  responseMap: Map<string, string | string[]>,
  options?: ValidateAttributeOptions
): string | null {
  const answer = responseMap.get(attribute.question);

  if (isRequiredFieldMissing(attribute, answer)) {
    return `"${attribute.question}" is required`;
  }

  if (!answer) return null;
  if (Array.isArray(answer) && answer.length === 0) return null;
  if (typeof answer === "string" && answer.trim() === "") return null;

  return validateByType(attribute, answer, options);
}

function isRequiredFieldMissing(
  attribute: ServiceAttribute,
  answer: string | string[] | undefined
): boolean {
  if (!attribute.required) return false;
  if (!answer) return true;
  if (Array.isArray(answer) && answer.length === 0) return true;
  if (typeof answer === "string" && answer.trim() === "") return true;
  return false;
}

function validateByType(
  attribute: ServiceAttribute,
  answer: string | string[],
  options?: ValidateAttributeOptions
): string | null {
  switch (attribute.type) {
    case "select":
      return validateSelectType(attribute, answer);
    case "multiselect":
      return validateMultiselectType(attribute, answer);
    case "number":
      return validateNumberType(attribute, answer);
    case "text":
    case "textarea":
      return validateTextType(attribute, answer);
    case "file":
    case "voice":
      return validateMediaType(attribute, answer, options);
    default:
      return null;
  }
}

function validateSelectType(attribute: ServiceAttribute, answer: string | string[]): string | null {
  const allowedOptions = attribute.optionsWithCost?.map((o) => o.value) ?? attribute.options;
  if (allowedOptions && !allowedOptions.includes(answer as string)) {
    return `"${attribute.question}" must be one of: ${allowedOptions.join(", ")}`;
  }
  return null;
}

function validateMultiselectType(
  attribute: ServiceAttribute,
  answer: string | string[]
): string | null {
  if (!Array.isArray(answer)) {
    return `"${attribute.question}" must be an array`;
  }

  const allowedOptions = attribute.optionsWithCost?.map((o) => o.value) ?? attribute.options;

  if (allowedOptions) {
    const invalidOptions = answer.filter((opt) => !allowedOptions.includes(opt));
    if (invalidOptions.length > 0) {
      return `"${attribute.question}" contains invalid options: ${invalidOptions.join(", ")}`;
    }
  }

  return null;
}

function validateNumberType(attribute: ServiceAttribute, answer: string | string[]): string | null {
  if (typeof answer !== "string") {
    return `"${attribute.question}" must be a number`;
  }

  const numValue = Number.parseFloat(answer);
  if (Number.isNaN(numValue)) {
    return `"${attribute.question}" must be a valid number`;
  }

  if (attribute.min !== undefined && numValue < attribute.min) {
    return `"${attribute.question}" must be at least ${attribute.min}`;
  }

  if (attribute.max !== undefined && numValue > attribute.max) {
    return `"${attribute.question}" must be at most ${attribute.max}`;
  }

  return null;
}

function validateTextType(attribute: ServiceAttribute, answer: string | string[]): string | null {
  if (typeof answer !== "string") {
    return `"${attribute.question}" must be a string`;
  }
  if (answer.trim().length === 0) {
    return `"${attribute.question}" cannot be empty`;
  }
  return null;
}

function validateMediaType(
  attribute: ServiceAttribute,
  answer: string | string[],
  options?: ValidateAttributeOptions
): string | null {
  const urls = Array.isArray(answer) ? answer : [answer];
  if (urls.length === 0) {
    return `"${attribute.question}" requires at least one file`;
  }

  const maxFiles = resolveAttributeMaxFiles(attribute);
  if (urls.length > maxFiles) {
    return `"${attribute.question}" allows at most ${maxFiles} file(s)`;
  }

  for (const url of urls) {
    if (typeof url !== "string" || !url.trim()) {
      return `"${attribute.question}" contains an invalid file URL`;
    }
  }

  const userId = options?.userId;
  if (userId) {
    const invalid = urls.filter((url) => !isAllowedUploadUrl(url, userId));
    if (invalid.length > 0) {
      return `"${attribute.question}" contains invalid upload URL(s)`;
    }
  } else {
    const invalid = urls.filter((url) => !url.trim().includes("/api/files/uploads/"));
    if (invalid.length > 0) {
      return `"${attribute.question}" must use uploaded file URLs`;
    }
  }

  return null;
}

export function formatAttributeResponses(responses: AttributeResponse[]): string {
  if (!responses || responses.length === 0) {
    return "No additional information provided";
  }

  return responses
    .map((r) => {
      const answer = Array.isArray(r.answer) ? r.answer.join(", ") : r.answer;
      return `**${r.question}**\n${answer}`;
    })
    .join("\n\n");
}

export function calculateAttributeCredits(
  attributes: ServiceAttribute[],
  responses: AttributeResponse[]
): number {
  if (!attributes || attributes.length === 0 || !responses || responses.length === 0) {
    return 0;
  }

  const responseMap = new Map(responses.map((r) => [r.question, r.answer]));

  let totalAdditionalCredits = 0;

  for (const attribute of attributes) {
    const answer = responseMap.get(attribute.question);
    if (!answer) continue;

    const credits = calculateSingleAttributeCredits(attribute, answer);
    totalAdditionalCredits += credits;
  }

  return totalAdditionalCredits;
}

export function calculateAttributeCreditBreakdown(
  attributes: ServiceAttribute[],
  responses: AttributeResponse[]
): Array<{ question: string; answer: string | string[]; cost: number }> {
  if (!attributes || attributes.length === 0 || !responses || responses.length === 0) {
    return [];
  }

  const responseMap = new Map(responses.map((r) => [r.question, r.answer]));

  const items: Array<{ question: string; answer: string | string[]; cost: number }> = [];

  for (const attribute of attributes) {
    const answer = responseMap.get(attribute.question);
    if (!answer) continue;

    const cost = calculateSingleAttributeCredits(attribute, answer);

    if (cost > 0) {
      items.push({ question: attribute.question, answer, cost });
    }
  }

  return items;
}

function calculateSingleAttributeCredits(
  attribute: ServiceAttribute,
  answer: string | string[]
): number {
  if (attribute.type === "file" || attribute.type === "voice") {
    return 0;
  }

  if (attribute.type === "select") {
    const optionCost = getOptionCost(attribute, answer as string);
    if (optionCost !== null) return optionCost;
  }

  if (attribute.type === "multiselect") {
    if (!Array.isArray(answer)) return 0;
    const costs = answer
      .map((val) => getOptionCost(attribute, val))
      .filter((c): c is number => c !== null);
    return costs.reduce((sum, c) => sum + c, 0);
  }

  if (Array.isArray(answer)) return 0;

  const numericValue = Number.parseFloat(answer);
  if (Number.isNaN(numericValue)) return 0;

  const creditImpact = attribute.creditImpact || 0;

  if (attribute.includedQuantity !== undefined) {
    const excess = Math.max(0, numericValue - attribute.includedQuantity);
    return excess * creditImpact;
  }

  return creditImpact * numericValue;
}

function getOptionCost(attribute: ServiceAttribute, value: string): number | null {
  const option = attribute.optionsWithCost?.find((o) => o.value === value);
  if (option) return option.creditCost ?? 0;
  if (attribute.creditImpact) {
    const numericValue = Number.parseFloat(value);
    if (!Number.isNaN(numericValue)) return numericValue * attribute.creditImpact;
  }
  return attribute.creditImpact ?? null;
}
