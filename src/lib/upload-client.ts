import {
  SINGLE_SHOT_UPLOAD_MAX_BYTES,
  UPLOAD_CHUNK_SIZE,
  isAllowedUploadMime,
} from "@/lib/upload-limits";

export type UploadedFileResult = {
  url: string;
  filename: string;
  size: number;
  type: string;
};

export type UploadProgress = {
  percent: number;
  loaded: number;
  total: number;
};

async function parseError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

async function uploadSingleShot(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadedFileResult> {
  const formData = new FormData();
  formData.append("file", file);

  // fetch has no upload progress; report start/end for small files
  onProgress?.({ percent: 0, loaded: 0, total: file.size });

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Upload failed"));
  }

  const data = (await response.json()) as UploadedFileResult;
  onProgress?.({ percent: 100, loaded: file.size, total: file.size });
  return {
    url: data.url,
    filename: data.filename,
    size: data.size,
    type: data.type,
  };
}

async function uploadChunked(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadedFileResult> {
  const initRes = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!initRes.ok) {
    throw new Error(await parseError(initRes, "Failed to start upload"));
  }

  const { uploadId, chunkSize: serverChunkSize } = (await initRes.json()) as {
    uploadId: string;
    chunkSize?: number;
  };

  const chunkSize = serverChunkSize || UPLOAD_CHUNK_SIZE;
  let offset = 0;
  let chunkIndex = 0;

  try {
    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const blob = file.slice(offset, end);

      const chunkRes = await fetch("/api/upload/chunk", {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-upload-id": uploadId,
          "x-chunk-index": String(chunkIndex),
        },
        body: blob,
      });

      if (!chunkRes.ok) {
        throw new Error(await parseError(chunkRes, "Chunk upload failed"));
      }

      offset = end;
      chunkIndex += 1;
      onProgress?.({
        percent: Math.min(99, Math.round((offset / file.size) * 100)),
        loaded: offset,
        total: file.size,
      });
    }

    const completeRes = await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId }),
    });

    if (!completeRes.ok) {
      throw new Error(await parseError(completeRes, "Failed to finalize upload"));
    }

    const data = (await completeRes.json()) as UploadedFileResult;
    onProgress?.({ percent: 100, loaded: file.size, total: file.size });
    return {
      url: data.url,
      filename: data.filename,
      size: data.size,
      type: data.type,
    };
  } catch (error) {
    void fetch(`/api/upload/abort?uploadId=${encodeURIComponent(uploadId)}`, {
      method: "DELETE",
    });
    throw error;
  }
}

/**
 * Upload a file via single-shot (small) or chunked (large) local-disk API.
 */
export async function uploadFileToServer(
  file: File,
  options?: {
    maxSizeBytes: number;
    onProgress?: (progress: UploadProgress) => void;
  }
): Promise<UploadedFileResult> {
  if (!isAllowedUploadMime(file.type)) {
    throw new Error("Invalid file type");
  }

  const maxSizeBytes = options?.maxSizeBytes ?? Number.POSITIVE_INFINITY;
  if (file.size > maxSizeBytes) {
    throw new Error("File too large");
  }

  if (file.size <= SINGLE_SHOT_UPLOAD_MAX_BYTES) {
    return uploadSingleShot(file, options?.onProgress);
  }

  return uploadChunked(file, options?.onProgress);
}
