import { CronExpressionParser } from "cron-parser";

// Cron validation — shared between server and client so the rules can't
// drift between the API endpoints, the auto-runner status, and the
// inline form validation. `cron-parser` is a pure-JS library that runs
// in the browser, so importing it from shared/ is safe (small bundle
// cost, but worth it for a single source of truth).
//
// Anything that validates a user-supplied cron string anywhere in the
// app MUST go through `isValidCronExpression` so POST /api/instances,
// PUT /api/instances/[id], the cron-preview endpoint, the auto-runner
// status payload, and the settings form all agree on the rules.

const CRON_ALIAS_REGEX = /^@(yearly|annually|monthly|weekly|daily|hourly)$/i;

function isCronAlias(expr: string): boolean {
  return CRON_ALIAS_REGEX.test(expr.trim());
}

// `true` iff the expression LOOKS like a cron expression: either an
// accepted alias or a 5-field schedule. Doesn't guarantee the schedule
// is semantically reachable — that's `isValidCronExpression`'s job.
export function isCronSyntaxValid(expr: string | null | undefined): boolean {
  if (typeof expr !== "string") return false;
  const trimmed = expr.trim();
  if (!trimmed) return false;
  if (isCronAlias(trimmed)) return true;
  const fields = trimmed.split(/\s+/);
  return fields.length === 5;
}

// Full validator: syntactic check + cron-parser semantic parse. Used
// for write paths (API mutations) and decision points (auto-runner
// rescheduling, UI auto-save gating).
export function isValidCronExpression(
  expr: string | null | undefined,
): boolean {
  if (!isCronSyntaxValid(expr)) return false;
  try {
    CronExpressionParser.parse((expr as string).trim());
    return true;
  } catch {
    return false;
  }
}
