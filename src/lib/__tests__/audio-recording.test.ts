import {
  contentTypeFromFilename,
  isAllowedUploadMime,
  normalizeUploadMime,
} from "@/lib/upload-limits";
import { isAudioLikeFile, pickSupportedAudioMime } from "@/lib/audio-recording";

describe("normalizeUploadMime", () => {
  it("strips codec parameters from mobile MediaRecorder types", () => {
    expect(normalizeUploadMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeUploadMime("audio/mp4;codecs=mp4a.40.2")).toBe("audio/mp4");
  });

  it("maps common aliases", () => {
    expect(normalizeUploadMime("audio/x-m4a")).toBe("audio/mp4");
    expect(normalizeUploadMime("audio/mp3")).toBe("audio/mpeg");
  });

  it("allows codec-suffixed types via isAllowedUploadMime", () => {
    expect(isAllowedUploadMime("audio/webm;codecs=opus")).toBe(true);
    expect(isAllowedUploadMime("application/javascript")).toBe(false);
  });

  it("allows empty MIME when filename extension is known", () => {
    expect(isAllowedUploadMime("", "voice-note.m4a")).toBe(true);
    expect(isAllowedUploadMime("", "photo.jpeg")).toBe(true);
    expect(isAllowedUploadMime("", "noext")).toBe(false);
  });
});

describe("contentTypeFromFilename", () => {
  it("infers audio/webm for voice recordings when metadata is missing", () => {
    expect(contentTypeFromFilename("uploads/u/voice-123.webm")).toBe("audio/webm");
    expect(contentTypeFromFilename("uploads/u/clip.webm")).toBe("video/webm");
  });

  it("prefers normalized metadata when present", () => {
    expect(contentTypeFromFilename("x.webm", "audio/webm;codecs=opus")).toBe("audio/webm");
  });
});

describe("audio-recording helpers", () => {
  it("isAudioLikeFile accepts empty-type mobile files by extension", () => {
    expect(isAudioLikeFile(new File([], "note.m4a", { type: "" }))).toBe(true);
    expect(isAudioLikeFile(new File([], "pic.png", { type: "" }))).toBe(false);
  });

  it("pickSupportedAudioMime prefers a supported candidate", () => {
    const original = global.MediaRecorder;
    // @ts-expect-error test stub
    global.MediaRecorder = {
      isTypeSupported: (type: string) => type === "audio/webm;codecs=opus",
    };

    expect(pickSupportedAudioMime()).toEqual({
      mimeType: "audio/webm;codecs=opus",
      fileType: "audio/webm",
      extension: "webm",
    });

    global.MediaRecorder = original;
  });
});
