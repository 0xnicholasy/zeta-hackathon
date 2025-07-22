import * as React from "react"
import { MoonLoader } from "react-spinners"
import { cn } from "@/lib/utils"

const sizeMap = {
  xs: 12,
  sm: 16,
  default: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 48,
}

const colorMap = {
  default: "hsl(var(--primary))",
  zeta: "hsl(var(--zeta-500))",
  secondary: "hsl(var(--secondary-foreground))",
  muted: "hsl(var(--muted-foreground))",
  accent: "hsl(var(--accent-foreground))",
  destructive: "hsl(var(--destructive))",
  white: "#ffffff",
}

const speedMap = {
  slow: 0.4,
  normal: 0.7,
  fast: 1.3,
}

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Color variant of the spinner
   */
  variant?: keyof typeof colorMap
  /**
   * Size of the spinner
   */
  size?: keyof typeof sizeMap
  /**
   * Animation speed
   */
  speed?: keyof typeof speedMap
  /**
   * Show text alongside the spinner
   */
  text?: string
  /**
   * Position of the text relative to spinner
   */
  textPosition?: "right" | "bottom"
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({
    className,
    variant = "default",
    size = "default",
    speed = "normal",
    text,
    textPosition = "right",
    ...props
  }, ref) => {
    const spinnerElement = (
      <div
        className={cn("inline-block", className)}
        role="status"
        aria-label="Loading"
        {...props}
        ref={ref}
      >
        <MoonLoader
          size={sizeMap[size]}
          color={colorMap[variant]}
          speedMultiplier={speedMap[speed]}
        />
      </div>
    )

    if (text) {
      return (
        <div
          className={cn(
            "flex items-center",
            textPosition === "bottom" ? "flex-col gap-2" : "gap-2"
          )}
        >
          {spinnerElement}
          <span className="text-sm text-muted-foreground">{text}</span>
        </div>
      )
    }

    return spinnerElement
  }
)
Spinner.displayName = "Spinner"

export { Spinner }