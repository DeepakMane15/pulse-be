export type VideoProcessingStatus = 'uploaded' | 'processing' | 'completed' | 'failed';
export type SensitivityStatus = 'pending' | 'safe' | 'flagged';

export type UploadVideoInput = {
  title?: string;
  description?: string;
};
