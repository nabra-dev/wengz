import { attributeResponsesContainFile, shouldAllowUnclaimedPendingFiles } from "@/lib/file-access";

describe("file-access", () => {
  const key = "uploads/client1/voice.webm";
  const url = `/api/files/${key}`;

  describe("attributeResponsesContainFile", () => {
    it("matches file/voice answers via service attributes", () => {
      expect(
        attributeResponsesContainFile(
          [
            { question: "Assets", answer: [`/api/files/uploads/client1/a.png`] },
            { question: "Brief", answer: url },
          ],
          [
            { question: "Assets", type: "file", required: false },
            { question: "Brief", type: "voice", required: false },
          ],
          key,
          url
        )
      ).toBe(true);
    });

    it("falls back to JSON scan when attributes are missing", () => {
      expect(
        attributeResponsesContainFile([{ question: "Brief", answer: url }], null, key, url)
      ).toBe(true);
    });

    it("returns false when the file is not referenced", () => {
      expect(
        attributeResponsesContainFile(
          [{ question: "Name", answer: "Acme" }],
          [{ question: "Name", type: "text", required: true }],
          key,
          url
        )
      ).toBe(false);
    });
  });

  describe("shouldAllowUnclaimedPendingFiles", () => {
    it("allows providers only", () => {
      expect(shouldAllowUnclaimedPendingFiles("PROVIDER")).toBe(true);
      expect(shouldAllowUnclaimedPendingFiles("CLIENT")).toBe(false);
      expect(shouldAllowUnclaimedPendingFiles("PROJECT_MANAGER")).toBe(false);
    });
  });
});
