import { writeFile, mkdir, access, constants, readFile, unlink } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";
import { createHash } from "crypto";

export interface StorageConfig {
  type: "local" | "s3";
  localDir?: string;
  s3Config?: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
}

export interface UploadedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StorageResult {
  path: string;
  url: string;
  mimeType: string;
  size: number;
  hash: string;
}

export interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
}

class StorageService {
  private config: StorageConfig;
  private uploadDir: string;

  constructor() {
    this.config = {
      type: (process.env.STORAGE_TYPE as "local" | "s3") || "local",
      localDir: process.env.UPLOAD_DIR || "./public/uploads",
    };
    this.uploadDir = this.config.localDir || "./public/uploads";
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await access(dirPath, constants.F_OK);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private generateFilePath(
    fileType: "image" | "pdf" | "video" | "screenshot" | "thumbnail",
    extension: string
  ): { relativePath: string; absolutePath: string } {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const randomId = uuidv4().split("-")[0];
    const filename = `${randomId}.${extension}`;

    const relativePath = `/${fileType}s/${year}/${month}/${day}/${filename}`;
    const absolutePath = join(this.uploadDir, relativePath);

    return { relativePath, absolutePath };
  }

  private computeHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  async uploadFile(
    file: UploadedFile,
    fileType: "image" | "pdf" | "video" | "screenshot" | "thumbnail"
  ): Promise<StorageResult> {
    if (this.config.type === "local") {
      return this.uploadToLocal(file, fileType);
    }
    throw new Error("S3 storage not yet implemented");
  }

  private async uploadToLocal(
    file: UploadedFile,
    fileType: "image" | "pdf" | "video" | "screenshot" | "thumbnail"
  ): Promise<StorageResult> {
    const extension = mime.extension(file.mimeType) || "bin";
    const { relativePath, absolutePath } = this.generateFilePath(fileType, extension);

    await this.ensureDir(join(absolutePath, ".."));
    await writeFile(absolutePath, file.buffer);

    const hash = this.computeHash(file.buffer);

    return {
      path: relativePath,
      url: `/uploads${relativePath}`,
      mimeType: file.mimeType,
      size: file.size,
      hash,
    };
  }

  async deleteFile(relativePath: string): Promise<void> {
    if (this.config.type === "local") {
      const absolutePath = join(this.uploadDir, relativePath);
      try {
        await unlink(absolutePath);
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    }
  }

  async getFile(relativePath: string): Promise<Buffer | null> {
    if (this.config.type === "local") {
      const absolutePath = join(this.uploadDir, relativePath);
      try {
        return await readFile(absolutePath);
      } catch {
        return null;
      }
    }
    return null;
  }

  getPublicUrl(relativePath: string): string {
    return `/uploads${relativePath}`;
  }

  validateFileType(
    mimeType: string,
    allowedTypes: string[]
  ): boolean {
    return allowedTypes.includes(mimeType);
  }

  validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }
}

// Validation constants
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime", // mov
];

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  document: 20 * 1024 * 1024, // 20MB
  screenshot: 5 * 1024 * 1024, // 5MB
};

export const storage = new StorageService();
