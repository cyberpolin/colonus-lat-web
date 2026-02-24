"use client";

import type { MediaUploadStub } from "@colonus/shared";

interface UploadMediaInput {
  proof: MediaUploadStub;
  landlordId: string;
  propertyId: string;
  category: string;
}

interface UploadedMediaResult {
  secureUrl: string;
  publicId: string;
}

interface BackupSyncPayload {
  actorId?: string;
  propertyId?: string;
  clientSessionId?: string;
  clientStorageVersion?: string;
  counts?: Record<string, number>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const toUploadFile = async (proof: MediaUploadStub): Promise<File> => {
  const response = await fetch(proof.localObjectUrl);
  if (!response.ok) {
    throw new Error(`Unable to read selected file (${response.status}).`);
  }
  const blob = await response.blob();
  return new File([blob], proof.fileName, { type: proof.mimeType || blob.type || "application/octet-stream" });
};

export const uploadMediaToApi = async ({
  proof,
  landlordId,
  propertyId,
  category
}: UploadMediaInput): Promise<UploadedMediaResult> => {
  const file = await toUploadFile(proof);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("landlordId", landlordId);
  formData.append("propertyId", propertyId);
  formData.append("category", category);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Upload failed (${response.status}).`);
  }

  const payload = (await response.json()) as { secureUrl: string; publicId: string };
  return {
    secureUrl: payload.secureUrl,
    publicId: payload.publicId
  };
};

export const logBackupSyncEvent = async (payload: BackupSyncPayload): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/sync/backup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? `Backup sync log failed (${response.status}).`);
  }
};
