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
          {/* Sonar ripples expanding outward, staggered */}
          <span aria-hidden className="oni-ripple oni-ripple-1" />
          <span aria-hidden className="oni-ripple oni-ripple-2" />
          <span aria-hidden className="oni-ripple oni-ripple-3" />

          {/* Soft glow behind the logo */}
          <span aria-hidden className="oni-glow" />

          {/* The brand mark, gently breathing */}
          <img src="/loader.png" alt="" className="oni-mask" />

          {/* Light sweep masked to the logo's alpha shape */}
          <span aria-hidden className="oni-mask-sweep" />

          {/* Orbiting glow dots */}
          <span aria-hidden className="oni-orbit">
            <span className="oni-orbit-dot oni-orbit-dot-1" />
            <span className="oni-orbit-dot oni-orbit-dot-2" />
            <span className="oni-orbit-dot oni-orbit-dot-3" />
          </span>
        </div>
      </div>
      {text && (
        <div className="oni-text-container">
          <p className="oni-loading-text">{text}</p>
        </div>
      )}
    </div>
  )
}

export { OniLoader }
