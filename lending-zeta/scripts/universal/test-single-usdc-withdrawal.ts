import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Testing single USDC.SOL withdrawal...");

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
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];

  const solToken = new ethers.Contract(solSolAddress, IERC20_ABI, user);

  // Check initial state
  console.log("\n=== Initial State ===");
  const initialSupply = await universalLendingProtocol.getSupplyBalance(user.address, usdcSolAddress);
  console.log("User USDC.SOL supplied:", utils.formatUnits(initialSupply, 6));

  if (initialSupply.eq(0)) {
    console.log("No USDC.SOL to withdraw");
    return;
  }

  // Check gas requirements
  const [gasZRC20Address, gasFeeAmount] = await universalLendingProtocol.getWithdrawGasFee(usdcSolAddress);
  console.log("Gas token:", gasZRC20Address);
  console.log("Gas fee:", utils.formatUnits(gasFeeAmount, 9), "SOL");

  // Check user SOL balance
  const userSolBalance = await solToken.balanceOf(user.address);
  console.log("User SOL balance:", utils.formatUnits(userSolBalance, 9));

  if (userSolBalance.lt(gasFeeAmount)) {
    console.log("❌ User doesn't have enough SOL for gas fees");
    return;
  }

  // Check/approve SOL allowance
  const currentAllowance = await solToken.allowance(user.address, universalLendingAddress);
  console.log("Current SOL allowance:", utils.formatUnits(currentAllowance, 9));

  if (currentAllowance.lt(gasFeeAmount)) {
    console.log("Approving SOL for gas fees...");
    const approveTx = await solToken.approve(universalLendingAddress, gasFeeAmount.mul(2)); // 2x buffer
    await approveTx.wait();
    console.log("✅ SOL approved");
  }

  // Try withdrawal with explicit gas limit and error handling
  console.log("\n=== Attempting Withdrawal ===");
  const solanaDestinationAddress = "5t8QFUT3aGoeFx89c2qTh5JBhmCUTeFxRH9fSmLhMTX6";
  const solanaAddressBytes = ethers.utils.toUtf8Bytes(solanaDestinationAddress);

  // Try a smaller amount first to test
  const testAmount = ethers.utils.parseUnits("0.1", 6); // 0.1 USDC
  
  try {
    console.log(`Withdrawing ${utils.formatUnits(testAmount, 6)} USDC.SOL to Solana...`);
    
    const tx = await universalLendingProtocol.withdrawCrossChain(
      usdcSolAddress,
      testAmount,
      901, // Solana Devnet
      solanaAddressBytes,
      { 
        gasLimit: 1000000, // Higher gas limit
        maxFeePerGas: ethers.utils.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei")
      }
    );
    
    console.log("Transaction submitted:", tx.hash);
    
    try {
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
      
      // Check final state
      const finalSupply = await universalLendingProtocol.getSupplyBalance(user.address, usdcSolAddress);
      console.log("Final USDC.SOL supplied:", utils.formatUnits(finalSupply, 6));
      console.log("Successfully withdrew:", utils.formatUnits(initialSupply.sub(finalSupply), 6), "USDC.SOL");
      
    } catch (receiptError: any) {
      if (receiptError.message && receiptError.message.includes("ethereum tx not found")) {
        console.log("⚠️  RPC issue getting receipt, but transaction may have succeeded");
        console.log("Check explorer:", `https://athens.explorer.zetachain.com/tx/${tx.hash}`);
        
        // Wait a bit and check balance
        console.log("Waiting 10 seconds to check balance...");
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const finalSupply = await universalLendingProtocol.getSupplyBalance(user.address, usdcSolAddress);
        console.log("Final USDC.SOL supplied:", utils.formatUnits(finalSupply, 6));
        
        if (finalSupply.lt(initialSupply)) {
          console.log("✅ Withdrawal succeeded! Amount withdrawn:", utils.formatUnits(initialSupply.sub(finalSupply), 6));
        } else {
          console.log("❌ Withdrawal may have failed - balance unchanged");
        }
      } else {
        throw receiptError;
      }
    }
    
  } catch (error: any) {
    console.error("❌ Withdrawal failed:", error);
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.code) {
      console.error("Error code:", error.code);
    }
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    // Try to decode error if it's a revert
    if (error.data) {
      try {
        const decoded = universalLendingProtocol.interface.parseError(error.data);
        console.error("Decoded error:", decoded);
      } catch (decodeError) {
        console.error("Could not decode error data");
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });