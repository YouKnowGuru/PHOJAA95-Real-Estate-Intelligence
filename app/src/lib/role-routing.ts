/** Default landing route after login for each local auth role. */
export function getHomeRouteForRole(role?: string | null): string {
  switch (role) {
    case "architecture_staff":
      return "/architecture";
    case "developer":
      return "/software-dev";
    case "admin":
      return "/";
    case "staff":
    default:
      return "/";
  }
}

export function isRealEstateStaffRole(role?: string | null): boolean {
  return role === "staff";
}

export function isArchitectureStaffRole(role?: string | null): boolean {
  return role === "architecture_staff";
}

export function isDeveloperRole(role?: string | null): boolean {
  return role === "developer";
}

export function formatStaffRoleLabel(role?: string | null): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "developer":
      return "Software Developer";
    case "architecture_staff":
      return "Architecture Staff";
    case "staff":
      return "Real Estate Staff";
    default:
      return role || "User";
  }
}

/** Roles that receive salary through the shared payroll table (excludes admin). */
export const PAYROLL_ELIGIBLE_ROLES = ["staff", "developer", "architecture_staff"] as const;
export type PayrollEligibleRole = (typeof PAYROLL_ELIGIBLE_ROLES)[number];

export function isPayrollEligibleRole(role?: string | null): role is PayrollEligibleRole {
  return PAYROLL_ELIGIBLE_ROLES.includes(role as PayrollEligibleRole);
}
