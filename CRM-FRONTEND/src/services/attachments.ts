import { BaseApiService } from './base';
import type { ApiResponse } from '@/types/api';

export interface Attachment {
  id: string;
  caseId: number;
  case_id: string;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  size?: number;
  mimeType: string;
  category?: 'PHOTO' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';
  description?: string;
  isPublic: boolean;
  uploadedBy: string;
  verification_task_id?: string | null;
  createdAt: string;
  uploadedAt?: string;
}

export interface UploadAttachmentData {
  caseId: string | number;
  files: File[];
  description?: string;
  category?: 'PHOTO' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';
  isPublic?: boolean;
  verification_task_id?: string;
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
   * Upload attachments for a case
   */
  async uploadAttachments(data: UploadAttachmentData): Promise<ApiResponse<Attachment[]>> {
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

    if (data.verification_task_id) {
      formData.append('verification_task_id', data.verification_task_id);
    }

    data.files.forEach((file) => {
      formData.append('files', file);
    });

    return this.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Bulk upload attachments
   */
  async bulkUploadAttachments(data: UploadAttachmentData): Promise<ApiResponse<Attachment[]>> {
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

    data.files.forEach((file) => {
      formData.append('files', file);
    });

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
