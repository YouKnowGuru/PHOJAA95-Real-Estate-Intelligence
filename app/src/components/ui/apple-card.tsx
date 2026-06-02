import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AppleCardProps {
  hover?: boolean;
  press?: boolean;
  glass?: boolean;
  glow?: boolean;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}

function AppleCard({
  className,
  hover = true,
  press = false,
  glass = false,
  glow = false,
  delay = 0,
  children,
  ...props
}: AppleCardProps) {
  const baseClasses = cn(
    "rounded-2xl border transition-all duration-300",
    glass
      ? "glass-card"
      : "bg-card text-card-foreground border-border/40",
    hover && "card-lift cursor-pointer",
    press && "press-effect",
    glow && "relative overflow-hidden",
    "shadow-apple",
    className
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={baseClasses}
      {...props}
    >
      {glow && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-primary/5 to-transparent" />
        </div>
      )}
      {children}
    </motion.div>
  );
}

function AppleCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 px-5 pt-5 pb-3", className)}
      {...props}
    />
  );
}

function AppleCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-base font-semibold tracking-tight leading-tight", className)}
      {...props}
    />
  );
}

function AppleCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  );
}

function AppleCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

function AppleCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center px-5 pb-5 pt-0", className)}
      {...props}
    />
  );
}

export {
  AppleCard,
  AppleCardHeader,
  AppleCardTitle,
  AppleCardDescription,
  AppleCardContent,
  AppleCardFooter,
};
