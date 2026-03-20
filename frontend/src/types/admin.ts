export type DeviceStatus = "ACTIVE" | "DEACTIVATED" | "PENDING_ACTIVATION" | "REMOVED";

export type DeviceHealthStatus = "GOOD" | "OFFLINE" | "TAMPERED";

export interface AdminDeviceSummary {
  device_id: string;
  location: string;
  owner_email: string | null;
  status: DeviceStatus | string;
  relay_state: string;
  tampered: boolean;
  health_status: DeviceHealthStatus;
  lifetime_units: number;
  current_month_units: number;
}

export interface AdminUserOverview {
  user_id: string;
  email: string;
  device_count: number;
  active_device_count: number;
  current_month_units: number;
  lifetime_units: number;
  unpaid_bills: number;
  overdue_bills: number;
  due_amount: number;
  last_seen_at: string | null;
}

export interface AdminPricingResponse {
  price_per_unit: number;
}

export interface AdminRuntimeConfigResponse {
  device_data_interval_seconds: number;
}

export interface AdminConsumptionTrendPoint {
  date: string;
  units: number;
}

export interface AdminDueTrendPoint {
  date: string;
  due_amount: number;
  unpaid_count: number;
  overdue_count: number;
}

export interface AdminAnalyticsTrendsResponse {
  start_date: string;
  end_date: string;
  consumption_daily: AdminConsumptionTrendPoint[];
  dues_daily: AdminDueTrendPoint[];
}
