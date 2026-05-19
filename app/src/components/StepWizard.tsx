import { motion } from "framer-motion";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
  description?: string;
}

interface StepWizardProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function StepWizard({ steps, currentStep, onStepClick, className }: StepWizardProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isClickable = !!(onStepClick && step.id <= currentStep);

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-all",
                  isClickable && "hover:bg-muted/50 cursor-pointer",
                  !isClickable && "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isActive && "border-primary bg-primary/10 text-primary",
                    !isCompleted && !isActive && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Circle className={cn("w-3 h-3", isActive && "fill-primary")} />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className={cn("font-medium text-sm", isActive && "text-primary")}>
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </button>

              {index < steps.length - 1 && (
                <div className="flex-1 mx-2">
                  <div
                    className={cn(
                      "h-0.5 rounded-full transition-all",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StepContentProps {
  children: React.ReactNode;
  isActive: boolean;
}

export function StepContent({ children, isActive }: StepContentProps) {
  return (
    <motion.div
      initial={false}
      animate={{
        opacity: isActive ? 1 : 0,
        height: isActive ? "auto" : 0,
        overflow: "hidden",
      }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
