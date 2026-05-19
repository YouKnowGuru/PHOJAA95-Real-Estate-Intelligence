import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
    password: string;
    className?: string;
}

/**
 * Password strength indicator that shows requirements and strength level.
 * Requirements:
 * - At least 8 characters
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number
 * - Contains special character
 */
export function PasswordStrength({ password, className }: PasswordStrengthProps) {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };

    const passedCount = Object.values(checks).filter(Boolean).length;
    const strengthPercent = (passedCount / 5) * 100;

    const strengthLabel =
        passedCount <= 1 ? "Very Weak"
            : passedCount === 2 ? "Weak"
                : passedCount === 3 ? "Fair"
                    : passedCount === 4 ? "Strong"
                        : "Very Strong";

    const strengthColor =
        passedCount <= 1 ? "bg-red-500"
            : passedCount === 2 ? "bg-orange-500"
                : passedCount === 3 ? "bg-yellow-500"
                    : passedCount === 4 ? "bg-emerald-500"
                        : "bg-emerald-600";

    const labelColor =
        passedCount <= 1 ? "text-red-500"
            : passedCount === 2 ? "text-orange-500"
                : passedCount === 3 ? "text-yellow-600"
                    : passedCount === 4 ? "text-emerald-500"
                        : "text-emerald-600";

    return (
        <div className={cn("space-y-2", className)}>
            {/* Strength bar */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-300", strengthColor)}
                        style={{ width: `${strengthPercent}%` }}
                    />
                </div>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", labelColor)}>
                    {strengthLabel}
                </span>
            </div>

            {/* Requirement checklist */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {[
                    { key: "length", label: "8+ characters" },
                    { key: "uppercase", label: "Uppercase" },
                    { key: "lowercase", label: "Lowercase" },
                    { key: "number", label: "Number" },
                    { key: "special", label: "Special char" },
                ].map(({ key, label }) => {
                    const passed = checks[key as keyof typeof checks];
                    return (
                        <div key={key} className="flex items-center gap-1.5">
                            <div
                                className={cn(
                                    "h-1 w-1 rounded-full",
                                    passed ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                                )}
                            />
                            <span
                                className={cn(
                                    "text-[10px] font-medium",
                                    passed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                                )}
                            >
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}