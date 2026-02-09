export interface Effect {
  id: string;
  name: string;
  apiName: string; // バックエンドAPI用のキー
  image: string;
  enabled: boolean;
  params: Record<string, number>;
  defaultParams: Record<string, number>;
}

export interface EffectConfig {
  name: string;
  params?: Record<string, number>;
}

export interface ProcessRequest {
  input_file: string;
  effect_chain: EffectConfig[];
}

export interface ProcessResponse {
  output_file: string;
  download_url: string;
  effects_applied: string[];
  input_normalized: string;
  output_normalized: string;
}

export interface AvailableEffect {
  name: string;
  default_params: Record<string, number>;
  class_name: string;
}

// S3 Upload types
export interface UploadUrlResponse {
  upload_url: string;
  s3_key: string;
}

export interface S3ProcessRequest {
  s3_key: string;
  effect_chain: EffectConfig[];
}

export interface S3ProcessResponse {
  output_key: string;
  download_url: string;
  effects_applied: string[];
  input_normalized_url: string;
  output_normalized_url: string;
}

// Async processing types
export interface S3ProcessAsyncResponse {
  job_id: string;
  status: string;
}

export interface JobResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  effect_chain: EffectConfig[];
  original_filename?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error_message?: string;
  download_url?: string;
  input_normalized_url?: string;
  output_normalized_url?: string;
}

export interface BatchJobsResponse {
  jobs: JobResponse[];
}
