export type Log = {
  logId: string;
  /** Email (thao tác qua API) hoặc mã người dùng (sự kiện từ service). */
  userId: string;
  action: string;
  description: string;
  ipAddress: string;
  /** 0 = sự kiện không qua HTTP. */
  statusCode: number;
  timestamp: string;
  errorMessage: string;
  sourceService?: string | null;
  eventType?: string | null;
  correlationId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  httpMethod?: string | null;
  requestUri?: string | null;
  userAgent?: string | null;
}
