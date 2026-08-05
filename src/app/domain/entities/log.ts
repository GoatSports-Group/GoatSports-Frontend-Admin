export type Log = {
  logId: string;
  userId: string;
  method: string;
  path: string;
  queryParams: string;
  ipAddress: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  errorMessage: string;
}
