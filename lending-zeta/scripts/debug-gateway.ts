import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
} from "../utils/contracts";

async function main() {
  console.log("🔍 Debugging gateway configuration...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Network:", getNetwork(chainId).name);
  console.log("Account:", deployer.address);

  // Get contract
  const simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");
  const simpleLendingProtocol = await ethers.getContractAt(
    "SimpleLendingProtocol",
    simpleLendingProtocolAddress
  );

  console.log("SimpleLendingProtocol:", simpleLendingProtocolAddress);

  // Check gateway address in the contract
  const gatewayAddress = await simpleLendingProtocol.gateway();
  console.log("Gateway address in contract:", gatewayAddress);

  // Check what the actual ZetaChain gateway address should be
  console.log("\nExpected ZetaChain Athens gateway:", "0x6c533f7fE93fAE114d0954697069Df33C9B74fD7");
  
  if (gatewayAddress.toLowerCase() === "0x6c533f7fE93fAE114d0954697069Df33C9B74fD7".toLowerCase()) {
    console.log("✅ Gateway address is correct");
  } else {
    console.log("❌ Gateway address mismatch!");
    console.log("This would cause onlyGateway modifier to fail");
  }

  // Test the onlyGateway modifier by trying to call onCall directly
  console.log("\n🧪 Testing onlyGateway modifier...");
  
  try {
    const message = ethers.utils.defaultAbiCoder.encode(
      ["string", "address"],
      ["supply", deployer.address]
    );
    
    // This should fail with "Unauthorized" if we're not the gateway
    await simpleLendingProtocol.callStatic.onCall(
      {
        origin: ethers.constants.AddressZero,
        sender: deployer.address,
        chainID: 421614
      },
      "0x1de70f3e971B62A0707dA18100392af14f7fB677",
      1000,
      message
    );
    console.log("❌ onCall succeeded when it should have failed (bad gateway check)");
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      console.log("✅ onlyGateway modifier working correctly");
    } else {
      console.log("🤔 Unexpected error:", error.message);
    }
  }

  // Check owner
  const owner = await simpleLendingProtocol.owner();
  console.log("\nContract owner:", owner);
  console.log("Deployer:", deployer.address);
  console.log("Is deployer owner?", owner.toLowerCase() === deployer.address.toLowerCase());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });