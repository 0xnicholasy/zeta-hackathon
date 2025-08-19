import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Diagnosing USDC.SOL withdrawal issue...");

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
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
  ];

  const usdcSolToken = new ethers.Contract(usdcSolAddress, IERC20_ABI, user);
  const solSolToken = new ethers.Contract(solSolAddress, IERC20_ABI, user);

  console.log("\n=== User Balances ===");
  const userUsdcBalance = await usdcSolToken.balanceOf(user.address);
  const userSolBalance = await solSolToken.balanceOf(user.address);
  console.log("User USDC.SOL:", utils.formatUnits(userUsdcBalance, 6));
  console.log("User SOL.SOL:", utils.formatUnits(userSolBalance, 9));

  console.log("\n=== Contract Balances ===");
  const contractUsdcBalance = await usdcSolToken.balanceOf(universalLendingAddress);
  const contractSolBalance = await solSolToken.balanceOf(universalLendingAddress);
  console.log("Contract USDC.SOL:", utils.formatUnits(contractUsdcBalance, 6));
  console.log("Contract SOL.SOL:", utils.formatUnits(contractSolBalance, 9));

  console.log("\n=== User Supply Balances ===");
  const userSupplyUsdc = await universalLendingProtocol.getSupplyBalance(user.address, usdcSolAddress);
  const userSupplySol = await universalLendingProtocol.getSupplyBalance(user.address, solSolAddress);
  console.log("User supplied USDC.SOL:", utils.formatUnits(userSupplyUsdc, 6));
  console.log("User supplied SOL.SOL:", utils.formatUnits(userSupplySol, 9));

  console.log("\n=== Gas Fee Analysis ===");
  try {
    const [gasZRC20Address, gasFeeAmount] = await universalLendingProtocol.getWithdrawGasFee(usdcSolAddress);
    console.log("Gas token for USDC.SOL withdrawal:", gasZRC20Address);
    console.log("Gas fee amount:", utils.formatUnits(gasFeeAmount, 9), "SOL");
    console.log("Is gas token SOL.SOL?", gasZRC20Address.toLowerCase() === solSolAddress.toLowerCase());
    console.log("Is gas token USDC.SOL?", gasZRC20Address.toLowerCase() === usdcSolAddress.toLowerCase());

    // Check if contract has enough gas tokens
    const gasTokenContract = new ethers.Contract(gasZRC20Address, IERC20_ABI, user);
    const contractGasBalance = await gasTokenContract.balanceOf(universalLendingAddress);
    const gasDecimals = await gasTokenContract.decimals();
    console.log("Contract balance of gas token:", utils.formatUnits(contractGasBalance, gasDecimals));
    console.log("Has sufficient gas tokens?", contractGasBalance.gte(gasFeeAmount));
  } catch (error: any) {
    console.error("Error getting gas fee:", error.message);
  }

  console.log("\n=== Withdrawal Simulation ===");
  try {
    const canWithdraw = await universalLendingProtocol.canWithdraw(user.address, usdcSolAddress, userSupplyUsdc);
    console.log("Can withdraw USDC.SOL?", canWithdraw);

    if (canWithdraw) {
      console.log("Health factor check passed");
      
      // Check health factor after withdrawal
      const healthFactorAfter = await universalLendingProtocol.getHealthFactorAfterWithdraw(user.address, usdcSolAddress, userSupplyUsdc);
      console.log("Health factor after withdrawal:", healthFactorAfter.eq(ethers.constants.MaxUint256) ? "∞" : utils.formatEther(healthFactorAfter));
    } else {
      console.log("Health factor check FAILED");
    }
  } catch (error: any) {
    console.error("Error checking withdrawal:", error.message);
  }

  console.log("\n=== ZRC20 Token Analysis ===");
  try {
    // Check if USDC.SOL has any special properties or restrictions
    const IZRC20_ABI = [
      "function withdrawGasFee() external view returns (address, uint256)",
      "function PROTOCOL_FLAT_FEE() external view returns (uint256)",
      "function balanceOf(address) external view returns (uint256)"
    ];

    try {
      const usdcZRC20 = new ethers.Contract(usdcSolAddress, IZRC20_ABI, user);
      const [withdrawGasToken, withdrawGasFee] = await usdcZRC20.withdrawGasFee();
      console.log("USDC.SOL withdraw gas token:", withdrawGasToken);
      console.log("USDC.SOL withdraw gas fee:", utils.formatUnits(withdrawGasFee, 9), "SOL");
      
      // Check protocol flat fee if it exists
      try {
        const flatFee = await usdcZRC20.PROTOCOL_FLAT_FEE();
        console.log("USDC.SOL protocol flat fee:", flatFee.toString());
      } catch (feeError) {
        console.log("No protocol flat fee method found");
      }
    } catch (zrc20Error) {
      console.log("Could not get ZRC20 specific info:", zrc20Error.message);
    }

    // Check if there are any allowance issues
    const usdcAllowance = await usdcSolToken.allowance(universalLendingAddress, usdcSolAddress);
    const solAllowance = await solSolToken.allowance(universalLendingAddress, solSolAddress);
    console.log("Contract USDC.SOL allowance to itself:", utils.formatUnits(usdcAllowance, 6));
    console.log("Contract SOL.SOL allowance to itself:", utils.formatUnits(solAllowance, 9));

  } catch (error: any) {
    console.error("Error in ZRC20 analysis:", error.message);
  }

  console.log("\n=== Summary ===");
  console.log("The issue appears to be with the USDC.SOL cross-chain withdrawal process.");
  console.log("Key findings:");
  console.log("1. User has", utils.formatUnits(userSupplyUsdc, 6), "USDC.SOL supplied");
  console.log("2. Contract has", utils.formatUnits(contractUsdcBalance, 6), "USDC.SOL balance");
  console.log("3. Gas fees are paid in SOL tokens");
  console.log("4. The error 0x10bad147 occurs during the ZRC20 transfer process");
  
  console.log("\nNext steps:");
  console.log("1. Check if this is a known ZetaChain ZRC20 error");
  console.log("2. Try withdrawing a smaller amount to isolate the issue");
  console.log("3. Check ZetaChain documentation for USDC.SOL specific constraints");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });