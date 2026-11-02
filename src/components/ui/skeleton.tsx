import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("md-skeleton relative overflow-hidden rounded-md bg-foreground/15", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
