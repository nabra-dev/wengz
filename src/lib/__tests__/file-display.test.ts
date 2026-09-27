import { detectFileKind, prettyFilename, resolveFileKind } from "@/lib/file-display";

describe("file-display", () => {
  describe("prettyFilename", () => {
    it("strips timestamp and uuid storage prefixes", () => {
      expect(prettyFilename("1790476903742-63c11e30-16c9-40c5-aee6-0dfecd99eb55.jpeg")).toBe(
        ".jpeg"
      );
    });

    it("strips voice recording prefixes", () => {
      expect(prettyFilename("1790476952505-voice-1790476952323.webm")).toBe(".webm");
      expect(prettyFilename("voice-note-123.webm")).toBe(".webm");
    });

    it("keeps meaningful human names", () => {
      expect(prettyFilename("1790476897032-logo-final.png")).toBe("logo-final.png");
      expect(prettyFilename("brief.pdf")).toBe("brief.pdf");
    });
  });

  describe("detectFileKind / resolveFileKind", () => {
    it("detects images and pdfs", () => {
      expect(detectFileKind("/api/files/uploads/u/a.jpeg")).toBe("image");
      expect(detectFileKind("/api/files/uploads/u/doc.pdf")).toBe("pdf");
    });

    it("treats voice-named webm as audio", () => {
      expect(detectFileKind("/api/files/uploads/u/voice-123.webm")).toBe("audio");
      expect(resolveFileKind("/api/files/uploads/u/clip.webm", "voice")).toBe("audio");
    });
  });
});
