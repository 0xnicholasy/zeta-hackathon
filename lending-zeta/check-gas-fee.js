const { ethers } = require("hardhat");

async function main() {
    console.log("Testing decimal normalization in new contract...");
    
    const oldProtocolAddr = "0x540E30c2866DE055758D424BFA65412E3B5D73Cd";
    const newProtocolAddr = "0xd6c837EF9d67945db51f98e3eDdD640cc8B4aa51";
    const usdcArbiAddr = "0x4bC32034caCcc9B7e02536945eDbC286bACbA073";
    const userAddr = "0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C";
    
    const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
    const oldProtocol = SimpleLendingProtocol.attach(oldProtocolAddr);
    const newProtocol = SimpleLendingProtocol.attach(newProtocolAddr);
    
    console.log("\n=== OLD Contract Status ===");
    try {
        const oldBalance = await oldProtocol.getSupplyBalance(userAddr, usdcArbiAddr);
        console.log("Old contract USDC supply balance:", ethers.utils.formatUnits(oldBalance, 6));
    } catch(e) {
        console.error("Old contract error:", e.message);
    }
    
    console.log("\n=== NEW Contract Status ===");
    try {
        const newBalance = await newProtocol.getSupplyBalance(userAddr, usdcArbiAddr);
        console.log("New contract USDC supply balance:", ethers.utils.formatUnits(newBalance, 6));
        
        // Test gas fee calculation with new contract
        const gasInfo = await newProtocol.getWithdrawGasFee(usdcArbiAddr);
        console.log("New contract gas fee calculation works:", true);
        console.log("Gas token:", gasInfo[0]);
        console.log("Gas fee amount:", ethers.utils.formatUnits(gasInfo[1], 18), "ETH");
        
    } catch(e) {
        console.error("New contract error:", e.message);
    }
}

main().catch(console.error);