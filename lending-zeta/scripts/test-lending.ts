import { ethers } from "hardhat";
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers/src.ts/utils";
import * as fs from "fs";

async function main() {
  console.log("Starting lending protocol testing...");

  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("Testing with accounts:");
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);

  // Load deployment addresses
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deploymentFile = `deployments-${chainId}.json`;

  if (!fs.existsSync(deploymentFile)) {
    console.error(`Deployment file ${deploymentFile} not found. Please run deployment and initialization first.`);
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  console.log("Loaded deployment info from:", deploymentFile);

  // Get contract instances
  const lendingProtocol = await ethers.getContractAt("LendingProtocol", deploymentInfo.contracts.lending.LendingProtocol);
  const priceOracle = await ethers.getContractAt("PriceOracle", deploymentInfo.contracts.oracles.PriceOracle);

  // Token instances
  const ethArbi = await ethers.getContractAt("MockZRC20", deploymentInfo.contracts.tokens["ETH.ARBI"]);
  const usdcArbi = await ethers.getContractAt("MockZRC20", deploymentInfo.contracts.tokens["USDC.ARBI"]);
  const usdtBase = await ethers.getContractAt("MockZRC20", deploymentInfo.contracts.tokens["USDT.BASE"]);

  console.log("\n=== Test 1: Supply Collateral ===");

  // Mint tokens to users
  console.log("Minting tokens to users...");
  await ethArbi.mint(user1.address, parseEther("10")); // 10 ETH
  await usdcArbi.mint(user1.address, parseUnits("5000", 6)); // 5000 USDC
  await usdtBase.mint(user2.address, parseUnits("3000", 6)); // 3000 USDT

  console.log("User1 ETH balance:", formatEther(await ethArbi.balanceOf(user1.address)));
  console.log("User1 USDC balance:", formatUnits(await usdcArbi.balanceOf(user1.address), 6));
  console.log("User2 USDT balance:", formatUnits(await usdtBase.balanceOf(user2.address), 6));

  // User1 supplies ETH as collateral
  console.log("\nUser1 supplying 5 ETH as collateral...");
  const supplyAmount = parseEther("5");
  await ethArbi.connect(user1).approve(lendingProtocol.address, supplyAmount);
  await lendingProtocol.connect(user1).supply(ethArbi.address, supplyAmount, user1.address);

  const user1EthSupply = await lendingProtocol.getSupplyBalance(user1.address, ethArbi.address);
  console.log("User1 ETH supply balance:", formatEther(user1EthSupply));

  console.log("\n=== Test 2: Borrow Against Collateral ===");

  // User1 borrows USDC against ETH collateral
  console.log("User1 borrowing 2000 USDC against ETH collateral...");
  const borrowAmount = parseUnits("2000", 6);

  // Check user account data before borrow
  const accountDataBefore = await lendingProtocol.getUserAccountData(user1.address);
  console.log("User1 account data before borrow:");
  console.log("  Total collateral value:", formatEther(accountDataBefore.totalCollateralValue));
  console.log("  Total debt value:", formatEther(accountDataBefore.totalDebtValue));
  console.log("  Health factor:", formatEther(accountDataBefore.healthFactor));

  try {
    await lendingProtocol.connect(user1).borrow(usdcArbi.address, borrowAmount, user1.address);
    console.log("Borrow successful!");

    const user1UsdcBorrow = await lendingProtocol.getBorrowBalance(user1.address, usdcArbi.address);
    console.log("User1 USDC borrow balance:", formatUnits(user1UsdcBorrow, 6));

    // Check user account data after borrow
    const accountDataAfter = await lendingProtocol.getUserAccountData(user1.address);
    console.log("User1 account data after borrow:");
    console.log("  Total collateral value:", formatEther(accountDataAfter.totalCollateralValue));
    console.log("  Total debt value:", formatEther(accountDataAfter.totalDebtValue));
    console.log("  Health factor:", formatEther(accountDataAfter.healthFactor));

  } catch (error) {
    console.error("Borrow failed:", error);
  }

  console.log("\n=== Test 3: Repay Debt ===");

  // User1 repays part of the debt
  console.log("User1 repaying 500 USDC...");
  const repayAmount = parseUnits("500", 6);
  await usdcArbi.connect(user1).approve(lendingProtocol.address, repayAmount);
  await lendingProtocol.connect(user1).repay(usdcArbi.address, repayAmount, user1.address);

  const user1UsdcBorrowAfterRepay = await lendingProtocol.getBorrowBalance(user1.address, usdcArbi.address);
  console.log("User1 USDC borrow balance after repay:", formatUnits(user1UsdcBorrowAfterRepay, 6));

  console.log("\n=== Test 4: Liquidation Scenario ===");

  // Simulate price drop to trigger liquidation
  console.log("Simulating ETH price drop to trigger liquidation...");
  await priceOracle.setPriceInUSD(ethArbi.address, 800); // Drop ETH price to $800

  const healthFactorAfterPriceDrop = await lendingProtocol.getHealthFactor(user1.address);
  console.log("User1 health factor after price drop:", formatEther(healthFactorAfterPriceDrop));

  // User2 attempts liquidation
  if (healthFactorAfterPriceDrop < parseEther("1.2")) {
    console.log("User1 is liquidatable. User2 attempting liquidation...");

    // User2 needs USDC to repay debt
    await usdcArbi.mint(user2.address, parseUnits("1000", 6));
    const liquidationAmount = parseUnits("500", 6);

    await usdcArbi.connect(user2).approve(lendingProtocol.address, liquidationAmount);

    try {
      await lendingProtocol.connect(user2).liquidate(
        ethArbi.address,      // collateral asset
        usdcArbi.address,     // debt asset
        user1.address,       // user being liquidated
        liquidationAmount    // amount to repay
      );
      console.log("Liquidation successful!");

      const user2EthBalance = await ethArbi.balanceOf(user2.address);
      console.log("User2 ETH balance after liquidation:", formatEther(user2EthBalance));

    } catch (error) {
      console.error("Liquidation failed:", error);
    }
  }

  console.log("\n=== Test 5: Withdraw Collateral ===");

  // User1 tries to withdraw some collateral
  console.log("User1 attempting to withdraw 1 ETH...");
  const withdrawAmount = parseEther("1");

  try {
    await lendingProtocol.connect(user1).withdraw(ethArbi.address, withdrawAmount, user1.address);
    console.log("Withdrawal successful!");

    const user1EthSupplyAfterWithdraw = await lendingProtocol.getSupplyBalance(user1.address, ethArbi.address);
    console.log("User1 ETH supply balance after withdrawal:", formatEther(user1EthSupplyAfterWithdraw));

  } catch (error) {
    console.error("Withdrawal failed:", error);
  }

  console.log("\n=== Testing Complete ===");
  console.log("All lending protocol tests completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });