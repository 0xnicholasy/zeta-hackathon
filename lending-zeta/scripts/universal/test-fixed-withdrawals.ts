import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Testing various withdrawal scenarios with the fixed contract...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("User address:", user.address);
  console.log("Network:", getNetwork(chainId).name);

  // Get contract addresses
  const contractsJson = require("../../contracts.json");
  const universalLendingAddress = contractsJson.networks[chainId.toString()].contracts.UniversalLendingProtocol;

  console.log("UniversalLendingProtocol address:", universalLendingAddress);

  // Connect to the contract
  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = UniversalLendingProtocol.attach(universalLendingAddress);

  // Test assets
  const testAssets = [
    { symbol: "SOL.SOL", destinationChain: 901, decimals: 9 },
    { symbol: "USDC.SOL", destinationChain: 901, decimals: 6 },
    { symbol: "USDC.ARBI", destinationChain: 421614, decimals: 6 },
    { symbol: "ETH.ARBI", destinationChain: 421614, decimals: 18 }
  ];

  const assets = [];
  console.log("\n=== Available Test Assets ===");
  
  for (const assetDef of testAssets) {
    try {
      const address = getTokenAddress(chainId, assetDef.symbol);
      const supply = await universalLendingProtocol.getSupplyBalance(user.address, address);
      if (supply.gt(0)) {
        assets.push({
          ...assetDef,
          address,
          supply
        });
        console.log(`${assetDef.symbol}: ${utils.formatUnits(supply, assetDef.decimals)} supplied`);
      } else {
        console.log(`${assetDef.symbol}: 0 supplied (skipping)`);
      }
    } catch (error) {
      console.log(`${assetDef.symbol}: Not found or error`);
    }
  }

  if (assets.length === 0) {
    console.log("\n❌ No assets with supply balance found for testing");
    return;
  }

  console.log("\n=== Testing Different Withdrawal Scenarios ===");

  for (const asset of assets) {
    console.log(`\n--- Testing ${asset.symbol} Withdrawal ---`);
    
    try {
      // Get gas requirements
      const [gasZRC20Address, gasFeeAmount] = await universalLendingProtocol.getWithdrawGasFee(asset.address);
      console.log(`Gas token: ${gasZRC20Address}`);
      console.log(`Gas fee: ${utils.formatUnits(gasFeeAmount, 9)} SOL`);
      
      // Determine withdrawal scenario
      const isSameTokenGas = asset.address.toLowerCase() === gasZRC20Address.toLowerCase();
      console.log(`Scenario: ${isSameTokenGas ? 'Same token (gas deducted)' : 'Different token (user pays gas)'}`);
      
      // Test small withdrawal
      const testAmount = asset.supply.div(10); // 10% of supply
      console.log(`Test amount: ${utils.formatUnits(testAmount, asset.decimals)} ${asset.symbol}`);
      
      // Check if withdrawal is possible
      const canWithdraw = await universalLendingProtocol.canWithdraw(user.address, asset.address, testAmount);
      console.log(`Can withdraw: ${canWithdraw}`);
      
      if (!canWithdraw) {
        console.log(`❌ Cannot withdraw ${asset.symbol} - would break collateral requirements`);
        continue;
      }
      
      // For different token scenario, check user gas balance
      if (!isSameTokenGas) {
        const IERC20_ABI = ["function balanceOf(address) external view returns (uint256)"];
        const gasToken = new ethers.Contract(gasZRC20Address, IERC20_ABI, user);
        const userGasBalance = await gasToken.balanceOf(user.address);
        
        console.log(`User gas balance: ${utils.formatUnits(userGasBalance, 9)} SOL`);
        
        if (userGasBalance.lt(gasFeeAmount)) {
          console.log(`❌ User has insufficient SOL for gas fees`);
          continue;
        }
      }
      
      console.log(`✅ ${asset.symbol} withdrawal test setup complete - ready for actual test`);
      
      // Static call test to check for the old error
      try {
        const destination = asset.destinationChain === 901 ? 
          ethers.utils.toUtf8Bytes("5t8QFUT3aGoeFx89c2qTh5JBhmCUTeFxRH9fSmLhMTX6") : 
          ethers.utils.solidityPack(["address"], [user.address]);

        await universalLendingProtocol.callStatic.withdrawCrossChain(
          asset.address,
          testAmount,
          asset.destinationChain,
          destination
        );
        
        console.log(`✅ Static call passed - no 0x10bad147 error!`);
        console.log(`🎉 Fix is working for ${asset.symbol}`);
        
      } catch (staticError: any) {
        if (staticError.data === "0x10bad147") {
          console.log(`❌ Still getting 0x10bad147 error - fix may not be deployed yet`);
        } else {
          console.log(`⚠️  Different error: ${staticError.message}`);
          if (staticError.data) {
            console.log(`Error data: ${staticError.data}`);
          }
        }
      }
      
    } catch (error: any) {
      console.error(`Error testing ${asset.symbol}:`, error.message);
    }
  }

  console.log("\n=== Test Summary ===");
  console.log("This script tests the contract fix by:");
  console.log("1. Finding assets with supply balances");
  console.log("2. Testing different withdrawal scenarios (same/different gas tokens)");
  console.log("3. Running static calls to check for the old 0x10bad147 error");
  console.log("4. Verifying the fix prevents the error");
  console.log("");
  console.log("If you see '✅ Static call passed' messages, the fix is working!");
  console.log("If you see '❌ Still getting 0x10bad147 error', redeploy the contract.");

  console.log("\n=== Next Steps ===");
  console.log("1. If tests pass, run actual withdrawals with the scripts");
  console.log("2. Test both Solana and EVM chain withdrawals");
  console.log("3. Monitor transaction success rates");
  console.log("4. Verify assets arrive on destination chains");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });