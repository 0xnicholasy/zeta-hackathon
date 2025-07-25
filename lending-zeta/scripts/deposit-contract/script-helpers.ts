import {
  getNetwork,
  getContractAddress,
  Address
} from "../../utils/contracts";
import { ethers, BigNumber } from "ethers";

export const ZETA_CHAIN_IDS = {
  testnet: 7001,
  mainnet: 7000,
} as const;

export interface ProtocolConfig {
  useUniversal: boolean;
  protocolType: 'simple' | 'universal';
  protocolContractName: 'SimpleLendingProtocol' | 'UniversalLendingProtocol';
}

/**
 * Parse command line arguments to determine protocol type
 * @returns ProtocolConfig object with protocol type information
 */
export function parseProtocolArgs(): ProtocolConfig {
  const args = process.argv.slice(2);
  const useUniversal = args.includes('universal');
  const protocolType = useUniversal ? 'universal' : 'simple';
  const protocolContractName = useUniversal ? "UniversalLendingProtocol" : "SimpleLendingProtocol";

  return {
    useUniversal,
    protocolType,
    protocolContractName
  };
}

/**
 * Display script header with protocol type information
 * @param scriptName Name of the script being executed
 * @param protocolConfig Protocol configuration
 */
export function displayScriptHeader(scriptName: string, protocolConfig: ProtocolConfig): void {
  console.log("=".repeat(60));
  console.log(`🚀 ${scriptName}`);
  console.log("=".repeat(60));
  console.log(`📋 Protocol Type: ${protocolConfig.protocolType}`);
  console.log(`📋 Contract Name: ${protocolConfig.protocolContractName}`);
  console.log("=".repeat(60));
}

/**
 * Display network and account information
 * @param chainId Current chain ID
 * @param deployerAddress Deployer address
 * @param balance Account balance
 */
export async function displayNetworkInfo(
  chainId: number,
  deployerAddress: string,
  balance: BigNumber
): Promise<void> {
  const networkConfig = getNetwork(chainId);

  console.log("\n📡 Network Information:");
  console.log("-".repeat(30));
  console.log(`Network: ${networkConfig.name}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Account: ${deployerAddress}`);
  console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
}

/**
 * Get lending protocol address from ZetaChain with error handling
 * @param protocolContractName Name of the protocol contract
 * @param zetaChainId ZetaChain network ID
 * @returns Protocol address
 */
export function getLendingProtocolAddress(
  protocolContractName: string,
  zetaChainId: number = ZETA_CHAIN_IDS.testnet
): string {
  try {
    return getContractAddress(zetaChainId, protocolContractName);
  } catch (error) {
    throw new Error(
      `${protocolContractName} address not found on ZetaChain (${zetaChainId}). ` +
      `Deploy to ZetaChain first and update contracts.json.`
    );
  }
}

/**
 * Get DepositContract address from current chain with error handling
 * @param chainId Current chain ID
 * @returns DepositContract address
 */
export function getDepositContractAddress(chainId: number): string {
  try {
    return getContractAddress(chainId, "DepositContract");
  } catch (error) {
    throw new Error(
      `DepositContract address not found on chain ${chainId}. ` +
      `Deploy DepositContract first and update contracts.json.`
    );
  }
}

/**
 * Display operation summary
 * @param title Summary title
 * @param details Key-value pairs to display
 */
export function displaySummary(title: string, details: Record<string, string | number>): void {
  console.log(`\n📊 ${title}:`);
  console.log("=".repeat(50));

  Object.entries(details).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
}

/**
 * Display success message with protocol type
 * @param operation Operation that was completed
 * @param protocolType Protocol type used
 */
export function displaySuccess(operation: string, protocolType: string): void {
  console.log(`\n✅ ${operation} completed successfully!`);
  console.log(`The operation was performed using the ${protocolType} protocol configuration.`);
}

/**
 * Handle common error scenarios
 * @param error Error object
 * @param context Additional context for the error
 */
export function handleCommonErrors(error: any, context: string = ""): void {
  const errorMessage = error.message || error.toString();

  if (errorMessage.includes("InvalidChainId")) {
    console.log("❌ Chain ID validation failed!");
    console.log("Make sure you're updating for the correct ZetaChain network.");
  } else if (errorMessage.includes("Ownable: caller is not the owner")) {
    console.log("❌ Access denied! Only the contract owner can perform this operation.");
  } else if (errorMessage.includes("insufficient funds")) {
    console.log("❌ Insufficient funds! Make sure your account has enough ETH for gas fees.");
  } else if (errorMessage.includes("nonce too low")) {
    console.log("❌ Nonce error! Try again or reset your transaction nonce.");
  } else {
    console.log(`❌ Operation failed${context ? ` (${context})` : ""}: ${errorMessage}`);
  }
}

/**
 * Validate protocol type argument
 * @param protocolType Protocol type to validate
 */
export function validateProtocolType(protocolType: string): void {
  if (!['simple', 'universal'].includes(protocolType)) {
    throw new Error(`Invalid protocol type: ${protocolType}. Must be 'simple' or 'universal'.`);
  }
}