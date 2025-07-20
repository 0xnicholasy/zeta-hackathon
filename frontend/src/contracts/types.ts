// Test import of typechain types to verify path mapping works
export type { SimpleLendingProtocol } from '@contracts/contracts/SimpleLendingProtocol';
export type { UniversalLendingProtocol } from '@contracts/contracts/UniversalLendingProtocol';
export type { IZRC20 } from '@contracts/contracts/interfaces/IZRC20';

// Re-export commonly used contract factories
export { SimpleLendingProtocol__factory } from '@contracts/factories/contracts/SimpleLendingProtocol__factory';
export { UniversalLendingProtocol__factory } from '@contracts/factories/contracts/UniversalLendingProtocol__factory';
export { IZRC20__factory } from '@contracts/factories/contracts/interfaces/IZRC20__factory';