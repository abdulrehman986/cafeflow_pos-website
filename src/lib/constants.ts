// CafeFlow — shared domain constants
export const BRAND = {
  name: "CafeFlow",
  tagline: "Powerful POS for Modern Cafes & Restaurants",
  supportEmail: "support@cafeflow.app",
} as const;

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  CLIENT: "CLIENT",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CLIENT_STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export const RESTAURANT_STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export const LICENSE_STATUSES = ["PENDING", "ACTIVE", "EXPIRED", "SUSPENDED", "REVOKED"] as const;
export const DEVICE_STATUSES = ["PENDING", "ACTIVE", "BLOCKED", "DEACTIVATED"] as const;
export const ORDER_STATUSES = ["PENDING", "COMPLETED", "REFUNDED", "CANCELLED"] as const;
export const PAYMENT_METHODS = ["CASH", "CARD", "MOBILE", "OTHER"] as const;
export const SYNC_STATUSES = ["SUCCESS", "PARTIAL", "FAILED"] as const;
export const SYNC_RECORD_TYPES = ["SALES", "ORDERS"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A license counts as "expiring soon" within this window. */
export const LICENSE_EXPIRING_SOON_DAYS = 30;
/** POS offline grace period: how long a license stays usable without a successful verification. */
export const LICENSE_GRACE_PERIOD_DAYS = 14;

export const SESSION_COOKIE = "cf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const POS_DEVICE_TOKEN_MAX_AGE = "365d"; // device tokens are long-lived, revocable server-side
