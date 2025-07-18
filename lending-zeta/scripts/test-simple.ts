import { ethers } from "hardhat";
import {
  getContractAddress,
  getTokenAddress,
  getNetwork
} from "../utils/contracts";

async function main() {
  console.log("Starting simple lending protocol testing...");

  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("Testing with accounts:");
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);

  // Load deployment addresses from centralized config
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const networkConfig = getNetwork(chainId);
  console.log("Testing on network:", networkConfig.name);

  // Get contract addresses
  let simpleLendingProtocolAddress: string;
  let simplePriceOracleAddress: string;
  let ethArbiAddress: string;
  let usdcArbiAddress: string;

  try {
    simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");
    simplePriceOracleAddress = getContractAddress(chainId, "SimplePriceOracle");
    ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
    usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");
  } catch (error) {
    console.error(`Contracts not deployed on ${networkConfig.name}. Please run deployment first.`);
    console.error(error);
    process.exit(1);
  }

  // Get contract instances
  const simpleLendingProtocol = await ethers.getContractAt("SimpleLendingProtocol", simpleLendingProtocolAddress);
  const simplePriceOracle = await ethers.getContractAt("SimplePriceOracle", simplePriceOracleAddress);

  // Token instances
  const ethArbi = await ethers.getContractAt("MockZRC20", ethArbiAddress);
  const usdcArbi = await ethers.getContractAt("MockZRC20", usdcArbiAddress);

  console.log("\n=== Test 1: Supply Collateral ===");

  // Mint tokens to users
  console.log("Minting tokens to users...");
  await ethArbi.mint(user1.address, ethers.utils.parseEther("10")); // 10 ETH
  await usdcArbi.mint(user1.address, ethers.utils.parseUnits("5000", 6)); // 5000 USDC
  await usdcArbi.mint(user2.address, ethers.utils.parseUnits("3000", 6)); // 3000 USDC for user2

  console.log("User1 ETH balance:", ethers.utils.formatEther(await ethArbi.balanceOf(user1.address)));
  console.log("User1 USDC balance:", ethers.utils.formatUnits(await usdcArbi.balanceOf(user1.address), 6));
  console.log("User2 USDC balance:", ethers.utils.formatUnits(await usdcArbi.balanceOf(user2.address), 6));

  // User1 supplies ETH as collateral
  console.log("\nUser1 supplying 5 ETH as collateral...");
  const supplyAmount = ethers.utils.parseEther("5");
  await ethArbi.connect(user1).approve(simpleLendingProtocol.address, supplyAmount);
  await simpleLendingProtocol.connect(user1).supply(ethArbi.address, supplyAmount);

  console.log("User1 ETH supply balance:", ethers.utils.formatEther(await ethArbi.balanceOf(simpleLendingProtocol.address)));

  // User1 also supplies some USDC to protocol for liquidity
  console.log("User1 supplying 3000 USDC for liquidity...");
  const usdcSupplyAmount = ethers.utils.parseUnits("3000", 6);
  await usdcArbi.connect(user1).approve(simpleLendingProtocol.address, usdcSupplyAmount);
  await simpleLendingProtocol.connect(user1).supply(usdcArbi.address, usdcSupplyAmount);

  console.log("\n=== Test 2: Check Health Factor ===");

  const healthFactorBefore = await simpleLendingProtocol.getHealthFactor(user1.address);
  console.log("User1 health factor before borrow:", ethers.utils.formatUnits(healthFactorBefore, 0));

  const collateralValue = await simpleLendingProtocol.getTotalCollateralValue(user1.address);
  const debtValue = await simpleLendingProtocol.getTotalDebtValue(user1.address);
  console.log("User1 total collateral value:", ethers.utils.formatEther(collateralValue));
  console.log("User1 total debt value:", ethers.utils.formatEther(debtValue));

  console.log("\n=== Test 3: Borrow Against Collateral ===");

  // User1 borrows USDC against ETH collateral
  console.log("User1 borrowing 2000 USDC against ETH collateral...");
  const borrowAmount = ethers.utils.parseUnits("2000", 6);

  // Check if user can borrow
  const canBorrow = await simpleLendingProtocol.canBorrow(user1.address, usdcArbi.address, borrowAmount);
  console.log("Can user1 borrow 2000 USDC?", canBorrow);

  if (canBorrow) {
    try {
      await simpleLendingProtocol.connect(user1).borrow(usdcArbi.address, borrowAmount);
      console.log("Borrow successful!");

      const user1UsdcBalance = await usdcArbi.balanceOf(user1.address);
      console.log("User1 USDC balance after borrow:", ethers.utils.formatUnits(user1UsdcBalance, 6));

      const healthFactorAfter = await simpleLendingProtocol.getHealthFactor(user1.address);
      console.log("User1 health factor after borrow:", ethers.utils.formatUnits(healthFactorAfter, 0));

    } catch (error) {
      console.error("Borrow failed:", error);
    }
  }

  console.log("\n=== Test 4: Repay Debt ===");

  // User1 repays part of the debt
  console.log("User1 repaying 500 USDC...");
  const repayAmount = ethers.utils.parseUnits("500", 6);
  await usdcArbi.connect(user1).approve(simpleLendingProtocol.address, repayAmount);
  await simpleLendingProtocol.connect(user1).repay(usdcArbi.address, repayAmount);

  const healthFactorAfterRepay = await simpleLendingProtocol.getHealthFactor(user1.address);
  console.log("User1 health factor after repay:", ethers.utils.formatUnits(healthFactorAfterRepay, 0));

  console.log("\n=== Test 5: Liquidation Scenario ===");

  // Simulate price drop to trigger liquidation
  console.log("Simulating ETH price drop to trigger liquidation...");
  await simplePriceOracle.setPrice(ethArbi.address, 800); // Drop ETH price to $800

  const healthFactorAfterPriceDrop = await simpleLendingProtocol.getHealthFactor(user1.address);
  console.log("User1 health factor after price drop:", ethers.utils.formatUnits(healthFactorAfterPriceDrop, 0));

  const isLiquidatable = await simpleLendingProtocol.isLiquidatable(user1.address);
  console.log("Is user1 liquidatable?", isLiquidatable);

  // User2 attempts liquidation
  if (isLiquidatable) {
    console.log("User1 is liquidatable. User2 attempting liquidation...");

    const liquidationAmount = ethers.utils.parseUnits("500", 6);

    await usdcArbi.connect(user2).approve(simpleLendingProtocol.address, liquidationAmount);

    try {
      await simpleLendingProtocol.connect(user2).liquidate(
        user1.address,       // user being liquidated
        ethArbi.address,     // collateral asset
        usdcArbi.address,    // debt asset
        liquidationAmount    // amount to repay
      );
      console.log("Liquidation successful!");

      const user2EthBalance = await ethArbi.balanceOf(user2.address);
      console.log("User2 ETH balance after liquidation:", ethers.utils.formatEther(user2EthBalance));

      const healthFactorAfterLiquidation = await simpleLendingProtocol.getHealthFactor(user1.address);
      console.log("User1 health factor after liquidation:", ethers.utils.formatUnits(healthFactorAfterLiquidation, 0));

    } catch (error) {
      console.error("Liquidation failed:", error);
    }
  }

  console.log("\n=== Test 6: Withdraw Collateral ===");

  // User1 tries to withdraw some collateral
  console.log("User1 attempting to withdraw 1 ETH...");
  const withdrawAmount = ethers.utils.parseEther("1");

  const canWithdraw = await simpleLendingProtocol.canWithdraw(user1.address, ethArbi.address, withdrawAmount);
  console.log("Can user1 withdraw 1 ETH?", canWithdraw);

  if (canWithdraw) {
    try {
      await simpleLendingProtocol.connect(user1).withdraw(ethArbi.address, withdrawAmount);
      console.log("Withdrawal successful!");

      const user1EthBalanceAfterWithdraw = await ethArbi.balanceOf(user1.address);
      console.log("User1 ETH balance after withdrawal:", ethers.utils.formatEther(user1EthBalanceAfterWithdraw));

    } catch (error) {
      console.error("Withdrawal failed:", error);
    }
  }

  console.log("\n=== Test 7: Edge Cases ===");

  // Test borrowing with insufficient collateral
  console.log("Testing borrow with insufficient collateral...");
  const largeBorrowAmount = ethers.utils.parseUnits("10000", 6);

  try {
    await simpleLendingProtocol.connect(user1).borrow(usdcArbi.address, largeBorrowAmount);
    console.log("Large borrow succeeded unexpectedly!");
  } catch (error) {
    console.log("Large borrow correctly failed:", error instanceof Error ? error.message : "Unknown error");
  }

  // Test withdrawal that would break health factor
  console.log("Testing withdrawal that would break health factor...");
  const largeWithdrawAmount = ethers.utils.parseEther("10");

  try {
    await simpleLendingProtocol.connect(user1).withdraw(ethArbi.address, largeWithdrawAmount);
    console.log("Large withdrawal succeeded unexpectedly!");
  } catch (error) {
    console.log("Large withdrawal correctly failed:", error instanceof Error ? error.message : "Unknown error");
  }

  console.log("\n=== Simple Testing Complete ===");
  console.log("All simple lending protocol tests completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });