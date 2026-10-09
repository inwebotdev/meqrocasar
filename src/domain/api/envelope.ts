/** Successful API response envelope. */
export interface ApiOk<T> {
  ok: true;
  data: T;
}

/** Error codes returned by this app's API routes. */
export type ApiErrorCode = "invalid_json" | "invalid_answers" | "internal";

/** Failed API response envelope. */
export interface ApiError {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /** Zod issues, when the failure came from a schema validation. */
    issues?: unknown;
  };
}

export type ApiResponse<T> = ApiOk<T> | ApiError;
