import { z } from "zod";
import {
  CLIENT_STATUSES,
  RESTAURANT_STATUSES,
  LICENSE_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from "@/lib/constants";

const phone = z
  .string()
  .trim()
  .min(5, "Phone must be at least 5 characters")
  .max(30)
  .optional()
  .or(z.literal(""));

const email = z.string().trim().toLowerCase().email("Enter a valid email address");

// ─────────────────────────── Auth ───────────────────────────

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(80),
  phone,
});

// ─────────────────────────── Admin: clients ───────────────────────────

export const createClientSchema = z.object({
  name: z.string().trim().min(2, "Contact name is required").max(80),
  email,
  phone,
  companyName: z.string().trim().min(2, "Business name is required").max(120),
  notes: z.string().max(500).optional(),
});

export const updateClientSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: email.optional(),
  phone,
  companyName: z.string().trim().min(2).max(120).optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
});

// ─────────────────────────── Admin: restaurants ───────────────────────────

export const createRestaurantSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  name: z.string().trim().min(2, "Restaurant name is required").max(100),
  city: z.string().trim().max(60).optional(),
  address: z.string().trim().max(200).optional(),
  phone,
});

export const updateRestaurantSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  city: z.string().trim().max(60).optional(),
  address: z.string().trim().max(200).optional(),
  phone,
  status: z.enum(RESTAURANT_STATUSES).optional(),
});

// ─────────────────────────── Admin: licenses ───────────────────────────

export const generateLicenseSchema = z.object({
  restaurantId: z.string().uuid("Select a restaurant"),
  maxDevices: z.coerce.number().int().min(1, "At least 1 device").max(20).default(1),
  expiresInMonths: z.coerce.number().int().min(1).max(60).default(12),
});

export const updateLicenseSchema = z.object({
  status: z.enum(LICENSE_STATUSES).optional(),
  maxDevices: z.coerce.number().int().min(1).max(20).optional(),
  // ISO date or explicit extension in months — one or the other
  expiresAt: z.string().datetime().optional(),
  extendMonths: z.coerce.number().int().min(1).max(60).optional(),
});

// ─────────────────────────── Admin: devices ───────────────────────────

export const updateDeviceSchema = z.object({
  status: z.enum(["ACTIVE", "BLOCKED", "DEACTIVATED"]),
});

// ─────────────────────────── POS API ───────────────────────────

export const posActivateSchema = z.object({
  licenseKey: z
    .string()
    .trim()
    .regex(/^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i, "License key must look like CF-XXXX-XXXX-XXXX"),
  deviceIdentifier: z.string().trim().min(3).max(100),
  deviceName: z.string().trim().max(100).optional(),
  osInfo: z.string().trim().max(150).optional(),
  appVersion: z.string().trim().max(40).optional(),
});

export const posVerifySchema = z.object({
  licenseKey: z.string().trim().min(5),
  deviceIdentifier: z.string().trim().min(3).max(100).optional(),
  appVersion: z.string().trim().max(40).optional(),
});

export const posSaleRecordSchema = z.object({
  localSaleId: z.string().min(1, "localSaleId is required").max(64),
  saleNumber: z.string().max(40).optional(),
  saleDate: z.string().datetime({ offset: true }, { message: "saleDate must be ISO 8601" }),
  subtotal: z.coerce.number().min(0).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  tax: z.coerce.number().min(0).optional().default(0),
  total: z.coerce.number().min(0),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(ORDER_STATUSES).optional().default("COMPLETED"),
  customerCount: z.coerce.number().int().min(0).optional(),
});

export const posSalesSyncSchema = z.object({
  sales: z.array(posSaleRecordSchema).min(1, "No sales provided").max(500),
  batchId: z.string().max(64).optional(),
});

export const posOrderItemSchema = z.object({
  localItemId: z.string().max(64).optional(),
  name: z.string().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: z.coerce.number().min(0),
  total: z.coerce.number().min(0).optional(),
  category: z.string().max(60).optional(),
});

export const posOrderRecordSchema = z.object({
  localOrderId: z.string().min(1, "localOrderId is required").max(64),
  orderNumber: z.string().min(1).max(40),
  orderDate: z.string().datetime({ offset: true }, { message: "orderDate must be ISO 8601" }),
  subtotal: z.coerce.number().min(0).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  tax: z.coerce.number().min(0).optional().default(0),
  total: z.coerce.number().min(0),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(ORDER_STATUSES).optional().default("COMPLETED"),
  customerCount: z.coerce.number().int().min(0).optional(),
  items: z.array(posOrderItemSchema).max(200).optional().default([]),
});

export const posOrdersSyncSchema = z.object({
  orders: z.array(posOrderRecordSchema).min(1, "No orders provided").max(500),
  batchId: z.string().max(64).optional(),
});

// ─────────────────────────── Shared query schemas ───────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const salesQuerySchema = paginationSchema.extend({
  restaurantId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  search: z.string().max(60).optional(),
});

export const ordersQuerySchema = paginationSchema.extend({
  restaurantId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().max(60).optional(),
});
