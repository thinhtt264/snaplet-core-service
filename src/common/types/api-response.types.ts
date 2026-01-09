/**
 * Interface định nghĩa cấu trúc response chuẩn của API
 * Được sử dụng thống nhất cho cả success responses (TransformInterceptor) và error responses (HttpExceptionFilter)
 */
export interface ApiResponse<T = any> {
  status: {
    code: number;
    message: string;
    meta?: {
      errorCode?: string;
      message?: string;
      [key: string]: any;
    };
  };
  data: T | null;
}
