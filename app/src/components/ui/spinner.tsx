import { OniLoader } from "./oni-loader"
import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <OniLoader className={className} size="sm" text="" {...props} />
  )
}

export { Spinner }
