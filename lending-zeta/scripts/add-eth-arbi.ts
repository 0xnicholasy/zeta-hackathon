import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
} from "../utils/contracts";

async function main() {
  console.log("🔧 Adding ETH.ARBI specifically...");

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

  // Get ETH.ARBI address
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  console.log("ETH.ARBI address:", ethArbiAddress);

  // Check if already supported
  const ethArbiInfo = await simpleLendingProtocol.assets(ethArbiAddress);
  if (ethArbiInfo.isSupported) {
    console.log("✅ ETH.ARBI already supported");
    return;
  }

  console.log("Adding ETH.ARBI to SimpleLendingProtocol...");
  const tx = await simpleLendingProtocol.addAsset(ethArbiAddress, 2000);
  await tx.wait();
  console.log("✅ ETH.ARBI added successfully");

  // Verify
  const verifyInfo = await simpleLendingProtocol.assets(ethArbiAddress);
  console.log("Verification - Supported:", verifyInfo.isSupported);
  console.log("Verification - Price:", ethers.utils.formatUnits(verifyInfo.price, 18));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });