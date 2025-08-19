import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Starting withdrawal of all Solana user supplies...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const networkString = getNetwork(chainId).name;

  console.log("Withdrawing for account:", user.address);
  console.log("Network:", networkString);
  const balance = await ethers.provider.getBalance(user.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Get UniversalLendingProtocol contract address from contracts.json
  const contractsJson = require("../../contracts.json");
  const universalLendingAddress = contractsJson.networks[chainId.toString()].contracts.UniversalLendingProtocol;

  if (!universalLendingAddress || universalLendingAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("UniversalLendingProtocol not deployed on this network");
  }

  console.log("UniversalLendingProtocol address:", universalLendingAddress);

  // Connect to the contract
  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = UniversalLendingProtocol.attach(universalLendingAddress);

  // Get Solana ZRC-20 token addresses from centralized config
  const solanaTokens = [
    "SOL.SOL", "USDC.SOL"
  ];

  const tokenAddresses: Record<string, string> = {};
  console.log("\n=== Solana Token Addresses ===");
  
  for (const symbol of solanaTokens) {
    try {
      tokenAddresses[symbol] = getTokenAddress(chainId, symbol);
      console.log(`${symbol} address: ${tokenAddresses[symbol]}`);
    } catch (error) {
      console.log(`${symbol}: � Not found in network configuration`);
    }
  }

  // Define Solana chain constant
  const SOLANA_DEVNET_CHAIN_ID = 901;

  // Define supported Solana assets with their destination chain
  const assetDefinitions = [
    { symbol: "SOL.SOL", destinationChain: SOLANA_DEVNET_CHAIN_ID, decimals: 9 },
    { symbol: "USDC.SOL", destinationChain: SOLANA_DEVNET_CHAIN_ID, decimals: 6 }
  ];

  // Build assets array with only tokens that have valid addresses
  const assets = assetDefinitions
    .filter(assetDef => tokenAddresses[assetDef.symbol])
    .map(assetDef => ({
      symbol: assetDef.symbol,
      address: tokenAddresses[assetDef.symbol],
      destinationChain: assetDef.destinationChain,
      decimals: assetDef.decimals
    }));

  if (assets.length === 0) {
    console.log("No valid Solana assets found on this network");
    return;
  }

  console.log("\n=== Checking User Solana Supply Balances ===");

  let totalWithdrawals = 0;
  const withdrawalPromises = [];

  // Solana destination address
  const solanaDestinationAddress = "5t8QFUT3aGoeFx89c2qTh5JBhmCUTeFxRH9fSmLhMTX6";
  console.log("Solana destination address:", solanaDestinationAddress);

  for (const asset of assets) {
    try {
      // Get user's supply balance for this asset
      const supplyBalance = await universalLendingProtocol.getSupplyBalance(user.address, asset.address);

      if (supplyBalance.gt(0)) {
        console.log(`${asset.symbol}: ${utils.formatUnits(supplyBalance, asset.decimals)}`);

        // Check if user can withdraw (health factor check)
        const canWithdraw = await universalLendingProtocol.canWithdraw(user.address, asset.address, supplyBalance);

        if (canWithdraw) {
          console.log(`=> Can withdraw ${asset.symbol} - checking gas fee requirements`);

          try {
            // Get gas fee information using the contract's helper function
            const [gasZRC20Address, gasFeeAmount] = await universalLendingProtocol.getWithdrawGasFee(asset.address);

            console.log(`  Gas token: ${gasZRC20Address}`);
            console.log(`  Gas fee: ${gasFeeAmount.div(BigNumber.from(10).pow(9))} SOL`);

            if (asset.address === gasZRC20Address) {
              // Asset and gas token are the same - gas will be deducted from withdrawal
              console.log(`=> Same token for asset and gas - gas will be deducted from withdrawal amount`);
              console.log(`  Supply balance: ${utils.formatUnits(supplyBalance, asset.decimals)}`);
              console.log(`  Gas fee: ${utils.formatUnits(gasFeeAmount, asset.decimals)}`);
              console.log(`  Net withdrawal: ${utils.formatUnits(supplyBalance.sub(gasFeeAmount), asset.decimals)}`);
              
              if (supplyBalance.lte(gasFeeAmount)) {
                console.log(`=> BLOCKED: Supply balance too small to cover gas fees`);
                console.log(`   Need at least ${utils.formatUnits(gasFeeAmount, asset.decimals)} ${asset.symbol} for gas`);
                continue;
              }
            } else {
              // Asset and gas token are different - user provides gas tokens
              console.log(`=> Different gas token required - user will pay gas separately`);

              const IERC20_ABI = [
                "function balanceOf(address account) external view returns (uint256)",
                "function approve(address spender, uint256 amount) external returns (bool)",
                "function allowance(address owner, address spender) external view returns (uint256)"
              ];

              const gasToken = new ethers.Contract(gasZRC20Address, IERC20_ABI, user);
              
              // Check user gas balance
              const userGasBalance = await gasToken.balanceOf(user.address);
              console.log(`  User gas token balance: ${utils.formatUnits(userGasBalance, 9)} SOL`);

              if (userGasBalance.lt(gasFeeAmount)) {
                console.log(`=> BLOCKED: User needs ${utils.formatUnits(gasFeeAmount, 9)} SOL for gas but has ${utils.formatUnits(userGasBalance, 9)} SOL`);
                console.log(`   Solution: User needs more SOL.SOL tokens in their wallet`);
                continue;
              }

              // Check current allowance
              const currentAllowance = await gasToken.allowance(user.address, universalLendingAddress);
              console.log(`  Current gas token allowance: ${utils.formatUnits(currentAllowance, 9)} SOL`);

              // Approve gas tokens if needed
              if (currentAllowance.lt(gasFeeAmount)) {
                console.log(`  => Approving gas tokens for withdrawal...`);
                // Use approve with a buffer for better UX  
                const approveAmount = gasFeeAmount.mul(110).div(100); // 10% buffer
                const approveTx = await gasToken.approve(universalLendingAddress, approveAmount);
                console.log(`  Transaction hash: ${approveTx.hash}`);
                
                try {
                  await approveTx.wait();
                  console.log(`  => Gas tokens approved: ${utils.formatUnits(approveAmount, 9)} SOL`);
                } catch (waitError: any) {
                  if (waitError.message && waitError.message.includes("ethereum tx not found")) {
                    console.log(`  => Approval submitted (RPC confirmation issue)`);
                    console.log(`  Continuing with withdrawal - approval likely succeeded`);
                  } else {
                    throw waitError;
                  }
                }
              } else {
                console.log(`  => Sufficient allowance already exists`);
              }
            }

            console.log(`=> Proceeding with cross-chain withdrawal to Solana chain ${asset.destinationChain}`);

            // Convert Solana address to bytes for cross-chain call
            // Solana addresses are base58 encoded, but for cross-chain we need bytes
            const solanaAddressBytes = ethers.utils.toUtf8Bytes(solanaDestinationAddress);

            // Perform cross-chain withdrawal to Solana - contract will handle gas token validation internally
            const withdrawalPromise = universalLendingProtocol.withdrawCrossChain(
              asset.address,
              supplyBalance,
              asset.destinationChain,
              solanaAddressBytes,
              { gasLimit: 800000 }
            );

            withdrawalPromises.push({
              promise: withdrawalPromise,
              asset: asset.symbol,
              amount: supplyBalance
            });

            totalWithdrawals++;
          } catch (error: any) {
            console.log(`=> Error checking gas requirements for ${asset.symbol}:`, error.message);
          }
        } else {
          console.log(`=> BLOCKED: Cannot withdraw ${asset.symbol} - would break collateral ratio`);
        }
      } else {
        console.log(`${asset.symbol}: 0 (no balance to withdraw)`);
      }
    } catch (error: any) {
      console.error(`Error checking ${asset.symbol}:`, error.message);
    }
  }

  if (totalWithdrawals === 0) {
    console.log("\n=== No Solana withdrawals to process ===");
    console.log("Reasons could be:");
    console.log("1. No Solana supply balances");
    console.log("2. Would break collateral requirements");
    console.log("3. Insufficient gas tokens in lending contract");
    return;
  }

  console.log(`\n=== Processing ${totalWithdrawals} Solana Cross-Chain Withdrawals ===`);

  // Execute all withdrawals
  const results = [];
  for (const withdrawal of withdrawalPromises) {
    try {
      console.log(`Withdrawing ${withdrawal.asset} to Solana...`);
      const tx = await withdrawal.promise;
      console.log(`Transaction hash: ${tx.hash}`);

      try {
        const receipt = await tx.wait();
        console.log(`=> ${withdrawal.asset} withdrawal confirmed in block ${receipt.blockNumber}`);
      } catch (waitError: any) {
        if (waitError.message && waitError.message.includes("ethereum tx not found")) {
          console.log(`=> ${withdrawal.asset} transaction submitted but RPC confirmation failed (common ZetaChain testnet issue)`);
          console.log(`   Transaction may still be successful - check explorer: https://athens.explorer.zetachain.com/tx/${tx.hash}`);
          console.log(`   Waiting 10 seconds to check if balance changed...`);
          
          // Wait and check if balance actually changed
          await new Promise(resolve => setTimeout(resolve, 10000));
          try {
            const asset = assets.find(a => a.symbol === withdrawal.asset);
            if (asset) {
              const newSupplyBalance = await universalLendingProtocol.getSupplyBalance(user.address, asset.address);
              console.log(`   Updated supply balance: ${utils.formatUnits(newSupplyBalance, asset.decimals)} ${withdrawal.asset}`);
            }
          } catch (balanceCheckError) {
            console.log(`   Could not check updated balance`);
          }
        } else {
          throw waitError;
        }
      }

      results.push({
        asset: withdrawal.asset,
        amount: withdrawal.amount,
        txHash: tx.hash,
        status: "success"
      });
    } catch (error: any) {
      console.error(`=> ${withdrawal.asset} withdrawal failed:`, error.message);
      results.push({
        asset: withdrawal.asset,
        amount: withdrawal.amount,
        status: "failed",
        error: error.message
      });
    }
  }

  console.log("\n=== Solana Withdrawal Results Summary ===");
  for (const result of results) {
    if (result.status === "success") {
      const asset = assets.find(a => a.symbol === result.asset);
      const decimals = asset?.decimals || 18;
      console.log(`=> ${result.asset}: ${utils.formatUnits(result.amount, decimals)} - TX: ${result.txHash}`);
    } else {
      console.log(`=> ${result.asset}: Failed - ${result.error}`);
    }
  }

  // Get final account data
  console.log("\n=== Final Account Status ===");
  try {
    const totalCollateralValue = await universalLendingProtocol.getTotalCollateralValue(user.address);
    const totalDebtValue = await universalLendingProtocol.getTotalDebtValue(user.address);
    const healthFactor = await universalLendingProtocol.getHealthFactor(user.address);

    console.log("Total Collateral Value:", utils.formatEther(totalCollateralValue), "USD");
    console.log("Total Debt Value:", utils.formatEther(totalDebtValue), "USD");
    console.log("Health Factor:", healthFactor.eq(ethers.constants.MaxUint256) ? "" : utils.formatEther(healthFactor));
  } catch (error: any) {
    console.error("Error getting final account data:", error.message);
  }

  console.log("\n=== Solana withdrawal process completed! ===");
  console.log(`All Solana assets withdrawn to: ${solanaDestinationAddress}`);
  console.log("Cross-chain transfers may take a few minutes to appear on Solana");
  console.log("Note: This script withdraws all Solana assets (SOL.SOL, USDC.SOL) to the specified Solana address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });