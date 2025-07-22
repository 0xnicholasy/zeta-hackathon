import * as React from "react"
import { ColorRing } from "react-loader-spinner"
import { cn } from "@/lib/utils"

const sizeMap = {
  xs: 16,
  sm: 20,
  default: 24,
  lg: 32,
  xl: 40,
  "2xl": 48,
  "3xl": 64,
}

const colorMap = {
  default: "#3b82f6", // Blue
  zeta: "#008462", // ZetaChain green
  secondary: "#6b7280", // Gray
  muted: "#9ca3af", // Light gray
  accent: "#8b5cf6", // Purple
  destructive: "#ef4444", // Red
  white: "#ffffff",
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
        <ColorRing
          height={sizeMap[size]}
          width={sizeMap[size]}
          colors={[colorMap[variant], colorMap[variant], colorMap[variant], colorMap[variant], colorMap[variant]]}
          wrapperStyle={{}}
          wrapperClass=""
          visible={true}
          ariaLabel="loading"
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