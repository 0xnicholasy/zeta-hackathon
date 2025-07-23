import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Testing cross-chain borrowing functionality...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const networkString = getNetwork(chainId).name;

  console.log("Borrowing for account:", user.address);
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

  // Define borrowing test cases with their destination chains
  const borrowTests = [
    { 
      symbol: "ETH.ARBI", 
      address: ethArbiAddress, 
      destinationChain: 421614, // Arbitrum Sepolia
      borrowAmount: ethers.utils.parseEther("0.001") // 0.001 ETH
    },
    { 
      symbol: "USDC.ARBI", 
      address: usdcArbiAddress, 
      destinationChain: 421614, // Arbitrum Sepolia
      borrowAmount: ethers.utils.parseUnits("1", 6) // 1 USDC
    },
    { 
      symbol: "ETH.ETH", 
      address: ethEthAddress, 
      destinationChain: 11155111, // Ethereum Sepolia
      borrowAmount: ethers.utils.parseEther("0.001") // 0.001 ETH
    },
    { 
      symbol: "USDC.ETH", 
      address: usdcEthAddress, 
      destinationChain: 11155111, // Ethereum Sepolia
      borrowAmount: ethers.utils.parseUnits("1", 6) // 1 USDC
    }
  ];

  console.log("\n=== Checking Current User Position ===");
  
  try {
    const totalCollateralValue = await simpleLendingProtocol.getTotalCollateralValue(user.address);
    const totalDebtValue = await simpleLendingProtocol.getTotalDebtValue(user.address);
    const healthFactor = await simpleLendingProtocol.getHealthFactor(user.address);
    const maxAvailableBorrowsInUsd = await simpleLendingProtocol.maxAvailableBorrowsInUsd(user.address);
    
    console.log("Total Collateral Value:", utils.formatEther(totalCollateralValue), "USD");
    console.log("Total Debt Value:", utils.formatEther(totalDebtValue), "USD");
    console.log("Max Available Borrows:", utils.formatEther(maxAvailableBorrowsInUsd), "USD");
    console.log("Health Factor:", healthFactor.eq(ethers.constants.MaxUint256) ? "∞" : utils.formatEther(healthFactor));
    
    if (totalCollateralValue.eq(0)) {
      console.log("\n❌ No collateral supplied - cannot borrow");
      console.log("Please supply collateral first using the deposit scripts");
      return;
    }
    
    if (maxAvailableBorrowsInUsd.eq(0)) {
      console.log("\n❌ No borrowing capacity available");
      console.log("Either no collateral or already at maximum borrow ratio");
      return;
    }
  } catch (error: any) {
    console.error("Error getting account data:", error.message);
    return;
  }

  console.log("\n=== Testing Cross-Chain Borrow Operations ===");
  
  let totalBorrows = 0;
  const borrowPromises = [];

  for (const borrowTest of borrowTests) {
    try {
      console.log(`\n--- Testing ${borrowTest.symbol} Borrow ---`);
      
      // Check if user can borrow this amount
      const canBorrow = await simpleLendingProtocol.canBorrow(user.address, borrowTest.address, borrowTest.borrowAmount);
      
      if (!canBorrow) {
        console.log(`=> BLOCKED: Cannot borrow ${borrowTest.symbol} - insufficient collateral`);
        continue;
      }
      
      // Check contract liquidity
      const IERC20_ABI = [
        "function balanceOf(address account) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)"
      ];
      const assetToken = new ethers.Contract(borrowTest.address, IERC20_ABI, user);
      const contractBalance = await assetToken.balanceOf(simpleLendingAddress);
      
      if (contractBalance.lt(borrowTest.borrowAmount)) {
        console.log(`=> BLOCKED: Insufficient contract liquidity for ${borrowTest.symbol}`);
        console.log(`  Contract has: ${utils.formatUnits(contractBalance, borrowTest.symbol.includes("USDC") ? 6 : 18)}`);
        console.log(`  Need: ${utils.formatUnits(borrowTest.borrowAmount, borrowTest.symbol.includes("USDC") ? 6 : 18)}`);
        continue;
      }
      
      console.log(`=> Can borrow ${borrowTest.symbol} - checking gas fee requirements`);
      
      try {
        // Get gas fee information using the contract's helper function
        const [gasZRC20Address, gasFeeAmount] = await simpleLendingProtocol.getWithdrawGasFee(borrowTest.address);
        
        console.log(`  Gas token: ${gasZRC20Address}`);
        console.log(`  Gas fee: ${utils.formatEther(gasFeeAmount)} ETH`);
        
        const gasToken = new ethers.Contract(gasZRC20Address, IERC20_ABI, user);
        
        if (borrowTest.address === gasZRC20Address) {
          // Asset and gas token are the same - contract needs enough balance
          const totalNeeded = borrowTest.borrowAmount.add(gasFeeAmount);
          if (contractBalance.lt(totalNeeded)) {
            console.log(`=> BLOCKED: Contract needs ${utils.formatEther(totalNeeded)} but has ${utils.formatEther(contractBalance)}`);
            continue;
          }
          console.log(`=> Same token for asset and gas - proceeding with borrow`);
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
        }
        
        console.log(`=> Proceeding with cross-chain borrow to chain ${borrowTest.destinationChain}`);
        
        // Perform cross-chain borrow
        const borrowPromise = simpleLendingProtocol.borrowCrossChain(
          borrowTest.address,
          borrowTest.borrowAmount,
          borrowTest.destinationChain,
          user.address,
          { gasLimit: 800000 }
        );
        
        borrowPromises.push({
          promise: borrowPromise,
          asset: borrowTest.symbol,
          amount: borrowTest.borrowAmount
        });
        
        totalBorrows++;
      } catch (error: any) {
        console.log(`=> Error checking gas requirements for ${borrowTest.symbol}:`, error.message);
      }
    } catch (error: any) {
      console.error(`Error checking ${borrowTest.symbol}:`, error.message);
    }
  }

  if (totalBorrows === 0) {
    console.log("\n=== No borrows to process ===");
    console.log("Reasons could be:");
    console.log("1. Insufficient collateral");
    console.log("2. Insufficient contract liquidity"); 
    console.log("3. Insufficient gas tokens for user");
    return;
  }

  console.log(`\n=== Processing ${totalBorrows} Cross-Chain Borrows ===`);

  // Execute all borrows
  const results = [];
  for (const borrow of borrowPromises) {
    try {
      console.log(`Borrowing ${borrow.asset}...`);
      const tx = await borrow.promise;
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`=> ${borrow.asset} borrow confirmed in block ${receipt.blockNumber}`);
      
      results.push({
        asset: borrow.asset,
        amount: borrow.amount,
        txHash: tx.hash,
        status: "success"
      });
    } catch (error: any) {
      console.error(`=> ${borrow.asset} borrow failed:`, error.message);
      results.push({
        asset: borrow.asset,
        amount: borrow.amount,
        status: "failed",
        error: error.message
      });
    }
  }

  console.log("\n=== Borrow Results Summary ===");
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
    const totalCollateralValue = await simpleLendingProtocol.getTotalCollateralValue(user.address);
    const totalDebtValue = await simpleLendingProtocol.getTotalDebtValue(user.address);
    const healthFactor = await simpleLendingProtocol.getHealthFactor(user.address);
    const maxAvailableBorrowsInUsd = await simpleLendingProtocol.maxAvailableBorrowsInUsd(user.address);
    
    console.log("Total Collateral Value:", utils.formatEther(totalCollateralValue), "USD");
    console.log("Total Debt Value:", utils.formatEther(totalDebtValue), "USD");
    console.log("Max Available Borrows:", utils.formatEther(maxAvailableBorrowsInUsd), "USD");
    console.log("Health Factor:", healthFactor.eq(ethers.constants.MaxUint256) ? "∞" : utils.formatEther(healthFactor));
  } catch (error: any) {
    console.error("Error getting final account data:", error.message);
  }

  console.log("\n=== Cross-Chain Borrow Test Completed! ===");
  console.log("Cross-chain transfers may take a few minutes to appear on destination chains");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });