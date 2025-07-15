import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { parseEther, parseUnits } from "viem";

describe("LendingProtocol", function () {
  async function deployLendingProtocolFixture() {
    const [owner, user1, user2, liquidator] = await ethers.getSigners();

    // Deploy MockPriceOracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    const priceOracle = await MockPriceOracle.deploy();

    // Deploy LendingProtocol
    const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
    const lendingProtocol = await LendingProtocol.deploy(
      await priceOracle.getAddress(),
      owner.address
    );

    // Deploy Mock ZRC20 tokens
    const MockZRC20 = await ethers.getContractFactory("MockZRC20");
    
    const ethToken = await MockZRC20.deploy(
      "Ethereum",
      "ETH.ARBI",
      18,
      parseEther("1000000")
    );
    
    const usdcToken = await MockZRC20.deploy(
      "USD Coin",
      "USDC.ARBI", 
      6,
      parseUnits("1000000", 6)
    );

    // Set up assets in lending protocol
    await lendingProtocol.addAsset(
      await ethToken.getAddress(),
      parseEther("0.8"), // 80% collateral factor
      parseEther("0.85"), // 85% liquidation threshold
      parseEther("0.05")  // 5% liquidation bonus
    );

    await lendingProtocol.addAsset(
      await usdcToken.getAddress(),
      parseEther("0.9"), // 90% collateral factor
      parseEther("0.9"),  // 90% liquidation threshold
      parseEther("0.05")  // 5% liquidation bonus
    );

    // Set prices: ETH = $2000, USDC = $1
    await priceOracle.setPriceInUSD(await ethToken.getAddress(), 2000);
    await priceOracle.setPriceInUSD(await usdcToken.getAddress(), 1);

    // Transfer tokens to users
    await ethToken.transfer(user1.address, parseEther("100"));
    await ethToken.transfer(user2.address, parseEther("100"));
    await usdcToken.transfer(user1.address, parseUnits("100000", 6));
    await usdcToken.transfer(user2.address, parseUnits("100000", 6));

    return {
      lendingProtocol,
      priceOracle,
      ethToken,
      usdcToken,
      owner,
      user1,
      user2,
      liquidator
    };
  }

  describe("Asset Management", function () {
    it("Should add supported assets", async function () {
      const { lendingProtocol, ethToken } = await loadFixture(deployLendingProtocolFixture);
      
      const assetConfig = await lendingProtocol.getAssetConfig(await ethToken.getAddress());
      expect(assetConfig.isSupported).to.be.true;
      expect(assetConfig.collateralFactor).to.equal(parseEther("0.8"));
    });

    it("Should prevent adding asset twice", async function () {
      const { lendingProtocol, ethToken } = await loadFixture(deployLendingProtocolFixture);
      
      await expect(
        lendingProtocol.addAsset(
          await ethToken.getAddress(),
          parseEther("0.8"),
          parseEther("0.85"),
          parseEther("0.05")
        )
      ).to.be.revertedWith("Asset already supported");
    });
  });

  describe("Supply", function () {
    it("Should allow users to supply collateral", async function () {
      const { lendingProtocol, ethToken, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      const supplyAmount = parseEther("10");
      
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await expect(
        lendingProtocol.connect(user1).supply(
          await ethToken.getAddress(),
          supplyAmount,
          user1.address
        )
      ).to.emit(lendingProtocol, "Supply")
        .withArgs(user1.address, await ethToken.getAddress(), supplyAmount);

      const supplyBalance = await lendingProtocol.getSupplyBalance(user1.address, await ethToken.getAddress());
      expect(supplyBalance).to.equal(supplyAmount);
    });

    it("Should reject supply of unsupported asset", async function () {
      const { lendingProtocol, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      const MockZRC20 = await ethers.getContractFactory("MockZRC20");
      const unsupportedToken = await MockZRC20.deploy("Unsupported", "UNSUP", 18, parseEther("1000"));
      
      await expect(
        lendingProtocol.connect(user1).supply(
          await unsupportedToken.getAddress(),
          parseEther("10"),
          user1.address
        )
      ).to.be.revertedWith("Asset not supported");
    });
  });

  describe("Borrow", function () {
    it("Should allow borrowing with sufficient collateral", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      // Supply 10 ETH as collateral (worth $20,000)
      const supplyAmount = parseEther("10");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      // Try to borrow $8,000 USDC (should be allowed with 80% collateral factor and 150% health factor)
      const borrowAmount = parseUnits("8000", 6);
      
      await expect(
        lendingProtocol.connect(user1).borrow(
          await usdcToken.getAddress(),
          borrowAmount,
          user1.address
        )
      ).to.emit(lendingProtocol, "Borrow")
        .withArgs(user1.address, await usdcToken.getAddress(), borrowAmount);

      const borrowBalance = await lendingProtocol.getBorrowBalance(user1.address, await usdcToken.getAddress());
      expect(borrowBalance).to.equal(borrowAmount);
    });

    it("Should prevent borrowing with insufficient collateral", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      // Supply 1 ETH as collateral (worth $2,000)
      const supplyAmount = parseEther("1");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      // Try to borrow $2,000 USDC (should fail due to insufficient collateral)
      const borrowAmount = parseUnits("2000", 6);
      
      await expect(
        lendingProtocol.connect(user1).borrow(
          await usdcToken.getAddress(),
          borrowAmount,
          user1.address
        )
      ).to.be.revertedWith("Insufficient collateral");
    });
  });

  describe("Repay", function () {
    it("Should allow repaying borrowed assets", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      // Supply collateral and borrow
      const supplyAmount = parseEther("10");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      const borrowAmount = parseUnits("5000", 6);
      await lendingProtocol.connect(user1).borrow(
        await usdcToken.getAddress(),
        borrowAmount,
        user1.address
      );

      // Repay half the debt
      const repayAmount = parseUnits("2500", 6);
      await usdcToken.connect(user1).approve(await lendingProtocol.getAddress(), repayAmount);
      
      await expect(
        lendingProtocol.connect(user1).repay(
          await usdcToken.getAddress(),
          repayAmount,
          user1.address
        )
      ).to.emit(lendingProtocol, "Repay")
        .withArgs(user1.address, await usdcToken.getAddress(), repayAmount);

      const remainingDebt = await lendingProtocol.getBorrowBalance(user1.address, await usdcToken.getAddress());
      expect(remainingDebt).to.equal(borrowAmount - repayAmount);
    });
  });

  describe("Withdraw", function () {
    it("Should allow withdrawing supplied assets", async function () {
      const { lendingProtocol, ethToken, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      // Supply collateral
      const supplyAmount = parseEther("10");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      // Withdraw half
      const withdrawAmount = parseEther("5");
      
      await expect(
        lendingProtocol.connect(user1).withdraw(
          await ethToken.getAddress(),
          withdrawAmount,
          user1.address
        )
      ).to.emit(lendingProtocol, "Withdraw")
        .withArgs(user1.address, await ethToken.getAddress(), withdrawAmount);

      const remainingSupply = await lendingProtocol.getSupplyBalance(user1.address, await ethToken.getAddress());
      expect(remainingSupply).to.equal(supplyAmount - withdrawAmount);
    });

    it("Should prevent withdrawal that would break health factor", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      // Supply collateral and borrow close to limit
      const supplyAmount = parseEther("10");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      const borrowAmount = parseUnits("8000", 6);
      await lendingProtocol.connect(user1).borrow(
        await usdcToken.getAddress(),
        borrowAmount,
        user1.address
      );

      // Try to withdraw too much collateral
      const withdrawAmount = parseEther("8");
      
      await expect(
        lendingProtocol.connect(user1).withdraw(
          await ethToken.getAddress(),
          withdrawAmount,
          user1.address
        )
      ).to.be.revertedWith("Insufficient collateral");
    });
  });

  describe("Liquidation", function () {
    it("Should allow liquidation of undercollateralized position", async function () {
      const { lendingProtocol, priceOracle, ethToken, usdcToken, user1, liquidator } = 
        await loadFixture(deployLendingProtocolFixture);
      
      // User supplies 10 ETH and borrows $8000 USDC
      const supplyAmount = parseEther("10");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      const borrowAmount = parseUnits("8000", 6);
      await lendingProtocol.connect(user1).borrow(
        await usdcToken.getAddress(),
        borrowAmount,
        user1.address
      );

      // Price of ETH drops to $1000 (making position undercollateralized)
      await priceOracle.setPriceInUSD(await ethToken.getAddress(), 1000);

      // Liquidator repays debt to seize collateral
      const liquidationAmount = parseUnits("4000", 6);
      await usdcToken.connect(liquidator).approve(await lendingProtocol.getAddress(), liquidationAmount);
      
      await expect(
        lendingProtocol.connect(liquidator).liquidate(
          await ethToken.getAddress(),
          await usdcToken.getAddress(),
          user1.address,
          liquidationAmount
        )
      ).to.emit(lendingProtocol, "Liquidate");

      // Check that debt was reduced
      const remainingDebt = await lendingProtocol.getBorrowBalance(user1.address, await usdcToken.getAddress());
      expect(remainingDebt).to.be.lessThan(borrowAmount);
    });

    it("Should prevent liquidation of healthy position", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1, liquidator } = 
        await loadFixture(deployLendingProtocolFixture);
      
      // User supplies 10 ETH and borrows $5000 USDC (healthy position)
      const supplyAmount = parseEther("10");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      const borrowAmount = parseUnits("5000", 6);
      await lendingProtocol.connect(user1).borrow(
        await usdcToken.getAddress(),
        borrowAmount,
        user1.address
      );

      // Try to liquidate healthy position
      const liquidationAmount = parseUnits("1000", 6);
      await usdcToken.connect(liquidator).approve(await lendingProtocol.getAddress(), liquidationAmount);
      
      await expect(
        lendingProtocol.connect(liquidator).liquidate(
          await ethToken.getAddress(),
          await usdcToken.getAddress(),
          user1.address,
          liquidationAmount
        )
      ).to.be.revertedWith("Health factor above liquidation threshold");
    });
  });

  describe("Health Factor", function () {
    it("Should calculate health factor correctly", async function () {
      const { lendingProtocol, ethToken, usdcToken, user1 } = await loadFixture(deployLendingProtocolFixture);
      
      // Supply 10 ETH ($20,000) with 80% collateral factor = $16,000 collateral value
      const supplyAmount = parseEther("10");
      await ethToken.connect(user1).approve(await lendingProtocol.getAddress(), supplyAmount);
      await lendingProtocol.connect(user1).supply(
        await ethToken.getAddress(),
        supplyAmount,
        user1.address
      );

      // Borrow $8,000 USDC
      const borrowAmount = parseUnits("8000", 6);
      await lendingProtocol.connect(user1).borrow(
        await usdcToken.getAddress(),
        borrowAmount,
        user1.address
      );

      const healthFactor = await lendingProtocol.getHealthFactor(user1.address);
      
      // Health factor should be around 1.7 (16000 * 0.85 / 8000)
      expect(healthFactor).to.be.greaterThan(parseEther("1.5"));
      expect(healthFactor).to.be.lessThan(parseEther("2.0"));
    });
  });
});