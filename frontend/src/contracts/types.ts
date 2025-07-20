// Test import of typechain types to verify path mapping works
export type { SimpleLendingProtocol } from '@contracts/contracts/SimpleLendingProtocol';
export type { UniversalLendingProtocol } from '@contracts/contracts/UniversalLendingProtocol';
export type { IZRC20 } from '@contracts/contracts/interfaces/IZRC20';
export type { DepositContract } from '@contracts/contracts/DepositContract';
export type { IPriceOracle } from '@contracts/contracts/interfaces/IPriceOracle';
export type { IERC20 } from '@contracts/@openzeppelin/contracts/token/ERC20/IERC20';

// Re-export commonly used contract factories
export { SimpleLendingProtocol__factory } from '@contracts/factories/contracts/SimpleLendingProtocol__factory';
export { UniversalLendingProtocol__factory } from '@contracts/factories/contracts/UniversalLendingProtocol__factory';
export { IZRC20__factory } from '@contracts/factories/contracts/interfaces/IZRC20__factory';
export { DepositContract__factory } from '@contracts/factories/contracts/DepositContract__factory';
export { IPriceOracle__factory } from '@contracts/factories/contracts/interfaces/IPriceOracle__factory';
export { IERC20__factory } from '@contracts/factories/@openzeppelin/contracts/token/ERC20/IERC20__factory';