import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const spinnerVariants = cva(
  "animate-spin rounded-full border-solid border-t-transparent",
  {
    variants: {
      variant: {
        default: "border-primary",
        zeta: "border-zeta-500",
        secondary: "border-secondary",
        muted: "border-muted-foreground",
        accent: "border-accent",
        destructive: "border-destructive",
        white: "border-white",
      },
      size: {
        xs: "h-3 w-3 border-[1px]",
        sm: "h-4 w-4 border-[1.5px]",
        default: "h-5 w-5 border-2",
        lg: "h-6 w-6 border-2",
        xl: "h-8 w-8 border-[3px]",
        "2xl": "h-10 w-10 border-[3px]",
        "3xl": "h-12 w-12 border-4",
      },
      speed: {
        slow: "animate-[spin_2s_linear_infinite]",
        normal: "animate-spin",
        fast: "animate-[spin_0.5s_linear_infinite]",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      speed: "normal",
    },
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
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
    variant, 
    size, 
    speed, 
    text, 
    textPosition = "right",
    ...props 
  }, ref) => {
    const spinnerElement = (
      <div
        className={cn(spinnerVariants({ variant, size, speed, className }))}
        role="status"
        aria-label="Loading"
        {...props}
        ref={ref}
      />
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

export { Spinner, spinnerVariants }