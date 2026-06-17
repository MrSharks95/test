/**
 * Core withdrawal domain types. Pure TypeScript, no UI / no I/O — mirrors the
 * `withdrawals` / `withdrawal_rules` tables from migration 001.
 */

export type ProductCategory =
  | "standard"
  | "custom"
  | "perishable"
  | "digital_unsealed";

export type DeadlineStatus = "within" | "late" | "exempt" | "unknown";

export type WithdrawalStatus = "new" | "in_progress" | "done" | "refused";

export interface WithdrawalItem {
  title: string;
  quantity: number;
  /** Shopify line item id when the order was verified; null for manual entry. */
  lineItemId?: string | null;
}

export interface WithdrawalRule {
  countryCode: string;
  productCategory: ProductCategory | string;
  coolingOffDays: number;
  isExempt: boolean;
  legalRef: string | null;
}
