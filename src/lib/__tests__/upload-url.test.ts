import { isAllowedUploadUrl } from "../upload-url";

describe("isAllowedUploadUrl", () => {
  const userId = "user_abc";

  it("allows the user's own upload paths", () => {
    expect(isAllowedUploadUrl(`/api/files/uploads/${userId}/123-file.png`, userId)).toBe(true);
  });

  it("rejects other users' paths", () => {
    expect(isAllowedUploadUrl(`/api/files/uploads/other/123-file.png`, userId)).toBe(false);
  });

  it("rejects javascript and external URLs", () => {
    expect(isAllowedUploadUrl("javascript:alert(1)", userId)).toBe(false);
    expect(isAllowedUploadUrl("https://evil.example/phish", userId)).toBe(false);
    expect(isAllowedUploadUrl("data:text/html,<script>", userId)).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(isAllowedUploadUrl(`/api/files/uploads/${userId}/../admin/secret`, userId)).toBe(
      false
    );
  });
});
