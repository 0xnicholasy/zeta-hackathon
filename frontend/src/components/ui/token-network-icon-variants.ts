import { cva } from "class-variance-authority";

export const tokenNetworkIconVariants = cva(
  "relative bg-white rounded-full flex items-center justify-center",
  {
    variants: {
      size: {
        sm: "w-6 h-6",
        default: "w-8 h-8",
        lg: "w-10 h-10",
        xl: "w-12 h-12",
      },
      shadow: {
        none: "",
        sm: "shadow-sm",
        default: "shadow-lg",
      }
    },
    defaultVariants: {
      size: "default",
      shadow: "default",
    },
  }
);