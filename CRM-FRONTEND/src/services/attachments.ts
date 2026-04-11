import { BaseApiService } from './base';
import type { ApiResponse } from '@/types/api';

export interface Attachment {
  id: string;
  /**
   * Backend may send the case association as either a numeric `case_id` or a
   * UUID `id` depending on the endpoint, so both shapes are accepted here.
   */
  caseId: string | number;
  filename: string;
  originalName: string;
  filePath: string;
  /** Canonical size field returned by the backend (in bytes). */
  fileSize: number;
  /** Legacy alias sent by some mobile upload paths. Prefer `fileSize`. */
  size?: number;
  mimeType: string;
  category?: 'PHOTO' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';
  description?: string;
  isPublic: boolean;
  uploadedBy: string;
  verificationTaskId?: string | null;
  createdAt: string;
  uploadedAt?: string;
}

export interface UploadAttachmentData {
  caseId: string | number;
  files: File[];
  description?: string;
  category?: 'PHOTO' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';
  isPublic?: boolean;
  verificationTaskId?: string;
}

export interface UpdateAttachmentData {
  description?: string;
  category?: 'PHOTO' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';
  isPublic?: boolean;
}

class AttachmentsService extends BaseApiService {
  constructor() {
    super('/attachments');
  }

  /**
   * Get all attachments for a specific case
   */
  async getAttachmentsByCase(caseId: string | number): Promise<ApiResponse<Attachment[]>> {
    return this.get(`/case/${caseId}`);
  }

  /**
   * Get a specific attachment by ID
   */
  async getAttachmentById(id: string): Promise<ApiResponse<Attachment>> {
    return this.get(`/${id}`);
  }

  /**
   * Build the multipart form body shared by upload and bulk-upload.
   *
   * `includeTaskId` controls whether the verificationTaskId field is appended
   * — bulk upload historically ignored that field, so the flag keeps the
   * wire format identical to before the refactor.
   */
  private buildUploadFormData(
    data: UploadAttachmentData,
    options: { includeTaskId: boolean }
  ): FormData {
    const formData = new FormData();
    formData.append('caseId', data.caseId.toString());

    if (data.description) {
      formData.append('description', data.description);
    }

    if (data.category) {
      formData.append('category', data.category);
    }

    if (data.isPublic !== undefined) {
      formData.append('isPublic', data.isPublic.toString());
    }

    if (options.includeTaskId && data.verificationTaskId) {
      formData.append('verificationTaskId', data.verificationTaskId);
    }

    data.files.forEach(file => {
      formData.append('files', file);
    });

    return formData;
  }

  /**
   * Upload attachments for a case
   */
  async uploadAttachments(data: UploadAttachmentData): Promise<ApiResponse<Attachment[]>> {
    const formData = this.buildUploadFormData(data, { includeTaskId: true });
    return this.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Bulk upload attachments
   */
  async bulkUploadAttachments(
    data: UploadAttachmentData
  ): Promise<ApiResponse<Attachment[]>> {
    const formData = this.buildUploadFormData(data, { includeTaskId: false });
    return this.post('/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Update attachment metadata
   */
  async updateAttachment(id: string, data: UpdateAttachmentData): Promise<ApiResponse<Attachment>> {
    return this.put(`/${id}`, data);
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(id: string): Promise<ApiResponse<void>> {
    return this.delete(`/${id}`);
  }

  /**
   * Bulk delete attachments
   */
  async bulkDeleteAttachments(attachmentIds: string[]): Promise<ApiResponse<void>> {
    return this.post('/bulk-delete', { attachmentIds });
  }

  /**
   * Download an attachment
   */
  async downloadAttachment(id: string): Promise<Blob> {
    const response = await this.post(`/${id}/download`, {}, {
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  /**
   * Get attachment serve URL for preview
   */
  getAttachmentServeUrl(id: string): string {
    return `${this.baseURL}/${id}/serve`;
  }

  /**
   * Get supported file types
   */
  async getSupportedFileTypes(): Promise<ApiResponse<unknown>> {
    return this.get('/types');
  }
}

export const attachmentsService = new AttachmentsService();
export default attachmentsService;
