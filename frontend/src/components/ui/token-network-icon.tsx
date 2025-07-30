import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { TokenIcon, NetworkIcon } from '@web3icons/react';
import { tokenNetworkIconVariants } from "./token-network-icon-variants";

const tokenIconSizeMap = {
  sm: "w-4 h-4",
  default: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-10 h-10",
};

const networkIconSizeMap = {
  sm: "w-3 h-3",
  default: "w-3 h-3",
  lg: "w-4 h-4",
  xl: "w-5 h-5",
};

export interface TokenNetworkIconProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof tokenNetworkIconVariants> {
  tokenSymbol: string;
  networkSymbol?: string;
  sourceChain?: string;
  isNative?: boolean;
  showNativeIndicator?: boolean;
}

const TokenNetworkIcon = React.forwardRef<HTMLDivElement, TokenNetworkIconProps>(
  ({
    className,
    size,
    shadow,
    tokenSymbol,
    networkSymbol,
    sourceChain,
    isNative = false,
    showNativeIndicator = false,
    ...props
  }, ref) => {
    const tokenIconSize = tokenIconSizeMap[size ?? 'default'];
    const networkIconSize = networkIconSizeMap[size ?? 'default'];

    // Extract base token symbol (remove network suffix like .ARBI, .ETH)
    const baseTokenSymbol: string = tokenSymbol.includes('.') ? tokenSymbol.split('.').at(0) ?? "" : tokenSymbol;

    // Determine network icon based on sourceChain or networkSymbol
    const renderNetworkIcon = () => {
      if (networkSymbol) {
        return <NetworkIcon name={networkSymbol} className={cn(networkIconSize, "text-zeta-700")} />;
      }

      if (sourceChain) {
        if (sourceChain.toLowerCase().includes("arb")) {
          return <NetworkIcon name="arbitrum-one" className={cn(networkIconSize, "text-zeta-700")} />;
        } else if (sourceChain.toLowerCase().includes("eth")) {
          return <NetworkIcon name="ethereum" className={cn(networkIconSize, "text-zeta-700")} />;
        }
        else if (sourceChain.toLowerCase().includes("base")) {
          return <NetworkIcon name="base" className={cn(networkIconSize, "text-zeta-700")} />;
        }
        else if (sourceChain.toLowerCase().includes("bsc")) {
          return <NetworkIcon name="bsc" className={cn(networkIconSize, "text-zeta-700")} />;
        }
        else if (sourceChain.toLowerCase().includes("pol")) {
          return <NetworkIcon name="polygon" className={cn(networkIconSize, "text-zeta-700")} />;
        }
      }

      // Default to ZetaChain icon
      return <div className={cn(networkIconSize, "bg-zeta-500 rounded-full")}></div>;
    };

    return (
      <div
        ref={ref}
        className={cn(tokenNetworkIconVariants({ size, shadow, className }))}
        {...props}
      >
        {/* Main Token Icon */}
        <TokenIcon
          symbol={baseTokenSymbol}
          className={cn(tokenIconSize, "text-zeta-700")}
        />

        {/* Native Token Indicator */}
        {isNative && showNativeIndicator && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
        )}

        {/* Network Indicator */}
        {(sourceChain ?? networkSymbol) && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-md">
            {renderNetworkIcon()}
          </div>
        )}
      </div>
    );
  }
);

TokenNetworkIcon.displayName = "TokenNetworkIcon";

export { TokenNetworkIcon };