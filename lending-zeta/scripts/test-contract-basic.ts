import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getContractAddress,
} from "../utils/contracts";

async function main() {
  console.log("🔧 Testing basic contract functionality...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Connected to:", getNetwork(chainId).name);
  console.log("Account:", deployer.address);

  // Get SimpleLendingProtocol address
  const simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");
  console.log("SimpleLendingProtocol address:", simpleLendingProtocolAddress);

  // Check if contract exists
  const code = await ethers.provider.getCode(simpleLendingProtocolAddress);
  console.log("Contract code length:", code.length);
  
  if (code === "0x") {
    console.log("❌ No contract deployed at this address!");
    return;
  }

  // Get contract instance
  const simpleLendingProtocol = await ethers.getContractAt(
    "SimpleLendingProtocol",
    simpleLendingProtocolAddress
  );

  try {
    // Test basic read functions
    console.log("\n📊 Testing basic read functions...");
    
    const assetsCount = await simpleLendingProtocol.getSupportedAssetsCount();
    console.log(`✅ Assets count: ${assetsCount.toString()}`);

    if (assetsCount.toNumber() > 0) {
      const firstAsset = await simpleLendingProtocol.getSupportedAsset(0);
      console.log(`✅ First asset: ${firstAsset}`);
      
      const assetInfo = await simpleLendingProtocol.assets(firstAsset);
      console.log(`✅ Asset info - Supported: ${assetInfo.isSupported}, Price: $${utils.formatUnits(assetInfo.price, 18)}`);
    }

    // Test gateway address
    const gatewayAddress = await simpleLendingProtocol.gateway();
    console.log(`✅ Gateway address: ${gatewayAddress}`);

    // Test owner
    const owner = await simpleLendingProtocol.owner();
    console.log(`✅ Owner: ${owner}`);
    console.log(`✅ Is deployer owner: ${owner.toLowerCase() === deployer.address.toLowerCase()}`);

    // Test user balance functions
    const testAsset = "0x1de70f3e971B62A0707dA18100392af14f7fB677";
    console.log(`\n🧪 Testing user balance functions for asset: ${testAsset}`);
    
    try {
      const supplyBalance = await simpleLendingProtocol.getSupplyBalance(deployer.address, testAsset);
      console.log(`✅ Supply balance: ${utils.formatEther(supplyBalance)}`);
    } catch (error: any) {
      console.log(`❌ getSupplyBalance failed: ${error.reason || error.message}`);
      console.log(`Error data: ${error.data}`);
    }

    try {
      const borrowBalance = await simpleLendingProtocol.getBorrowBalance(deployer.address, testAsset);
      console.log(`✅ Borrow balance: ${utils.formatEther(borrowBalance)}`);
    } catch (error: any) {
      console.log(`❌ getBorrowBalance failed: ${error.reason || error.message}`);
    }

    try {
      const healthFactor = await simpleLendingProtocol.getHealthFactor(deployer.address);
      console.log(`✅ Health factor: ${healthFactor.toString()}`);
    } catch (error: any) {
      console.log(`❌ getHealthFactor failed: ${error.reason || error.message}`);
    }

    // Test manual supply (this should fail due to no tokens, but shouldn't revert on estimation)
    console.log(`\n🔄 Testing manual supply estimation...`);
    const testAmount = ethers.utils.parseEther("0.001");
    
    try {
      // First check if we have any tokens
      const tokenContract = await ethers.getContractAt("IERC20", testAsset);
      const userBalance = await tokenContract.balanceOf(deployer.address);
      console.log(`💰 User token balance: ${utils.formatEther(userBalance)}`);
      
      if (userBalance.gt(0)) {
        // Try to estimate gas for supply
        const gasEstimate = await simpleLendingProtocol.estimateGas.supply(
          testAsset,
          testAmount,
          deployer.address
        );
        console.log(`⛽ Gas estimate for supply: ${gasEstimate.toString()}`);
      } else {
        console.log(`ℹ️  User has no tokens to test supply with`);
      }
    } catch (error: any) {
      console.log(`❌ Manual supply test failed: ${error.reason || error.message}`);
      
      // Check if it's just insufficient balance or something else
      if (error.reason?.includes("insufficient") || error.reason?.includes("balance")) {
        console.log(`ℹ️  This is expected - user needs tokens to supply`);
      } else {
        console.log(`🚨 Unexpected error: ${error.reason}`);
      }
    }

    // Test onCall function authorization
    console.log(`\n🔐 Testing onCall authorization...`);
    const testMessage = ethers.utils.defaultAbiCoder.encode(
      ["string", "address"],
      ["supply", deployer.address]
    );

    try {
      const gasEstimate = await simpleLendingProtocol.estimateGas.onCall(
        { chainId: 0, sender: deployer.address }, // Mock context
        testAsset,
        testAmount,
        testMessage
      );
      console.log(`⛽ Gas estimate for onCall: ${gasEstimate.toString()}`);
      console.log(`⚠️  WARNING: onCall should only be callable by gateway!`);
    } catch (error: any) {
      if (error.reason?.includes("Unauthorized") || error.reason?.includes("gateway")) {
        console.log(`✅ onCall properly restricted to gateway`);
      } else {
        console.log(`❌ onCall failed with unexpected error: ${error.reason || error.message}`);
      }
    }

  } catch (error: any) {
    console.error("❌ Contract test failed:", error.reason || error.message);
    console.log("Error details:", error);
  }

  console.log("\n✅ Basic contract functionality test completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });