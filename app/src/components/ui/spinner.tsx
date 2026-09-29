import { OniLoader } from "./oni-loader"

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <OniLoader className={className} size="sm" text="" {...props} />
  )
}

export { Spinner }
