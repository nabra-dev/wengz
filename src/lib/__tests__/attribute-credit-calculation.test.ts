import { calculateAttributeCredits } from "../attribute-validation";
import { ServiceAttribute, AttributeResponse } from "@/types/service-attributes";

describe("calculateAttributeCredits", () => {
  it("should return 0 when no attributes provided", () => {
    const result = calculateAttributeCredits([], []);
    expect(result).toBe(0);
  });

  it("should return 0 when attributes have no creditImpact", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "What color?",
        required: false,
        type: "select",
        options: ["Red", "Blue"],
      },
    ];
    const responses: AttributeResponse[] = [{ question: "What color?", answer: "Red" }];

    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(0);
  });

  it("should calculate credits for select type (selectedValue × creditImpact)", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "How many additional 10-second segments?",
        required: false,
        type: "select",
        options: ["0", "1", "2", "3"],
        creditImpact: 5,
      },
    ];
    const responses: AttributeResponse[] = [
      { question: "How many additional 10-second segments?", answer: "2" },
    ];

    // User selects "2" segments, each costs 5 credits → 2 × 5 = 10 credits
    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(10);
  });

  it("should return 0 when select value is 0", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "How many additional 10-second segments?",
        required: false,
        type: "select",
        options: ["0", "1", "2", "3"],
        creditImpact: 5,
      },
    ];
    const responses: AttributeResponse[] = [
      { question: "How many additional 10-second segments?", answer: "0" },
    ];

    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(0);
  });

  it("should calculate credits for number type with includedQuantity", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "Total number of products in menu",
        required: true,
        type: "number",
        min: 1,
        includedQuantity: 20,
        creditImpact: 1,
      },
    ];
    const responses: AttributeResponse[] = [
      { question: "Total number of products in menu", answer: "25" },
    ];

    // 25 products with 20 included → (25-20) × 1 = 5 credits
    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(5);
  });

  it("should return 0 when quantity is within included amount", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "Total number of products in menu",
        required: true,
        type: "number",
        min: 1,
        includedQuantity: 20,
        creditImpact: 1,
      },
    ];
    const responses: AttributeResponse[] = [
      { question: "Total number of products in menu", answer: "15" },
    ];

    // 15 products with 20 included → no extra charge
    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(0);
  });

  it("should calculate credits for multiple attributes", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "How many additional 10-second segments?",
        required: false,
        type: "select",
        options: ["0", "1", "2", "3"],
        creditImpact: 5,
      },
      {
        question: "Total number of products",
        required: true,
        type: "number",
        min: 1,
        includedQuantity: 20,
        creditImpact: 1,
      },
    ];
    const responses: AttributeResponse[] = [
      { question: "How many additional 10-second segments?", answer: "3" },
      { question: "Total number of products", answer: "30" },
    ];

    // 3 segments × 5 = 15 credits
    // (30-20) products × 1 = 10 credits
    // Total = 25 credits
    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(25);
  });

  it("should ignore non-numeric answers", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "Special instructions",
        required: false,
        type: "text",
        creditImpact: 5, // Even with creditImpact, text type shouldn't add credits
      },
    ];
    const responses: AttributeResponse[] = [
      { question: "Special instructions", answer: "Please make it blue" },
    ];

    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(0);
  });

  it("should handle missing responses gracefully", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "How many additional segments?",
        required: false,
        type: "select",
        options: ["0", "1", "2"],
        creditImpact: 5,
      },
    ];
    const responses: AttributeResponse[] = []; // No response provided

    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(0);
  });

  it("should charge creditImpact per selected option for multiselect", () => {
    const attributes: ServiceAttribute[] = [
      {
        question: "Select features",
        required: false,
        type: "multiselect",
        options: ["Feature1", "Feature2"],
        creditImpact: 5,
      },
    ];
    const responses: AttributeResponse[] = [
      { question: "Select features", answer: ["Feature1", "Feature2"] },
    ];

    // Multiselect is supported: each selected option costs creditImpact
    const result = calculateAttributeCredits(attributes, responses);
    expect(result).toBe(10);
  });
});
