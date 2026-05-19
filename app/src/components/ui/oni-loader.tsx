import { cn } from "@/lib/utils"

interface OniLoaderProps {
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
  text?: string
}

const sizeClasses = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-48 h-48",
}

function OniLoader({ className, size = "lg", text = "Loading..." }: OniLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      <div className="oni-loader-container">
        <div className={cn("oni-mask-wrapper", sizeClasses[size])}>
          <img
            src="/loader.png"
            alt="Loading"
            className="oni-mask"
          />
          <div className="oni-glow" />
          <div className="oni-ring" />
          <div className="oni-ring oni-ring-delayed" />
        </div>
      </div>
      {text && (
        <div className="oni-text-container">
          <p className="oni-loading-text">{text}</p>
          <div className="oni-dots">
            <span className="oni-dot" />
            <span className="oni-dot oni-dot-delay-1" />
            <span className="oni-dot oni-dot-delay-2" />
          </div>
        </div>
      )}
    </div>
  )
}

export { OniLoader }
