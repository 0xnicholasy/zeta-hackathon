import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getContractAddress,
} from "../utils/contracts";

async function main() {
  console.log("🐛 Debug cross-chain deposit simulation...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Connected to:", getNetwork(chainId).name);
  console.log("Account:", deployer.address);

  // Get SimpleLendingProtocol address
  const simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");
  console.log("SimpleLendingProtocol address:", simpleLendingProtocolAddress);

  // Get contract instance
  const simpleLendingProtocol = await ethers.getContractAt(
    "SimpleLendingProtocol",
    simpleLendingProtocolAddress
  );

  // Simulate what happens in onCall function
  const testAsset = "0x1de70f3e971B62A0707dA18100392af14f7fB677"; // ETH.ARBSEP
  const testAmount = ethers.utils.parseEther("0.001"); // 0.001 ETH
  const testUser = deployer.address;

  console.log(`\n🧪 Testing supply simulation:`);
  console.log(`Asset: ${testAsset}`);
  console.log(`Amount: ${utils.formatEther(testAmount)} ETH`);
  console.log(`User: ${testUser}`);

  try {
    // Check asset support
    const assetInfo = await simpleLendingProtocol.assets(testAsset);
    console.log(`\n✅ Asset supported: ${assetInfo.isSupported}`);
    console.log(`💰 Asset price: $${utils.formatUnits(assetInfo.price, 18)}`);

    // Check contract balance
    const contractBalance = await ethers.provider.getBalance(simpleLendingProtocolAddress);
    console.log(`💳 Contract ETH balance: ${utils.formatEther(contractBalance)}`);

    // Try to get ERC20 balance if it's a token
    try {
      const tokenContract = await ethers.getContractAt("IERC20", testAsset);
      const tokenBalance = await tokenContract.balanceOf(simpleLendingProtocolAddress);
      const decimals = await tokenContract.decimals();
      console.log(`🪙 Contract token balance: ${utils.formatUnits(tokenBalance, decimals)}`);
    } catch (e) {
      console.log("ℹ️  Could not check token balance (might be native ETH)");
    }

    // Simulate the onCall message
    const message = ethers.utils.defaultAbiCoder.encode(
      ["string", "address"],
      ["supply", testUser]
    );
    console.log(`\n📞 Simulated message: ${message}`);

    // Decode to verify
    const [action, onBehalfOf] = ethers.utils.defaultAbiCoder.decode(
      ["string", "address"],
      message
    );
    console.log(`📋 Decoded action: "${action}"`);
    console.log(`👤 Decoded onBehalfOf: ${onBehalfOf}`);

    // Check current user supplies
    const currentSupply = await simpleLendingProtocol.getSupplyBalance(testUser, testAsset);
    console.log(`📊 Current user supply: ${utils.formatEther(currentSupply)} tokens`);

    // Try to simulate the supply call directly (this will fail if not enough tokens)
    console.log(`\n🔄 Testing direct supply call...`);
    
    try {
      // We can't actually call this without tokens, but we can estimate gas
      const gasEstimate = await simpleLendingProtocol.estimateGas.supply(
        testAsset,
        testAmount,
        testUser
      );
      console.log(`⛽ Gas estimate for supply: ${gasEstimate.toString()}`);
    } catch (error: any) {
      console.log(`❌ Supply simulation failed: ${error.reason || error.message}`);
      
      // Check if it's a revert with reason
      if (error.reason) {
        console.log(`🚨 Revert reason: ${error.reason}`);
      }
      
      // Check error data
      if (error.data) {
        console.log(`📄 Error data: ${error.data}`);
        
        // Try to decode common error selectors
        const errorSelectors = {
          "0x4e487b71": "Panic(uint256)",
          "0x08c379a0": "Error(string)",
          "0x82b42900": "Unknown custom error"
        };
        
        for (const [selector, name] of Object.entries(errorSelectors)) {
          if (error.data.startsWith(selector)) {
            console.log(`🎯 Error type: ${name}`);
            break;
          }
        }
      }
    }

    // Check if gateway is set correctly
    try {
      const gatewayAddress = await simpleLendingProtocol.gateway();
      console.log(`\n🌉 Gateway address: ${gatewayAddress}`);
      
      // Check if current user is gateway (should be false)
      const isGateway = gatewayAddress.toLowerCase() === deployer.address.toLowerCase();
      console.log(`🔐 Is current user gateway: ${isGateway}`);
    } catch (error) {
      console.log(`❌ Could not get gateway address: ${error}`);
    }

  } catch (error: any) {
    console.error("❌ Debug simulation failed:", error.reason || error.message);
  }

  console.log("\n🔍 Potential Issues to Check:");
  console.log("1. Gateway authorization - only gateway can call onCall()");
  console.log("2. Token transfer - ensure sufficient token balance for deposits");
  console.log("3. Gas limits - cross-chain calls might need higher gas");
  console.log("4. Asset decimals - ensure proper decimal handling");
  console.log("5. Contract permissions - check if contract can receive tokens");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });