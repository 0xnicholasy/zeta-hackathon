import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Starting withdrawal of all user supplies...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const networkString = getNetwork(chainId).name;

  console.log("Withdrawing for account:", user.address);
  console.log("Network:", networkString);
  const balance = await ethers.provider.getBalance(user.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Get SimpleLendingProtocol contract address from contracts.json
  const contractsJson = require("../../contracts.json");
  const simpleLendingAddress = contractsJson.networks[chainId.toString()].contracts.SimpleLendingProtocol;
  
  if (!simpleLendingAddress || simpleLendingAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("SimpleLendingProtocol not deployed on this network");
  }

  console.log("SimpleLendingProtocol address:", simpleLendingAddress);

  // Connect to the contract
  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = SimpleLendingProtocol.attach(simpleLendingAddress);

  // Get all ZRC-20 token addresses from centralized config
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  const usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");
  const ethEthAddress = getTokenAddress(chainId, "ETH.ETH");
  const usdcEthAddress = getTokenAddress(chainId, "USDC.ETH");

  console.log("\n=== Token Addresses ===");
  console.log("ETH.ARBI address:", ethArbiAddress);
  console.log("USDC.ARBI address:", usdcArbiAddress);
  console.log("ETH.ETH address:", ethEthAddress);
  console.log("USDC.ETH address:", usdcEthAddress);

  // Define supported assets with their destination chains
  const assets = [
    { 
      symbol: "ETH.ARBI", 
      address: ethArbiAddress, 
      destinationChain: 421614 // Arbitrum Sepolia
    },
    { 
      symbol: "USDC.ARBI", 
      address: usdcArbiAddress, 
      destinationChain: 421614 // Arbitrum Sepolia
    },
    { 
      symbol: "ETH.ETH", 
      address: ethEthAddress, 
      destinationChain: 11155111 // Ethereum Sepolia
    },
    { 
      symbol: "USDC.ETH", 
      address: usdcEthAddress, 
      destinationChain: 11155111 // Ethereum Sepolia
    }
  ];

  console.log("\n=== Checking User Supply Balances ===");
  
  let totalWithdrawals = 0;
  const withdrawalPromises = [];

  for (const asset of assets) {
    try {
      // Get user's supply balance for this asset
      const supplyBalance = await simpleLendingProtocol.getSupplyBalance(user.address, asset.address);
      
      if (supplyBalance.gt(0)) {
        console.log(`${asset.symbol}: ${utils.formatUnits(supplyBalance, asset.symbol.includes("USDC") ? 6 : 18)}`);
        
        // Check if user can withdraw (health factor check)
        const canWithdraw = await simpleLendingProtocol.canWithdraw(user.address, asset.address, supplyBalance);
        
        if (canWithdraw) {
          console.log(`=> Can withdraw ${asset.symbol} - checking gas fee requirements`);
          
          try {
            // Get gas fee information using the contract's helper function
            const [gasZRC20Address, gasFeeAmount] = await simpleLendingProtocol.getWithdrawGasFee(asset.address);
            
            console.log(`  Gas token: ${gasZRC20Address}`);
            console.log(`  Gas fee: ${utils.formatEther(gasFeeAmount)} ETH`);
            
            const IERC20_ABI = [
              "function balanceOf(address account) external view returns (uint256)",
              "function approve(address spender, uint256 amount) external returns (bool)",
              "function allowance(address owner, address spender) external view returns (uint256)"
            ];
            
            const gasToken = new ethers.Contract(gasZRC20Address, IERC20_ABI, user);
            
            if (asset.address === gasZRC20Address) {
              // Asset and gas token are the same - contract has enough balance already
              console.log(`=> Same token for asset and gas - proceeding with withdrawal`);
              
              // Perform cross-chain withdrawal
              const withdrawalPromise = simpleLendingProtocol.withdrawCrossChain(
                asset.address,
                supplyBalance,
                asset.destinationChain,
                user.address,
                { gasLimit: 800000 }
              );
              
              withdrawalPromises.push({
                promise: withdrawalPromise,
                asset: asset.symbol,
                amount: supplyBalance
              });
              
              totalWithdrawals++;
            } else {
              // Asset and gas token are different - user needs to provide gas tokens
              console.log(`=> Different gas token required - checking user balance and approval`);
              
              const userGasBalance = await gasToken.balanceOf(user.address);
              console.log(`  User gas token balance: ${utils.formatEther(userGasBalance)}`);
              
              if (userGasBalance.lt(gasFeeAmount)) {
                console.log(`=> BLOCKED: User needs ${utils.formatEther(gasFeeAmount)} gas tokens but has ${utils.formatEther(userGasBalance)}`);
                console.log(`   Solution: User needs more ${gasZRC20Address} tokens`);
                continue;
              }
              
              // Check current allowance
              const currentAllowance = await gasToken.allowance(user.address, simpleLendingAddress);
              console.log(`  Current gas token allowance: ${utils.formatEther(currentAllowance)}`);
              
              // Approve gas tokens if needed
              if (currentAllowance.lt(gasFeeAmount)) {
                console.log(`  => Approving gas tokens...`);
                const approveTx = await gasToken.approve(simpleLendingAddress, gasFeeAmount);
                await approveTx.wait();
                console.log(`  => Gas tokens approved`);
              }
              
              console.log(`=> Proceeding with cross-chain withdrawal to chain ${asset.destinationChain}`);
              
              // Perform cross-chain withdrawal
              const withdrawalPromise = simpleLendingProtocol.withdrawCrossChain(
                asset.address,
                supplyBalance,
                asset.destinationChain,
                user.address,
                { gasLimit: 800000 }
              );
              
              withdrawalPromises.push({
                promise: withdrawalPromise,
                asset: asset.symbol,
                amount: supplyBalance
              });
              
              totalWithdrawals++;
            }
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
    console.log("\n=== No withdrawals to process ===");
    console.log("Reasons could be:");
    console.log("1. No supply balances");
    console.log("2. Would break collateral requirements"); 
    console.log("3. Insufficient gas tokens in lending contract");
    return;
  }

  console.log(`\n=== Processing ${totalWithdrawals} Cross-Chain Withdrawals ===`);

  // Execute all withdrawals
  const results = [];
  for (const withdrawal of withdrawalPromises) {
    try {
      console.log(`Withdrawing ${withdrawal.asset}...`);
      const tx = await withdrawal.promise;
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`=> ${withdrawal.asset} withdrawal confirmed in block ${receipt.blockNumber}`);
      
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

  console.log("\n=== Withdrawal Results Summary ===");
  for (const result of results) {
    if (result.status === "success") {
      const decimals = result.asset.includes("USDC") ? 6 : 18;
      console.log(`=> ${result.asset}: ${utils.formatUnits(result.amount, decimals)} - TX: ${result.txHash}`);
    } else {
      console.log(`=> ${result.asset}: Failed - ${result.error}`);
    }
  }

  // Get final account data
  console.log("\n=== Final Account Status ===");
  try {
    const accountData = await simpleLendingProtocol.getUserAccountData(user.address);
    console.log("Total Collateral Value:", utils.formatEther(accountData.totalCollateralValue), "USD");
    console.log("Total Debt Value:", utils.formatEther(accountData.totalDebtValue), "USD");
    console.log("Health Factor:", accountData.healthFactor.eq(ethers.constants.MaxUint256) ? "∞" : utils.formatEther(accountData.healthFactor));
  } catch (error: any) {
    console.error("Error getting final account data:", error.message);
  }

  console.log("\n=== Withdrawal process completed! ===");
  console.log("Cross-chain transfers may take a few minutes to appear on destination chains");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });