import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Verifying the contract fix for withdrawCrossChain...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("User address:", user.address);
  console.log("Network:", getNetwork(chainId).name);

  // Get contract addresses  
  const contractsJson = require("../../contracts.json");
  const universalLendingAddress = contractsJson.networks[chainId.toString()].contracts.UniversalLendingProtocol;
  const usdcSolAddress = getTokenAddress(chainId, "USDC.SOL");
  const solSolAddress = getTokenAddress(chainId, "SOL.SOL");

  console.log("\n=== Contract Addresses ===");
  console.log("UniversalLendingProtocol:", universalLendingAddress);
  console.log("USDC.SOL:", usdcSolAddress);
  console.log("SOL.SOL:", solSolAddress);

  // Connect to contracts
  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = UniversalLendingProtocol.attach(universalLendingAddress);

  const IERC20_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];

  const usdcToken = new ethers.Contract(usdcSolAddress, IERC20_ABI, user);
  const solToken = new ethers.Contract(solSolAddress, IERC20_ABI, user);

  console.log("\n=== Pre-Deployment State Check ===");
  
  // Check user supply balances
  const userSupplyUsdc = await universalLendingProtocol.getSupplyBalance(user.address, usdcSolAddress);
  const userSupplySol = await universalLendingProtocol.getSupplyBalance(user.address, solSolAddress);
  console.log("User supplied USDC.SOL:", utils.formatUnits(userSupplyUsdc, 6));
  console.log("User supplied SOL.SOL:", utils.formatUnits(userSupplySol, 9));

  // Check user wallet balances
  const userUsdcBalance = await usdcToken.balanceOf(user.address);
  const userSolBalance = await solToken.balanceOf(user.address);
  console.log("User wallet USDC.SOL:", utils.formatUnits(userUsdcBalance, 6));
  console.log("User wallet SOL.SOL:", utils.formatUnits(userSolBalance, 9));

  // Check gas requirements
  if (userSupplyUsdc.gt(0)) {
    console.log("\n=== Gas Fee Requirements ===");
    const [gasZRC20Address, gasFeeAmount] = await universalLendingProtocol.getWithdrawGasFee(usdcSolAddress);
    console.log("Gas token for USDC.SOL withdrawal:", gasZRC20Address);
    console.log("Gas fee amount:", utils.formatUnits(gasFeeAmount, 9), "SOL");

    const userSolAllowance = await solToken.allowance(user.address, universalLendingAddress);
    console.log("Current SOL allowance to contract:", utils.formatUnits(userSolAllowance, 9));

    // Check if user has enough SOL and allowance
    const hasEnoughSol = userSolBalance.gte(gasFeeAmount);
    const hasEnoughAllowance = userSolAllowance.gte(gasFeeAmount);
    
    console.log("User has enough SOL for gas:", hasEnoughSol);
    console.log("User has enough SOL allowance:", hasEnoughAllowance);

    if (!hasEnoughSol) {
      console.log("⚠️  User needs more SOL tokens for gas fees");
    }

    if (!hasEnoughAllowance && hasEnoughSol) {
      console.log("⚠️  User should approve more SOL tokens to the contract");
      console.log("   Run: approve SOL.SOL to", universalLendingAddress, "for", utils.formatUnits(gasFeeAmount, 9), "SOL");
    }
  }

  console.log("\n=== Test Scenarios After Contract Fix ===");
  console.log("Once the fixed contract is deployed, test these scenarios:");
  
  if (userSupplyUsdc.gt(0)) {
    console.log("\n1. USDC.SOL Cross-Chain Withdrawal Test:");
    console.log("   - Asset: USDC.SOL");
    console.log("   - Amount:", utils.formatUnits(userSupplyUsdc, 6), "USDC");
    console.log("   - Gas: Paid in SOL tokens");
    console.log("   - Expected: Should now work with the fix!");
  }

  if (userSupplySol.gt(0)) {
    console.log("\n2. SOL.SOL Cross-Chain Withdrawal Test:");
    console.log("   - Asset: SOL.SOL");
    console.log("   - Amount:", utils.formatUnits(userSupplySol, 9), "SOL");
    console.log("   - Gas: Deducted from withdrawal amount");
    console.log("   - Expected: Should work (was already working)");
  }

  console.log("\n=== Contract Fix Summary ===");
  console.log("The fix adds this line to SimpleLendingProtocol.sol:");
  console.log("  IERC20(asset).approve(address(gateway), amount);");
  console.log("");
  console.log("Location: In withdrawCrossChain function, else block (different token case)");
  console.log("After line: IERC20(gasZRC20).safeIncreaseAllowance(address(gateway), gasFee);");
  console.log("");
  console.log("This ensures the gateway can transfer the withdrawal asset from the contract,");
  console.log("fixing the 0x10bad147 error we encountered.");

  console.log("\n=== Post-Deployment Testing Plan ===");
  console.log("1. Deploy the fixed SimpleLendingProtocol contract");
  console.log("2. Update contracts.json with new address");
  console.log("3. Run the Solana withdrawal script to test USDC.SOL → Solana");
  console.log("4. Test other cross-chain withdrawals (USDC.SOL → other chains)");
  console.log("5. Verify SOL.SOL withdrawals still work");
  console.log("6. Test edge cases with different amounts and gas scenarios");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });