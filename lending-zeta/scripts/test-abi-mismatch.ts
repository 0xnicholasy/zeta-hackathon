import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
} from "../utils/contracts";

async function main() {
  console.log("🔍 Testing for ABI mismatch...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  const simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");
  console.log("SimpleLendingProtocol address:", simpleLendingProtocolAddress);

  // Try calling the function directly with low-level call
  const testAsset = "0x1de70f3e971B62A0707dA18100392af14f7fB677";
  const testUser = deployer.address;

  // Create function selector for getSupplyBalance(address,address)
  const functionSelector = ethers.utils.id("getSupplyBalance(address,address)").slice(0, 10);
  console.log("Function selector:", functionSelector);

  // Encode the parameters
  const encodedParams = ethers.utils.defaultAbiCoder.encode(
    ["address", "address"],
    [testUser, testAsset]
  );

  const callData = functionSelector + encodedParams.slice(2);
  console.log("Call data:", callData);

  try {
    const result = await ethers.provider.call({
      to: simpleLendingProtocolAddress,
      data: callData
    });
    console.log("✅ Low-level call result:", result);
    
    // Try to decode as uint256
    const decoded = ethers.utils.defaultAbiCoder.decode(["uint256"], result);
    console.log("✅ Decoded balance:", decoded[0].toString());
  } catch (error: any) {
    console.log("❌ Low-level call failed:", error.reason || error.message);
  }

  // Test with contract instance but different approach
  console.log("\n🔄 Testing with contract instance...");
  
  try {
    const contract = new ethers.Contract(
      simpleLendingProtocolAddress,
      [
        "function getSupplyBalance(address user, address asset) external view returns (uint256)",
        "function userSupplies(address, address) external view returns (uint256)"
      ],
      deployer
    );

    // Try direct mapping access
    const directBalance = await contract.userSupplies(testUser, testAsset);
    console.log("✅ Direct userSupplies mapping:", directBalance.toString());

    // Try the getter function
    const getterBalance = await contract.getSupplyBalance(testUser, testAsset);
    console.log("✅ getSupplyBalance function:", getterBalance.toString());

  } catch (error: any) {
    console.log("❌ Contract instance test failed:", error.reason || error.message);
  }

  // Check if the contract needs recompilation
  console.log("\n🔧 Checking contract compilation...");
  
  try {
    // Get the artifact
    const artifact = await ethers.getContractFactory("SimpleLendingProtocol");
    console.log("✅ Contract artifact loaded successfully");
    
    // Check if ABI includes our functions
    const abi = artifact.interface;
    const hasGetSupplyBalance = abi.functions["getSupplyBalance(address,address)"] !== undefined;
    const hasGetBorrowBalance = abi.functions["getBorrowBalance(address,address)"] !== undefined;
    
    console.log("✅ ABI has getSupplyBalance:", hasGetSupplyBalance);
    console.log("✅ ABI has getBorrowBalance:", hasGetBorrowBalance);
    
  } catch (error: any) {
    console.log("❌ Contract artifact error:", error.reason || error.message);
  }

  console.log("\n💡 Recommendations:");
  console.log("1. If low-level call works but contract instance fails: ABI mismatch");
  console.log("2. If both fail: Contract deployment issue");
  console.log("3. If direct mapping works but getter fails: Function implementation issue");
  console.log("4. Solution: Recompile and redeploy the contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });