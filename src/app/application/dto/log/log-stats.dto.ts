/** GET /audit-service/api/v1/logs/stats — dem o MongoDB trong [from, to) (gio UTC nhu timestamp da luu). */
/** Một tài khoản đăng nhập thất bại nhiều lần trong cửa sổ theo dõi (mặc định 5 lần / 15 phút). */
export interface FailedLoginBurst {
  account: string;
  attempts: number;
  firstAt: string;
  lastAt: string;
  lastIp: string | null;
}

export interface LogStatsResult {
  from: string;
  to: string;
  totalRequests: number;
  errorRequests: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  activeUsers: number;
  actions: string[];
  /** So request theo tung gio lien tiep tu `from`. */
  hourly: number[];
}
