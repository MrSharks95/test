import type { DeadlineStatus, WithdrawalRule } from "@/lib/withdrawal/types";

/**
 * Legal withdrawal deadline engine — country × product category, with
 * exemptions and fallbacks. Pure TypeScript, no I/O: rules are injected so the
 * logic is fully unit-testable. All dates computed in UTC, end of day.
 */

export interface DeadlineRule {
  coolingOffDays: number;
  isExempt: boolean;
  legalRef: string | null;
}

export interface RuleResolver {
  /** Resolve a rule for an exact (country, category), or null. */
  resolve(country: string, category: string): DeadlineRule | null;
  /** Shop fallback country when the customer country has no rule. */
  defaultCountry: string;
}

export interface ComputeDeadlineParams {
  shippedAt: Date | string | null;
  country: string;
  category: string;
  receivedAt?: Date | string | null;
  rules: RuleResolver;
  /** Injectable clock for testing; defaults to now(). */
  now?: Date;
}

export interface DeadlineResult {
  status: DeadlineStatus; // within | late | exempt | unknown
  deadlineAt: Date | null;
  refundDeadlineAt: Date | null;
  coolingOffDays: number;
  legalRef: string | null;
  /** True when no matching rule was found and the 14-day default was used. */
  usedFallback: boolean;
}

const STANDARD_DAYS = 14;
const REFUND_DAYS = 14;

function ruleKey(country: string, category: string): string {
  return `${country.toUpperCase()}:${category}`;
}

/** Build a RuleResolver from the seeded withdrawal_rules rows. */
export function createRuleSet(
  rules: WithdrawalRule[],
  defaultCountry: string,
): RuleResolver {
  const map = new Map<string, DeadlineRule>();
  for (const r of rules) {
    map.set(ruleKey(r.countryCode, String(r.productCategory)), {
      coolingOffDays: r.coolingOffDays,
      isExempt: r.isExempt,
      legalRef: r.legalRef,
    });
  }
  return {
    defaultCountry,
    resolve: (country, category) =>
      map.get(ruleKey(country, category)) ?? null,
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** End of day (UTC) `days` after the given base date. */
function deadlineFrom(base: Date, days: number): Date {
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + days,
      23,
      59,
      59,
      999,
    ),
  );
}

export function computeDeadline(params: ComputeDeadlineParams): DeadlineResult {
  const { country, category, rules } = params;

  // 1. Resolve the rule: exact country, else shop default country.
  let rule = rules.resolve(country, category);
  if (!rule && country.toUpperCase() !== rules.defaultCountry.toUpperCase()) {
    rule = rules.resolve(rules.defaultCountry, category);
  }

  // 2. Final fallback: 14-day standard, status stays 'unknown' (logged).
  let usedFallback = false;
  if (!rule) {
    rule = { coolingOffDays: STANDARD_DAYS, isExempt: false, legalRef: null };
    usedFallback = true;
  }

  const received = toDate(params.receivedAt ?? null);
  const refundDeadlineAt = received ? deadlineFrom(received, REFUND_DAYS) : null;

  // 3. Exemption short-circuits: no deadline, no refund window.
  if (rule.isExempt) {
    return {
      status: "exempt",
      deadlineAt: null,
      refundDeadlineAt: null,
      coolingOffDays: rule.coolingOffDays,
      legalRef: rule.legalRef,
      usedFallback,
    };
  }

  // 4. Without a ship date we can't place the deadline → unknown.
  const shipped = toDate(params.shippedAt);
  if (!shipped) {
    return {
      status: "unknown",
      deadlineAt: null,
      refundDeadlineAt,
      coolingOffDays: rule.coolingOffDays,
      legalRef: rule.legalRef,
      usedFallback,
    };
  }

  const deadlineAt = deadlineFrom(shipped, rule.coolingOffDays);
  const now = params.now ?? new Date();
  const status: DeadlineStatus = usedFallback
    ? "unknown"
    : now.getTime() <= deadlineAt.getTime()
      ? "within"
      : "late";

  return {
    status,
    deadlineAt,
    refundDeadlineAt,
    coolingOffDays: rule.coolingOffDays,
    legalRef: rule.legalRef,
    usedFallback,
  };
}
