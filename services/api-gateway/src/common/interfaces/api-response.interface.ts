export interface ApiMeta {
  requestId: string;
}

export interface ApiSuccess<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
