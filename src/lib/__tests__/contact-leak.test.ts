import {
  findContactLeaks,
  findContactLeaksInFields,
  isOffPlatformContactUrl,
  normalizeForContactScan,
  textHasContactLeak,
} from "@/lib/contact-leak";

describe("findContactLeaks", () => {
  it("detects WhatsApp / Telegram links", () => {
    expect(textHasContactLeak("message me https://wa.me/201000000000")).toBe(true);
    expect(textHasContactLeak("join t.me/mygroup")).toBe(true);
    expect(findContactLeaks("https://api.whatsapp.com/send?phone=20100")[0]?.kind).toBe(
      "messaging_url"
    );
  });

  it("detects LinkedIn / Instagram profile URLs", () => {
    expect(textHasContactLeak("https://www.linkedin.com/in/jane-doe")).toBe(true);
    expect(textHasContactLeak("instagram.com/brand.studio")).toBe(true);
  });

  it("detects emails and phones in strict mode", () => {
    expect(textHasContactLeak("email me at client@example.com")).toBe(true);
    expect(textHasContactLeak("call +20 100 123 4567")).toBe(true);
    expect(textHasContactLeak("my number is 01001234567")).toBe(true);
  });

  it("detects solicitations in English and Arabic", () => {
    expect(textHasContactLeak("contact me on WhatsApp")).toBe(true);
    expect(textHasContactLeak("my WhatsApp is ready")).toBe(true);
    expect(textHasContactLeak("تواصل معي على واتساب")).toBe(true);
    expect(textHasContactLeak("كلمني تليجرام")).toBe(true);
  });

  it("allows design briefs that mention platforms without sharing contact", () => {
    expect(textHasContactLeak("Need an Instagram post design and LinkedIn banner")).toBe(false);
    expect(textHasContactLeak("تصميم بوست انستغرام للمتجر")).toBe(false);
  });

  it("detects social handles", () => {
    expect(textHasContactLeak("add me @design.studio99")).toBe(true);
    expect(textHasContactLeak("linkedin: jane-doe-creative")).toBe(true);
  });

  it("allows normal brief text without contact", () => {
    expect(
      textHasContactLeak("Need a logo for a coffee brand, modern and minimal, warm tones.")
    ).toBe(false);
  });

  it("does not treat credit amounts as phones", () => {
    expect(textHasContactLeak("This costs 1500 credits for the package")).toBe(false);
  });

  it("brief mode allows bare phones but blocks WhatsApp outreach", () => {
    expect(textHasContactLeak("Print 01001234567 on the poster", "brief")).toBe(false);
    expect(textHasContactLeak("WhatsApp me for details", "brief")).toBe(true);
    expect(textHasContactLeak("https://wa.me/201000000000", "brief")).toBe(true);
  });

  it("detects obfuscated platform names", () => {
    expect(textHasContactLeak("contact me on w.h.a.t.s.a.p.p")).toBe(true);
    expect(textHasContactLeak("watsapp me please")).toBe(true);
    expect(textHasContactLeak("what s app me")).toBe(true);
    expect(textHasContactLeak("my tele gram is open")).toBe(true);
  });

  it("detects obfuscated emails", () => {
    expect(textHasContactLeak("mail me john at gmail dot com")).toBe(true);
    expect(textHasContactLeak("reach me name(at)brand(dot)co")).toBe(true);
  });

  it("detects spaced and spoken phone numbers", () => {
    expect(textHasContactLeak("call 0 1 0 0 1 2 3 4 5 6 7")).toBe(true);
    expect(textHasContactLeak("zero one zero zero one two three four five six seven")).toBe(true);
    expect(textHasContactLeak("رقمي ٠١٠٠١٢٣٤٥٦٧")).toBe(true);
  });
});

describe("normalizeForContactScan", () => {
  it("collapses separator obfuscation", () => {
    expect(normalizeForContactScan("w.h.a.t.s.a.p.p")).toContain("whatsapp");
  });

  it("maps arabic digits", () => {
    expect(normalizeForContactScan("٠١٠٠")).toContain("0100");
  });
});

describe("findContactLeaksInFields", () => {
  it("scans title, description, and attribute answers", () => {
    const hits = findContactLeaksInFields({
      title: "Logo project",
      description: "call me on WhatsApp",
      attributeAnswers: ["Put +201001234567 on the card"],
    });
    expect(hits.some((h) => h.kind === "solicitation")).toBe(true);
    // bare phone in attribute brief mode should not be flagged
    expect(hits.some((h) => h.kind === "phone")).toBe(false);
  });
});

describe("isOffPlatformContactUrl", () => {
  it("flags contact destinations", () => {
    expect(isOffPlatformContactUrl("https://wa.me/123")).toBe(true);
    expect(isOffPlatformContactUrl("https://linkedin.com/in/x")).toBe(true);
    expect(isOffPlatformContactUrl("https://example.com/portfolio")).toBe(false);
  });
});
