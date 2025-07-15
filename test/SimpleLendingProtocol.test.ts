import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { parseEther, parseUnits } from "viem";

describe("SimpleLendingProtocol", function () {
  async function deploySimpleLendingFixture() {
    const publicClient = await viem.getPublicClient();
    const [owner, user1, user2, liquidator] = await viem.getWalletClients();

    // Deploy SimplePriceOracle
    const priceOracle = await viem.deployContract("SimplePriceOracle", [owner.account.address]);

    // Deploy SimpleLendingProtocol
    const lendingProtocol = await viem.deployContract("SimpleLendingProtocol", [owner.account.address]);

    // Deploy Mock ZRC20 tokens
    const ethToken = await viem.deployContract("MockZRC20", [
      "Ethereum",
      "ETH",
      18,
      parseEther("1000000")
    ]);
    
    const usdcToken = await viem.deployContract("MockZRC20", [
      "USD Coin",
      "USDC", 
      6,
      parseUnits("1000000", 6)
    ]);

    // Add assets to lending protocol
    await lendingProtocol.write.addAsset([ethToken.address, 2000n], { account: owner.account });
    await lendingProtocol.write.addAsset([usdcToken.address, 1n], { account: owner.account });

    // Set prices in oracle
    await priceOracle.write.setPrice([ethToken.address, 2000n], { account: owner.account });
    await priceOracle.write.setPrice([usdcToken.address, 1n], { account: owner.account });

    // Transfer tokens to users
    await ethToken.write.transfer([user1.account.address, parseEther("100")]);
    await ethToken.write.transfer([user2.account.address, parseEther("100")]);
    await usdcToken.write.transfer([user1.account.address, parseUnits("100000", 6)]);
    await usdcToken.write.transfer([user2.account.address, parseUnits("100000", 6)]);
    await usdcToken.write.transfer([liquidator.account.address, parseUnits("50000", 6)]);
    
    // Provide initial liquidity to the protocol (send tokens directly to contract)
    await usdcToken.write.transfer([lendingProtocol.address, parseUnits("500000", 6)]); // 500k USDC liquidity
    await ethToken.write.transfer([lendingProtocol.address, parseEther("100")]);

    return {
      lendingProtocol,
      priceOracle,
      ethToken,
      usdcToken,
      owner,
      user1,
      user2,
      liquidator,
      publicClient
    };
  }

  describe("Asset Management", function () {
    it("Should add supported assets", async function () {
      const { lendingProtocol, ethToken } = await loadFixture(deploySimpleLendingFixture);
      
      const asset = await lendingProtocol.read.assets([ethToken.address]);
      expect(asset[0]).to.be.true; // isSupported
      expect(asset[1]).to.equal(parseEther("2000")); // price
    });

    it("Should update asset prices", async function () {
      const { lendingProtocol, ethToken, owner } = await loadFixture(deploySimpleLendingFixture);
      
      await lendingProtocol.write.updatePrice([ethToken.address, 2500n], { account: owner.account });
      const asset = await lendingProtocol.read.assets([ethToken.address]);
      expect(asset[1]).to.equal(parseEther("2500"));
    });
  });

  describe("Supply", function () {
    it("Should allow users to supply collateral", async function () {
      const { lendingProtocol, ethToken, user1, publicClient } = await loadFixture(deploySimpleLendingFixture);
      
      const supplyAmount = parseEther("10");
      
      await ethToken.write.approve([lendingProtocol.address, supplyAmount], { account: user1.account });
      
      const hash = await lendingProtocol.write.supply([ethToken.address, supplyAmount], { account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      const supplyBalance = await lendingProtocol.read.userSupplies([user1.account.address, ethToken.address]);
      expect(supplyBalance).to.equal(supplyAmount);
    });

    it("Should reject supply of unsupported asset", async function () {
      const { lendingProtocol, user1 } = await loadFixture(deploySimpleLendingFixture);
      
      const unsupportedToken = await viem.deployContract("MockZRC20", ["Unsupported", "UNSUP", 18, parseEther("1000")]);
      
      await expect(
        lendingProtocol.write.supply([unsupportedToken.address, parseEther("10")], { account: user1.account })
      ).to.be.rejectedWith("Asset not supported");
    });
  });

  describe("Borrow", function () {
    it("Should allow borrowing with sufficient collateral", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1, publicClient } = await loadFixture(deploySimpleLendingFixture);
      
      // Supply 10 ETH as collateral (worth $20,000)
      const supplyAmount = parseEther("10");
      await ethToken.write.approve([lendingProtocol.address, supplyAmount], { account: user1.account });
      await lendingProtocol.write.supply([ethToken.address, supplyAmount], { account: user1.account });

      // Borrow $10,000 USDC (health factor = 200%)
      const borrowAmount = parseUnits("10000", 6);
      
      const hash = await lendingProtocol.write.borrow([usdcToken.address, borrowAmount], { account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      const borrowBalance = await lendingProtocol.read.userBorrows([user1.account.address, usdcToken.address]);
      expect(borrowBalance).to.equal(borrowAmount);
    });

    it("Should prevent borrowing without sufficient collateral", async function () {
      const { lendingProtocol, usdcToken, user1 } = await loadFixture(deploySimpleLendingFixture);
      
      // Try to borrow without any collateral
      const borrowAmount = parseUnits("1000", 6);
      
      await expect(
        lendingProtocol.write.borrow([usdcToken.address, borrowAmount], { account: user1.account })
      ).to.be.rejectedWith("Insufficient collateral");
    });
  });

  describe("Repay", function () {
    it("Should allow repaying borrowed assets", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1, publicClient } = await loadFixture(deploySimpleLendingFixture);
      
      // Supply collateral and borrow
      const supplyAmount = parseEther("10");
      await ethToken.write.approve([lendingProtocol.address, supplyAmount], { account: user1.account });
      await lendingProtocol.write.supply([ethToken.address, supplyAmount], { account: user1.account });

      const borrowAmount = parseUnits("5000", 6);
      await lendingProtocol.write.borrow([usdcToken.address, borrowAmount], { account: user1.account });

      // Repay half the debt
      const repayAmount = parseUnits("2500", 6);
      await usdcToken.write.approve([lendingProtocol.address, repayAmount], { account: user1.account });
      
      const hash = await lendingProtocol.write.repay([usdcToken.address, repayAmount], { account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      const remainingDebt = await lendingProtocol.read.userBorrows([user1.account.address, usdcToken.address]);
      expect(remainingDebt).to.equal(borrowAmount - repayAmount);
    });
  });

  describe("Withdraw", function () {
    it("Should allow withdrawing supplied assets", async function () {
      const { lendingProtocol, ethToken, user1, publicClient } = await loadFixture(deploySimpleLendingFixture);
      
      // Supply collateral
      const supplyAmount = parseEther("10");
      await ethToken.write.approve([lendingProtocol.address, supplyAmount], { account: user1.account });
      await lendingProtocol.write.supply([ethToken.address, supplyAmount], { account: user1.account });

      // Withdraw half
      const withdrawAmount = parseEther("5");
      
      const hash = await lendingProtocol.write.withdraw([ethToken.address, withdrawAmount], { account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      const remainingSupply = await lendingProtocol.read.userSupplies([user1.account.address, ethToken.address]);
      expect(remainingSupply).to.equal(supplyAmount - withdrawAmount);
    });
  });

  describe("Health Factor", function () {
    it("Should calculate collateral and debt values correctly", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1 } = await loadFixture(deploySimpleLendingFixture);
      
      // Supply 5 ETH ($10,000)
      const supplyAmount = parseEther("5");
      await ethToken.write.approve([lendingProtocol.address, supplyAmount], { account: user1.account });
      await lendingProtocol.write.supply([ethToken.address, supplyAmount], { account: user1.account });

      // Borrow $4,000 USDC
      const borrowAmount = parseUnits("4000", 6);
      await lendingProtocol.write.borrow([usdcToken.address, borrowAmount], { account: user1.account });

      const collateralValue = await lendingProtocol.read.getCollateralValue([user1.account.address, ethToken.address]);
      const debtValue = await lendingProtocol.read.getDebtValue([user1.account.address, usdcToken.address]);
      
      expect(collateralValue).to.equal(parseEther("10000")); // 5 ETH * $2000
      expect(debtValue).to.equal(parseEther("4000"));        // 4000 USDC * $1 = $4000 in 18 decimals
    });
  });
});