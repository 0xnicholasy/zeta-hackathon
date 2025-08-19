import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Debugging USDC.SOL withdrawal revert...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("User address:", user.address);

  // Get contract addresses
  const contractsJson = require("../../contracts.json");
  const universalLendingAddress = contractsJson.networks[chainId.toString()].contracts.UniversalLendingProtocol;
  const usdcSolAddress = getTokenAddress(chainId, "USDC.SOL");
  const solSolAddress = getTokenAddress(chainId, "SOL.SOL");

  // Connect to contracts
  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = UniversalLendingProtocol.attach(universalLendingAddress);

  const testAmount = ethers.utils.parseUnits("0.1", 6); // 0.1 USDC
  const solanaDestinationAddress = "5t8QFUT3aGoeFx89c2qTh5JBhmCUTeFxRH9fSmLhMTX6";
  const solanaAddressBytes = ethers.utils.toUtf8Bytes(solanaDestinationAddress);

  console.log("\n=== Static Call Test (should show revert reason) ===");
  
  try {
    // Try static call first to see the revert reason
    await universalLendingProtocol.callStatic.withdrawCrossChain(
      usdcSolAddress,
      testAmount,
      901, // Solana Devnet
      solanaAddressBytes
    );
    console.log("✅ Static call succeeded - withdrawal should work");
  } catch (staticError: any) {
    console.error("❌ Static call failed:");
    console.error("Error message:", staticError.message);
    console.error("Error reason:", staticError.reason);
    
    if (staticError.data) {
      console.error("Error data:", staticError.data);
      
      // Try to decode custom error
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
        console.error("🔍 Decoded error:", decoded.name);
        if (decoded.args) {
          console.error("Error args:", decoded.args);
        }
      } catch (decodeError) {
        console.error("Could not decode error");
      }
    }
  }

  console.log("\n=== Detailed Pre-Flight Checks ===");
  
  // Check all preconditions
  const userSupply = await universalLendingProtocol.getSupplyBalance(user.address, usdcSolAddress);
  console.log("User USDC.SOL supply:", utils.formatUnits(userSupply, 6));
  
  const assetConfig = await universalLendingProtocol.getAssetConfig(usdcSolAddress);
  console.log("USDC.SOL supported:", assetConfig.isSupported);
  
  const canWithdraw = await universalLendingProtocol.canWithdraw(user.address, usdcSolAddress, testAmount);
  console.log("Can withdraw test amount:", canWithdraw);
  
  // Check contract USDC balance
  const IERC20_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];
  const usdcToken = new ethers.Contract(usdcSolAddress, IERC20_ABI, user);
  const contractUsdcBalance = await usdcToken.balanceOf(universalLendingAddress);
  console.log("Contract USDC.SOL balance:", utils.formatUnits(contractUsdcBalance, 6));
  
  // Check gas fee details
  const [gasZRC20Address, gasFeeAmount] = await universalLendingProtocol.getWithdrawGasFee(usdcSolAddress);
  console.log("Gas token address:", gasZRC20Address);
  console.log("Gas fee amount:", utils.formatUnits(gasFeeAmount, 9), "SOL");
  
  const solToken = new ethers.Contract(solSolAddress, IERC20_ABI, user);
  const userSolBalance = await solToken.balanceOf(user.address);
  const userSolAllowance = await solToken.allowance(user.address, universalLendingAddress);
  console.log("User SOL balance:", utils.formatUnits(userSolBalance, 9));
  console.log("User SOL allowance to contract:", utils.formatUnits(userSolAllowance, 9));
  
  console.log("\n=== Manual Validation Logic ===");
  
  // Manually check each condition from the contract
  if (!assetConfig.isSupported) {
    console.error("❌ Asset not supported");
  } else {
    console.log("✅ Asset supported");
  }
  
  if (testAmount.eq(0)) {
    console.error("❌ Invalid amount (zero)");
  } else {
    console.log("✅ Amount is valid");
  }
  
  if (userSupply.lt(testAmount)) {
    console.error("❌ Insufficient supply balance");
  } else {
    console.log("✅ Sufficient supply balance");
  }
  
  if (!canWithdraw) {
    console.error("❌ Cannot withdraw (health factor)");
  } else {
    console.log("✅ Can withdraw (health factor OK)");
  }
  
  if (contractUsdcBalance.lt(testAmount)) {
    console.error("❌ Insufficient liquidity in contract");
  } else {
    console.log("✅ Sufficient contract liquidity");
  }
  
  if (userSolBalance.lt(gasFeeAmount)) {
    console.error("❌ User has insufficient SOL for gas");
  } else {
    console.log("✅ User has sufficient SOL for gas");
  }
  
  if (userSolAllowance.lt(gasFeeAmount)) {
    console.error("❌ Insufficient SOL allowance for gas");
  } else {
    console.log("✅ Sufficient SOL allowance for gas");
  }

  // Also check if there are any validation issues with amount vs gas fee
  console.log("\n=== Amount vs Gas Fee Validation ===");
  try {
    await universalLendingProtocol.callStatic._validateAmountVsGasFee || console.log("No _validateAmountVsGasFee method found");
  } catch (validationError) {
    console.log("Cannot test _validateAmountVsGasFee directly");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });