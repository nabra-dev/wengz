/**
 * Service Q&A Attribute Types
 * These types define the structure for custom questions and answers per service
 */

export type AttributeType =
  | "text"
  | "select"
  | "multiselect"
  | "textarea"
  | "number"
  | "file"
  | "voice";

export const DEFAULT_FILE_MAX_FILES = 5;
export const DEFAULT_VOICE_MAX_FILES = 1;
export const DEFAULT_FILE_MAX_SIZE_MB = 50;
export const DEFAULT_VOICE_MAX_SIZE_MB = 25;
export const ATTR_MAX_FILES_CLAMP = 10;

export interface AttributeOptionWithCost {
  value: string;
  creditCost?: number;
  labelI18n?: { [locale: string]: string };
}

export interface ServiceAttribute {
  question: string;
  questionI18n?: { [locale: string]: string }; // Optional localized question
  required: boolean;
  type: AttributeType;
  options?: string[]; // For select/multiselect types
  optionsWithCost?: AttributeOptionWithCost[]; // Per-option credit cost for select/multiselect
  placeholder?: string;
  placeholderI18n?: { [locale: string]: string };
  helpText?: string;
  helpTextI18n?: { [locale: string]: string };
  min?: number; // For number type
  max?: number; // For number type
  creditImpact?: number; // Credits per unit (e.g., 5 credits per additional segment)
  includedQuantity?: number; // Free quantity included in base price (e.g., first 20 products)
  /** Max uploads for file/voice (clamped 1–10). Defaults: file=5, voice=1 */
  maxFiles?: number;
  /** Max size per file in MB for file/voice. Defaults: file=50, voice=25 */
  maxSizeMB?: number;
}

export interface AttributeResponse {
  question: string;
  answer: string | string[]; // string for text/select, string[] for multiselect/file/voice
}

/**
 * Example usage:
 *
 * Service Attributes (stored in ServiceType.attributes):
 * [
 *   {
 *     question: "How many additional 10-second segments?",
 *     required: false,
 *     type: "select",
 *     options: ["0", "1", "2", "3"],
 *     creditImpact: 5  // 5 credits per segment (selecting "2" = 2 × 5 = 10 credits)
 *   },
 *   {
 *     question: "Total number of products in menu",
 *     required: true,
 *     type: "number",
 *     min: 1,
 *     includedQuantity: 20,  // First 20 products included in base price
 *     creditImpact: 1  // 1 credit per product after the first 20
 *   },
 *   {
 *     question: "Upload brand assets",
 *     required: true,
 *     type: "file",
 *     maxFiles: 5,
 *     maxSizeMB: 50
 *   },
 *   {
 *     question: "Record a voice brief",
 *     required: false,
 *     type: "voice",
 *     maxFiles: 1,
 *     maxSizeMB: 25
 *   }
 * ]
 *
 * Client Responses (stored in Request.attributeResponses):
 * [
 *   {
 *     question: "How many additional 10-second segments?",
 *     answer: "2"
 *   },
 *   {
 *     question: "Total number of products in menu",
 *     answer: "25"
 *   },
 *   {
 *     question: "Upload brand assets",
 *     answer: ["/api/files/uploads/userId/123-logo.png"]
 *   }
 * ]
 */

export function resolveAttributeMaxFiles(
  attr: Pick<ServiceAttribute, "type" | "maxFiles">
): number {
  const fallback = attr.type === "voice" ? DEFAULT_VOICE_MAX_FILES : DEFAULT_FILE_MAX_FILES;
  const raw = attr.maxFiles ?? fallback;
  return Math.min(ATTR_MAX_FILES_CLAMP, Math.max(1, raw));
}

export function resolveAttributeMaxSizeMB(
  attr: Pick<ServiceAttribute, "type" | "maxSizeMB">
): number {
  const fallback = attr.type === "voice" ? DEFAULT_VOICE_MAX_SIZE_MB : DEFAULT_FILE_MAX_SIZE_MB;
  const raw = attr.maxSizeMB ?? fallback;
  return Math.max(1, raw);
}
