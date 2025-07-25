import { ethers } from "hardhat";
import { getNetwork } from "../../utils/contracts";
import {
  ZETA_CHAIN_IDS,
  parseProtocolArgs,
  displayScriptHeader,
  displayNetworkInfo,
  getLendingProtocolAddress,
  getDepositContractAddress,
  displaySummary,
  displaySuccess,
  handleCommonErrors
} from "./script-helpers";

async function main() {
  // Parse protocol type from command line arguments
  const protocolConfig = parseProtocolArgs();
  
  // Display script header
  displayScriptHeader("Update DepositContract Lending Protocol Address", protocolConfig);

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const balance = await ethers.provider.getBalance(deployer.address);

  // Display network information
  await displayNetworkInfo(chainId, deployer.address, balance);

  // Get contract addresses
  const depositContractAddress = getDepositContractAddress(chainId);
  const zetaChainId = ZETA_CHAIN_IDS.testnet;
  const newLendingProtocolAddress = getLendingProtocolAddress(
    protocolConfig.protocolContractName,
    zetaChainId
  );

  console.log("\n📋 Contract Addresses:");
  console.log("-".repeat(30));
  console.log(`DepositContract: ${depositContractAddress}`);
  console.log(`New ${protocolConfig.protocolContractName}: ${newLendingProtocolAddress}`);
  console.log(`Target ZetaChain ID: ${zetaChainId}`);

  // Connect to DepositContract
  const DepositContract = await ethers.getContractFactory("DepositContract");
  const depositContract = DepositContract.attach(depositContractAddress);

  // Get current lending protocol address for comparison
  const currentLendingProtocolAddress = await depositContract.lendingProtocolAddress();
  console.log(`Current lending protocol address: ${currentLendingProtocolAddress}`);

  if (currentLendingProtocolAddress.toLowerCase() === newLendingProtocolAddress.toLowerCase()) {
    console.log("\n⚠️  The lending protocol address is already set to the target address. No update needed.");
    return;
  }

  console.log("\n🔄 Updating Lending Protocol Address...");
  
  try {
    // Update the lending protocol address with chain ID validation
    const tx = await depositContract.updateLendingProtocolAddress(
      newLendingProtocolAddress,
      zetaChainId
    );
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Verify the update
    const updatedAddress = await depositContract.lendingProtocolAddress();
    if (updatedAddress.toLowerCase() === newLendingProtocolAddress.toLowerCase()) {
      console.log("✅ Address update verified successfully!");
    } else {
      console.log("❌ Update verification failed!");
      throw new Error("Address update verification failed");
    }
    
  } catch (error: any) {
    handleCommonErrors(error, "lending protocol address update");
    throw error;
  }

  // Display summary
  displaySummary("Update Summary", {
    "Network": `${getNetwork(chainId).name} (${chainId})`,
    "DepositContract": depositContractAddress,
    "Old Address": currentLendingProtocolAddress,
    "New Address": newLendingProtocolAddress,
    "Protocol Type": protocolConfig.protocolType,
    "ZetaChain ID": zetaChainId,
    "Updated by": deployer.address
  });

  displaySuccess("DepositContract lending protocol address update", protocolConfig.protocolType);
  console.log(`The contract will now route deposits to the ${protocolConfig.protocolType} lending protocol on ZetaChain.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });