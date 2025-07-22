import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const main = async (args: any, hre: HardhatRuntimeEnvironment) => {
  const network = hre.network.name;
  
  const [signer] = await hre.ethers.getSigners();
  if (signer === undefined) {
    throw new Error(
      `Wallet not found. Please, run "npx hardhat account --save" or set PRIVATE_KEY env variable (for example, in a .env file)`
    );
  }

  if (!args.contract) {
    throw new Error("Contract address is required. Use --contract <address>");
  }

  console.log(`🔑 Using account: ${signer.address}`);
  console.log(`📜 Contract address: ${args.contract}`);
  console.log(`🌐 Network: ${network}`);

  // Connect to the SimpleLendingProtocol contract
  const simpleLendingContract = await hre.ethers.getContractAt(
    "SimpleLendingProtocol", 
    args.contract
  );

  try {
    // Get the number of supported assets
    const supportedAssetsCount = await simpleLendingContract.getSupportedAssetsCount();
    const assetsCount = supportedAssetsCount.toNumber();
    console.log(`📊 Found ${assetsCount} supported assets`);

    if (assetsCount === 0) {
      console.log("❌ No supported assets found in the contract");
      return;
    }

    // Get all supported asset addresses
    const assetAddresses: string[] = [];
    for (let i = 0; i < assetsCount; i++) {
      const assetAddress = await simpleLendingContract.getSupportedAsset(i);
      assetAddresses.push(assetAddress);
    }

    console.log(`🔍 Supported assets: ${assetAddresses.join(", ")}`);

    // Check user's supplied balances and withdraw all
    let totalWithdrawals = 0;
    
    for (const assetAddress of assetAddresses) {
      try {
        // Check user's supply balance for this asset
        const supplyBalance = await simpleLendingContract.userSupplies(signer.address, assetAddress);
        
        if (supplyBalance.toString() !== "0") {
          console.log(`💰 Found supply balance: ${hre.ethers.utils.formatUnits(supplyBalance, 18)} for asset ${assetAddress}`);
          
          // Withdraw the full amount to the signer's address
          console.log(`🔄 Withdrawing ${hre.ethers.utils.formatUnits(supplyBalance, 18)} from asset ${assetAddress}...`);
          
          const withdrawTx = await simpleLendingContract.withdraw(
            assetAddress, 
            supplyBalance, 
            signer.address
          );
          
          await withdrawTx.wait();
          console.log(`✅ Successfully withdrew from asset ${assetAddress}`);
          console.log(`📄 Transaction hash: ${withdrawTx.hash}`);
          totalWithdrawals++;
          
        } else {
          console.log(`⭕ No supply balance for asset ${assetAddress}`);
        }
      } catch (error: any) {
        console.log(`❌ Failed to withdraw from asset ${assetAddress}: ${error.message}`);
      }
    }

    if (totalWithdrawals === 0) {
      console.log("💡 No funds to withdraw for the current account");
    } else {
      console.log(`🎉 Successfully completed ${totalWithdrawals} withdrawals`);
    }

    // Check for any remaining borrowed amounts (warning only)
    let hasBorrows = false;
    for (const assetAddress of assetAddresses) {
      try {
        const borrowBalance = await simpleLendingContract.userBorrows(signer.address, assetAddress);
        if (borrowBalance.toString() !== "0") {
          console.log(`⚠️  Warning: Outstanding borrow balance of ${hre.ethers.utils.formatUnits(borrowBalance, 18)} for asset ${assetAddress}`);
          hasBorrows = true;
        }
      } catch (error) {
        // Ignore errors when checking borrow balances
      }
    }

    if (hasBorrows) {
      console.log("📝 Note: Outstanding borrows detected. Use repay functions to clear debt before withdrawing collateral.");
    }

  } catch (error: any) {
    console.error(`❌ Error during withdrawal process: ${error.message}`);
    throw error;
  }
};

task("withdraw-local", "Withdraw all funds from SimpleLending contract", main)
  .addParam("contract", "SimpleLending contract address", undefined, types.string)
  .addFlag("json", "Output in JSON format");