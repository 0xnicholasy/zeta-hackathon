import * as React from "react"
import { Hourglass } from "react-loader-spinner"
import { cn } from "@/lib/utils"

const sizeMap = {
  xs: 16,
  sm: 20,
  default: 24,
  lg: 32,
  xl: 40,
  "2xl": 48,
  "3xl": 56,
}

const colorMap = {
  default: "#3b82f6", // Blue
  zeta: "#008462", // ZetaChain green
  secondary: "#6b7280", // Gray
  muted: "#9ca3af", // Light gray
  accent: "#8b5cf6", // Purple
  destructive: "#ef4444", // Red
  white: "#ffffff",
  success: "#10b981", // Green
  warning: "#f59e0b", // Amber
}

export interface HourglassLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Color variant of the hourglass
   */
  variant?: keyof typeof colorMap
  /**
   * Size of the hourglass
   */
  size?: keyof typeof sizeMap
  /**
   * Show text alongside the hourglass
   */
  text?: string
  /**
   * Position of the text relative to hourglass
   */
  textPosition?: "right" | "bottom"
}

const HourglassLoader = React.forwardRef<HTMLDivElement, HourglassLoaderProps>(
  (
    {
      className,
      variant = "zeta",
      size = "default",
      text,
      textPosition = "bottom",
      ...props
    },
    ref
  ) => {
    const hourglassElement = (
      <div
        className={cn("inline-flex items-center justify-center", className)}
        role="status"
        aria-label="Loading"
        {...props}
        ref={ref}
      >
        <Hourglass
          height={sizeMap[size]}
          width={sizeMap[size]}
          colors={[colorMap[variant], colorMap[variant]]}
          wrapperStyle={{}}
          wrapperClass=""
          visible={true}
          ariaLabel="hourglass-loading"
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
          {hourglassElement}
          <span className="text-sm text-muted-foreground">{text}</span>
        </div>
      )
    }

    return hourglassElement
  }
)

HourglassLoader.displayName = "HourglassLoader"

// Static hourglass icon (non-animated) for inline use
const StaticHourglass = React.forwardRef<HTMLDivElement, Omit<HourglassLoaderProps, 'text' | 'textPosition'>>(
  (
    {
      className,
      variant = "muted",
      size = "xs",
      ...props
    },
    ref
  ) => {
    return (
      <div
        className={cn("inline-flex items-center justify-center", className)}
        role="status"
        aria-label="Processing"
        {...props}
        ref={ref}
      >
        {/* Static hourglass using a simple SVG or Unicode symbol */}
        <span 
          className={cn("inline-block", `text-[${sizeMap[size]}px]`)}
          style={{ fontSize: `${sizeMap[size]}px`, color: colorMap[variant] }}
        >
          ⧗
        </span>
      </div>
    );
  }
);

StaticHourglass.displayName = "StaticHourglass";

export { HourglassLoader, StaticHourglass }