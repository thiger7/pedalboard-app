export interface Effect {
  id: string;
  name: string;
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
