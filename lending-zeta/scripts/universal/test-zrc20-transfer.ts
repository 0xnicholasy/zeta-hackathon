import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Testing ZRC20 token transfers directly...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("User address:", user.address);

  // Get contract addresses  
  const contractsJson = require("../../contracts.json");
  const universalLendingAddress = contractsJson.networks[chainId.toString()].contracts.UniversalLendingProtocol;
  const usdcSolAddress = getTokenAddress(chainId, "USDC.SOL");

  console.log("Lending contract:", universalLendingAddress);
  console.log("USDC.SOL:", usdcSolAddress);

  const IERC20_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];

  const usdcToken = new ethers.Contract(usdcSolAddress, IERC20_ABI, user);

  console.log("\n=== Current Balances ===");
  const userBalance = await usdcToken.balanceOf(user.address);
  const contractBalance = await usdcToken.balanceOf(universalLendingAddress);
  console.log("User USDC.SOL balance:", utils.formatUnits(userBalance, 6));
  console.log("Contract USDC.SOL balance:", utils.formatUnits(contractBalance, 6));

  // Test 1: Simple transfer from user to user (should work)
  console.log("\n=== Test 1: User to User Transfer ===");
  const testAmount = ethers.utils.parseUnits("0.01", 6); // 0.01 USDC
  
  if (userBalance.gte(testAmount)) {
    try {
      const transferTx = await usdcToken.transfer(user.address, testAmount); // Transfer to self
      await transferTx.wait();
      console.log("✅ Self-transfer succeeded");
    } catch (error: any) {
      console.error("❌ Self-transfer failed:", error.message);
      if (error.data) {
        console.error("Error data:", error.data);
      }
    }
  } else {
    console.log("⚠️  User has insufficient USDC for test transfer");
  }

  // Test 2: TransferFrom simulation (what the gateway would do)
  console.log("\n=== Test 2: TransferFrom Simulation ===");
  
  // First check current allowance from contract to user
  const allowance = await usdcToken.allowance(universalLendingAddress, user.address);
  console.log("Current allowance from contract to user:", utils.formatUnits(allowance, 6));

  // Since we can't approve from the contract (we don't have private key), 
  // let's try a different test - check what happens when we try transferFrom without approval
  if (contractBalance.gte(testAmount)) {
    try {
      // This will fail because we don't have approval, but let's see the error
      console.log("Attempting transferFrom without approval (will fail, but shows error type)...");
      await usdcToken.callStatic.transferFrom(universalLendingAddress, user.address, testAmount);
      console.log("✅ Unexpected: transferFrom succeeded without approval");
    } catch (error: any) {
      console.log("❌ Expected: transferFrom failed without approval");
      console.log("Error message:", error.message);
      if (error.data) {
        console.log("Error data:", error.data);
        // Check if this is the same error
        if (error.data === "0x10bad147") {
          console.log("🎯 FOUND IT! This is the same error code we're seeing!");
        }
      }
    }
  }

  // Test 3: Check ZRC20-specific methods
  console.log("\n=== Test 3: ZRC20-Specific Methods ===");
  
  const IZRC20_ABI = [
    "function withdrawGasFee() external view returns (address, uint256)",
    "function PROTOCOL_FLAT_FEE() external view returns (uint256)",
    "function chainId() external view returns (uint256)",
    "function coinType() external view returns (uint8)"
  ];

  try {
    const usdcZRC20 = new ethers.Contract(usdcSolAddress, IZRC20_ABI, user);
    
    const [gasToken, gasFee] = await usdcZRC20.withdrawGasFee();
    console.log("USDC.SOL gas token:", gasToken);
    console.log("USDC.SOL gas fee:", utils.formatUnits(gasFee, 9));
    
    try {
      const chainId = await usdcZRC20.chainId();
      console.log("USDC.SOL chain ID:", chainId.toString());
    } catch (e) {
      console.log("No chainId method");
    }
    
    try {
      const coinType = await usdcZRC20.coinType();
      console.log("USDC.SOL coin type:", coinType);
    } catch (e) {
      console.log("No coinType method");
    }
    
    try {
      const flatFee = await usdcZRC20.PROTOCOL_FLAT_FEE();
      console.log("USDC.SOL protocol flat fee:", flatFee.toString());
    } catch (e) {
      console.log("No PROTOCOL_FLAT_FEE method");
    }
    
  } catch (error: any) {
    console.error("Error calling ZRC20 methods:", error.message);
  }

  console.log("\n=== Test 4: Gateway Contract Lookup ===");
  
  // Try to find the actual gateway contract
  try {
    const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
    const contract = UniversalLendingProtocol.attach(universalLendingAddress);
    
    // Try to get gateway address
    try {
      const gatewayAddr = await contract.gateway();
      console.log("Gateway contract address:", gatewayAddr);
      
      // Check if this matches what we saw in the trace
      if (gatewayAddr.toLowerCase() === "0x6c533f7fe93fae114d0954697069df33c9b74fd7") {
        console.log("🎯 This matches the gateway address from the failing trace!");
      }
    } catch (e) {
      console.log("Could not get gateway address");
    }
  } catch (e) {
    console.log("Could not connect to lending protocol");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });