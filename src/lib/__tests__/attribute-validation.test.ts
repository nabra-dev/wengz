import {
  validateAttributeResponses,
  collectAttributeMediaUrls,
  calculateAttributeCredits,
} from "../attribute-validation";

describe("Attribute Validation", () => {
  it("should validate required text attribute", () => {
    const attributes = [
      {
        question: "Project Name",
        type: "text" as const,
        required: true,
      },
    ];

    const responses = [{ question: "Project Name", answer: "Test Project" }];

    const result = validateAttributeResponses(attributes, responses);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation for missing required attribute", () => {
    const attributes = [
      {
        question: "Project Name",
        type: "text" as const,
        required: true,
      },
    ];

    const responses: any[] = [];

    const result = validateAttributeResponses(attributes, responses);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Project Name");
  });

  it("should validate SELECT attribute with valid option", () => {
    const attributes = [
      {
        question: "Color",
        type: "select" as const,
        required: true,
        options: ["Red", "Blue", "Green"],
      },
    ];

    const responses = [{ question: "Color", answer: "Red" }];

    const result = validateAttributeResponses(attributes, responses);
    expect(result.valid).toBe(true);
  });

  it("should fail validation for invalid SELECT option", () => {
    const attributes = [
      {
        question: "Color",
        type: "select" as const,
        required: true,
        options: ["Red", "Blue", "Green"],
      },
    ];

    const responses = [{ question: "Color", answer: "Yellow" }];

    const result = validateAttributeResponses(attributes, responses);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should allow optional attributes to be empty", () => {
    const attributes = [
      {
        question: "Description",
        type: "text" as const,
        required: false,
      },
    ];

    const responses: any[] = [];

    const result = validateAttributeResponses(attributes, responses);
    expect(result.valid).toBe(true);
  });

  it("should require file answers when required", () => {
    const attributes = [
      {
        question: "Brand assets",
        type: "file" as const,
        required: true,
      },
    ];

    const result = validateAttributeResponses(attributes, []);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Brand assets");
  });

  it("should accept allowed upload URLs for file type", () => {
    const userId = "user_abc";
    const attributes = [
      {
        question: "Brand assets",
        type: "file" as const,
        required: true,
        maxFiles: 3,
      },
    ];
    const url = `/api/files/uploads/${userId}/123-logo.png`;
    const result = validateAttributeResponses(
      attributes,
      [{ question: "Brand assets", answer: [url] }],
      { userId }
    );
    expect(result.valid).toBe(true);
  });

  it("should reject external URLs for voice type", () => {
    const userId = "user_abc";
    const attributes = [
      {
        question: "Voice brief",
        type: "voice" as const,
        required: true,
      },
    ];
    const result = validateAttributeResponses(
      attributes,
      [{ question: "Voice brief", answer: "https://evil.example/a.webm" }],
      { userId }
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/invalid upload URL/i);
  });

  it("should reject too many files", () => {
    const userId = "user_abc";
    const attributes = [
      {
        question: "Assets",
        type: "file" as const,
        required: true,
        maxFiles: 1,
      },
    ];
    const urls = [`/api/files/uploads/${userId}/a.png`, `/api/files/uploads/${userId}/b.png`];
    const result = validateAttributeResponses(attributes, [{ question: "Assets", answer: urls }], {
      userId,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/at most 1/i);
  });

  it("collectAttributeMediaUrls returns only file/voice answers", () => {
    const urls = collectAttributeMediaUrls(
      [
        { question: "Name", type: "text", required: true },
        { question: "Assets", type: "file", required: false },
        { question: "Brief", type: "voice", required: false },
      ],
      [
        { question: "Name", answer: "Acme" },
        { question: "Assets", answer: ["/api/files/uploads/u/a.png"] },
        { question: "Brief", answer: "/api/files/uploads/u/v.webm" },
      ]
    );
    expect(urls).toEqual(["/api/files/uploads/u/a.png", "/api/files/uploads/u/v.webm"]);
  });

  it("file/voice answers add zero credits", () => {
    const credits = calculateAttributeCredits(
      [
        {
          question: "Assets",
          type: "file",
          required: false,
          creditImpact: 99,
        },
        {
          question: "Brief",
          type: "voice",
          required: false,
          creditImpact: 50,
        },
      ],
      [
        { question: "Assets", answer: ["/api/files/uploads/u/a.png"] },
        { question: "Brief", answer: "/api/files/uploads/u/v.webm" },
      ]
    );
    expect(credits).toBe(0);
  });
});
