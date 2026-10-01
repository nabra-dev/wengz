import { linkifyText, textContainsUrl } from "@/lib/linkify";

describe("linkifyText", () => {
  it("returns plain text when there are no URLs", () => {
    expect(linkifyText("hello world")).toEqual([{ type: "text", value: "hello world" }]);
  });

  it("linkifies https URLs", () => {
    const segments = linkifyText("See https://example.com/path for details");
    expect(segments).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://example.com/path", href: "https://example.com/path" },
      { type: "text", value: " for details" },
    ]);
  });

  it("linkifies www URLs with https href", () => {
    const segments = linkifyText("Visit www.example.com today");
    expect(segments).toEqual([
      { type: "text", value: "Visit " },
      { type: "link", value: "www.example.com", href: "https://www.example.com/" },
      { type: "text", value: " today" },
    ]);
  });

  it("keeps trailing punctuation outside the link", () => {
    const segments = linkifyText("Check https://example.com.");
    expect(segments).toEqual([
      { type: "text", value: "Check " },
      { type: "link", value: "https://example.com", href: "https://example.com/" },
      { type: "text", value: "." },
    ]);
  });

  it("handles multiple URLs", () => {
    const segments = linkifyText("A https://a.com and https://b.com end");
    expect(segments.filter((s) => s.type === "link")).toHaveLength(2);
  });

  it("preserves newlines around URLs", () => {
    const segments = linkifyText("Line1\nhttps://example.com\nLine3");
    expect(segments[0]).toEqual({ type: "text", value: "Line1\n" });
    expect(segments[1]).toMatchObject({ type: "link", value: "https://example.com" });
    expect(segments[2]).toEqual({ type: "text", value: "\nLine3" });
  });
});

describe("textContainsUrl", () => {
  it("detects urls", () => {
    expect(textContainsUrl("no links here")).toBe(false);
    expect(textContainsUrl("go to https://x.com")).toBe(true);
    expect(textContainsUrl("www.x.com")).toBe(true);
  });
});
