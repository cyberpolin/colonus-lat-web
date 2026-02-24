import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

interface UploadToCloudinaryInput {
  buffer: Buffer;
  folder: string;
  filename?: string;
}

interface UploadJsonToCloudinaryInput {
  data: unknown;
  publicId: string;
  overwrite?: boolean;
}

let configured = false;

const ensureCloudinaryConfigured = (): void => {
  if (configured) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary env vars are required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
  configured = true;
};

interface CloudinaryRawResource {
  public_id: string;
  secure_url: string;
  created_at?: string;
}

const parseCloudinaryErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const directHttpCode = (error as { http_code?: unknown }).http_code;
  if (typeof directHttpCode === "number") return directHttpCode;
  const nestedHttpCode = (error as { error?: { http_code?: unknown } }).error?.http_code;
  return typeof nestedHttpCode === "number" ? nestedHttpCode : undefined;
};

export const uploadToCloudinary = async ({
  buffer,
  folder,
  filename
}: UploadToCloudinaryInput): Promise<{ secure_url: string; public_id: string }> => {
  ensureCloudinaryConfigured();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: Boolean(filename),
        unique_filename: true,
        filename_override: filename
      },
      (error, response) => {
        if (error) return reject(error);
        if (!response) return reject(new Error("Cloudinary upload returned an empty response."));
        resolve(response);
      }
    );

    uploadStream.end(buffer);
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id
  };
};

export const uploadJsonToCloudinary = async ({
  data,
  publicId,
  overwrite = true
}: UploadJsonToCloudinaryInput): Promise<{ secure_url: string; public_id: string }> => {
  ensureCloudinaryConfigured();
  const payload = Buffer.from(JSON.stringify(data, null, 2), "utf8");

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "raw",
        overwrite
      },
      (error, response) => {
        if (error) return reject(error);
        if (!response) return reject(new Error("Cloudinary upload returned an empty response."));
        resolve(response);
      }
    );

    uploadStream.end(payload);
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id
  };
};

export const listCloudinaryRawResourcesByPrefix = async (
  prefix: string
): Promise<CloudinaryRawResource[]> => {
  ensureCloudinaryConfigured();

  const resources: CloudinaryRawResource[] = [];
  let nextCursor: string | undefined;

  do {
    const response = await cloudinary.api.resources({
      type: "upload",
      resource_type: "raw",
      prefix,
      max_results: 500,
      next_cursor: nextCursor
    });

    const batch = (response.resources ?? []) as CloudinaryRawResource[];
    resources.push(...batch);
    nextCursor = response.next_cursor;
  } while (nextCursor);

  return resources;
};

export const getCloudinaryRawResource = async (
  publicId: string
): Promise<CloudinaryRawResource | undefined> => {
  ensureCloudinaryConfigured();
  try {
    const resource = (await cloudinary.api.resource(publicId, {
      type: "upload",
      resource_type: "raw"
    })) as CloudinaryRawResource;
    return resource;
  } catch (error) {
    if (parseCloudinaryErrorStatus(error) === 404) return undefined;
    throw error;
  }
};
