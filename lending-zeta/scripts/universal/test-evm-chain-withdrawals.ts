import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Testing EVM chain withdrawals with the fixed contract...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("User address:", user.address);
  console.log("Network:", getNetwork(chainId).name);

  // Get contract addresses
  const contractsJson = require("../../contracts.json");
  const universalLendingAddress = contractsJson.networks[chainId.toString()].contracts.UniversalLendingProtocol;

  console.log("UniversalLendingProtocol address:", universalLendingAddress);

  // Connect to the contract
  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = UniversalLendingProtocol.attach(universalLendingAddress);

  // EVM Chain test assets (all should have been affected by the same bug)
  const evmChainAssets = [
    // Arbitrum Sepolia assets
    { symbol: "ETH.ARBI", destinationChain: 421614, decimals: 18, chainName: "Arbitrum Sepolia" },
    { symbol: "USDC.ARBI", destinationChain: 421614, decimals: 6, chainName: "Arbitrum Sepolia" },
    
    // Ethereum Sepolia assets  
    { symbol: "ETH.ETH", destinationChain: 11155111, decimals: 18, chainName: "Ethereum Sepolia" },
    { symbol: "USDC.ETH", destinationChain: 11155111, decimals: 6, chainName: "Ethereum Sepolia" },
    
    // Polygon Amoy assets
    { symbol: "USDC.POL", destinationChain: 80002, decimals: 6, chainName: "Polygon Amoy" },
    { symbol: "POL.POL", destinationChain: 80002, decimals: 18, chainName: "Polygon Amoy" },
    
    // BSC Testnet assets
    { symbol: "USDC.BSC", destinationChain: 97, decimals: 6, chainName: "BSC Testnet" },
    { symbol: "BNB.BSC", destinationChain: 97, decimals: 18, chainName: "BSC Testnet" },
    
    // Base Sepolia assets
    { symbol: "ETH.BASE", destinationChain: 84532, decimals: 18, chainName: "Base Sepolia" },
    { symbol: "USDC.BASE", destinationChain: 84532, decimals: 6, chainName: "Base Sepolia" }
  ];

  const availableAssets = [];
  console.log("\n=== Available EVM Chain Assets ===");
  
  for (const assetDef of evmChainAssets) {
    try {
      const address = getTokenAddress(chainId, assetDef.symbol);
      const supply = await universalLendingProtocol.getSupplyBalance(user.address, address);
      
      if (supply.gt(0)) {
        availableAssets.push({
          ...assetDef,
          address,
          supply
        });
        console.log(`✅ ${assetDef.symbol} → ${assetDef.chainName}: ${utils.formatUnits(supply, assetDef.decimals)} supplied`);
      } else {
        console.log(`⚪ ${assetDef.symbol} → ${assetDef.chainName}: 0 supplied (skipping)`);
      }
    } catch (error) {
      console.log(`❌ ${assetDef.symbol} → ${assetDef.chainName}: Not found or error`);
    }
  }

  if (availableAssets.length === 0) {
    console.log("\n❌ No EVM chain assets with supply balance found for testing");
    console.log("💡 Suggestion: Supply some assets first to test cross-chain withdrawals");
    return;
  }

  console.log(`\n=== Testing ${availableAssets.length} EVM Chain Withdrawal Scenarios ===`);

  const IERC20_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];

  for (const asset of availableAssets) {
    console.log(`\n--- Testing ${asset.symbol} → ${asset.chainName} Withdrawal ---`);
    
    try {
      // Get gas requirements
      const [gasZRC20Address, gasFeeAmount] = await universalLendingProtocol.getWithdrawGasFee(asset.address);
      
      // Determine gas token symbol
      let gasTokenSymbol = "UNKNOWN";
      for (const gasAsset of evmChainAssets) {
        try {
          const gasAddress = getTokenAddress(chainId, gasAsset.symbol);
          if (gasAddress.toLowerCase() === gasZRC20Address.toLowerCase()) {
            gasTokenSymbol = gasAsset.symbol;
            break;
          }
        } catch (e) {
          // Skip
        }
      }
      
      console.log(`Gas token: ${gasTokenSymbol} (${gasZRC20Address})`);
      console.log(`Gas fee: ${utils.formatUnits(gasFeeAmount, 9)} tokens`);
      
      // Determine withdrawal scenario type
      const isSameTokenGas = asset.address.toLowerCase() === gasZRC20Address.toLowerCase();
      console.log(`Withdrawal scenario: ${isSameTokenGas ? '✅ Same token (gas deducted from withdrawal)' : '⚠️  Different token (user pays separate gas)'}`);
      
      // This is the scenario that was broken and should now be fixed
      if (!isSameTokenGas) {
        console.log(`🔧 This scenario was affected by the 0x10bad147 bug and should now be fixed!`);
      }
      
      // Test small withdrawal (10% of supply)
      const testAmount = asset.supply.div(10);
      console.log(`Test amount: ${utils.formatUnits(testAmount, asset.decimals)} ${asset.symbol}`);
      
      // Check if withdrawal is possible (health factor)
      const canWithdraw = await universalLendingProtocol.canWithdraw(user.address, asset.address, testAmount);
      console.log(`Can withdraw (health factor): ${canWithdraw ? '✅ Yes' : '❌ No'}`);
      
      if (!canWithdraw) {
        console.log(`❌ Cannot test ${asset.symbol} - would break collateral requirements`);
        continue;
      }
      
      // For different token scenario, check user gas balance
      if (!isSameTokenGas) {
        const gasToken = new ethers.Contract(gasZRC20Address, IERC20_ABI, user);
        const userGasBalance = await gasToken.balanceOf(user.address);
        const userGasAllowance = await gasToken.allowance(user.address, universalLendingAddress);
        
        console.log(`User gas balance: ${utils.formatUnits(userGasBalance, 9)} ${gasTokenSymbol}`);
        console.log(`User gas allowance: ${utils.formatUnits(userGasAllowance, 9)} ${gasTokenSymbol}`);
        
        if (userGasBalance.lt(gasFeeAmount)) {
          console.log(`❌ User has insufficient ${gasTokenSymbol} for gas fees`);
          console.log(`   Need: ${utils.formatUnits(gasFeeAmount, 9)} ${gasTokenSymbol}`);
          console.log(`   Have: ${utils.formatUnits(userGasBalance, 9)} ${gasTokenSymbol}`);
          continue;
        }
        
        if (userGasAllowance.lt(gasFeeAmount)) {
          console.log(`⚠️  User needs to approve ${gasTokenSymbol} for gas fees`);
          console.log(`   Need allowance: ${utils.formatUnits(gasFeeAmount, 9)} ${gasTokenSymbol}`);
          console.log(`   Current allowance: ${utils.formatUnits(userGasAllowance, 9)} ${gasTokenSymbol}`);
        }
      }
      
      console.log(`✅ Prerequisites checked for ${asset.symbol} withdrawal`);
      
      // Static call test to check for the old error
      try {
        const destination = ethers.utils.solidityPack(["address"], [user.address]);

        await universalLendingProtocol.callStatic.withdrawCrossChain(
          asset.address,
          testAmount,
          asset.destinationChain,
          destination
        );
        
        console.log(`✅ Static call PASSED - no 0x10bad147 error!`);
        console.log(`🎉 Fix is working for ${asset.symbol} → ${asset.chainName}`);
        
      } catch (staticError: any) {
        if (staticError.data === "0x10bad147") {
          console.log(`❌ Still getting 0x10bad147 error - fix may not be deployed yet`);
          console.log(`   This confirms ${asset.symbol} was affected by the bug`);
        } else {
          console.log(`⚠️  Different error (may be expected): ${staticError.message}`);
          if (staticError.data) {
            console.log(`   Error data: ${staticError.data}`);
          }
          
          // Try to decode the error
          try {
            const iface = new ethers.utils.Interface([
              "error AssetNotSupported(address asset)",
              "error InvalidAmount()",
              "error InsufficientBalance()",
              "error InsufficientCollateral()",
              "error InsufficientLiquidity()",
              "error InsufficientGasFee(address gasTokenAddress, uint256 required, uint256 available)"
            ]);
            
            const decoded = iface.parseError(staticError.data);
            console.log(`   Decoded error: ${decoded.name}`);
            if (decoded.args && decoded.args.length > 0) {
              console.log(`   Error args:`, decoded.args);
            }
          } catch (decodeError) {
            // Could not decode
          }
        }
      }
      
    } catch (error: any) {
      console.error(`❌ Error testing ${asset.symbol}:`, error.message);
    }
  }

  console.log("\n=== EVM Chain Withdrawal Test Summary ===");
  console.log("This script tests cross-chain withdrawals to various EVM chains:");
  console.log("• Arbitrum Sepolia (Chain ID: 421614)");
  console.log("• Ethereum Sepolia (Chain ID: 11155111)"); 
  console.log("• Polygon Amoy (Chain ID: 80002)");
  console.log("• BSC Testnet (Chain ID: 97)");
  console.log("• Base Sepolia (Chain ID: 84532)");
  console.log("");
  console.log("🔧 The fix should resolve 0x10bad147 errors for ALL chains where:");
  console.log("   withdrawal_asset ≠ gas_token");
  console.log("");
  console.log("Examples that should now work:");
  console.log("• USDC.ARBI → Arbitrum (gas paid in ETH.ARBI)");
  console.log("• USDC.ETH → Ethereum (gas paid in ETH.ETH)");  
  console.log("• USDC.POL → Polygon (gas paid in POL.POL)");
  console.log("• USDC.BSC → BSC (gas paid in BNB.BSC)");
  console.log("• USDC.BASE → Base (gas paid in ETH.BASE)");

  console.log("\n=== Next Steps ===");
  console.log("1. If static calls pass → The fix works for EVM chains too! ✅");
  console.log("2. If static calls fail with 0x10bad147 → Need to redeploy contract");
  console.log("3. Test actual withdrawals with small amounts");
  console.log("4. Verify assets arrive on destination chains");
  console.log("5. Monitor for successful cross-chain transactions");
  
  const affectedScenarios = availableAssets.filter(asset => {
    // Try to determine if this asset would use different gas token
    try {
      // Most USDC assets use native tokens (ETH, BNB, POL) as gas
      return asset.symbol.startsWith("USDC.");
    } catch {
      return false;
    }
  });
  
  if (affectedScenarios.length > 0) {
    console.log(`\n🎯 High Priority: Test these ${affectedScenarios.length} scenarios (most likely affected by bug):`);
    affectedScenarios.forEach(asset => {
      console.log(`   • ${asset.symbol} → ${asset.chainName} (${utils.formatUnits(asset.supply, asset.decimals)} available)`);
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });