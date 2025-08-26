// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title ProtocolConstants
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Centralized constants for the entire lending protocol
 * @dev Contains all shared constants to avoid duplication across contracts and libraries
 *      Single source of truth for protocol parameters
 */
library ProtocolConstants {
    
    // ============ PRECISION CONSTANTS ============
    
    /// @dev Base precision constant for percentage and value calculations (1e18 = 100%)
    /// Used across all libraries for consistent decimal handling
    uint256 internal constant PRECISION = 1e18;
    
    /// @dev High precision constant for interest rate calculations (1e27)
    /// Used by InterestRateModel for more precise rate calculations
    uint256 internal constant RAY = 1e27;
    
    /// @dev Half of RAY precision for rounding calculations
    uint256 internal constant HALF_RAY = RAY / 2;
    
    // ============ HEALTH FACTOR CONSTANTS ============
    
    /// @dev Minimum health factor required for borrowing (150%)
    /// Users must maintain at least 1.5x collateralization ratio
    uint256 internal constant MINIMUM_HEALTH_FACTOR = 1.5e18;
    
    /// @dev Liquidation threshold - health factor below which liquidation is allowed (120%)
    /// Users can be liquidated when health factor falls below 1.2x
    uint256 internal constant LIQUIDATION_THRESHOLD = 1.2e18;
    
    /// @dev Alternative name for liquidation threshold used in position management
    uint256 internal constant LIQUIDATION_HEALTH_FACTOR = LIQUIDATION_THRESHOLD;
    
    /// @dev Maximum possible health factor value (when no debt exists)
    uint256 internal constant MAX_HEALTH_FACTOR = type(uint256).max;
    
    // ============ PRICE ORACLE CONSTANTS ============
    
    /// @dev Minimum valid price from oracle (prevents flash loan attacks)
    /// Equivalent to $0.000001 USD minimum asset price
    uint256 internal constant MIN_VALID_PRICE = 1e6;
    
    /// @dev Maximum valid price from oracle (prevents overflow attacks)  
    /// Equivalent to $1 trillion USD maximum asset price
    uint256 internal constant MAX_VALID_PRICE = 1e30;
    
    /// @dev Price precision for oracle values
    uint256 internal constant PRICE_PRECISION = PRECISION;
    
    // ============ TIME CONSTANTS ============
    
    /// @dev Seconds in one year for interest calculations
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    
    /// @dev Maximum time delta allowed for interest calculations (100 years)
    /// Prevents overflow in time-based calculations
    uint256 internal constant MAX_TIME_DELTA = 100 * 365 days;
    
    // ============ CROSS-CHAIN CONSTANTS ============
    
    /// @dev Default gas limit for revert operations in cross-chain transactions
    uint256 internal constant DEFAULT_REVERT_GAS_LIMIT = 300000;
    
    /// @dev Minimum amount for cross-chain operations to ensure cost effectiveness
    /// Equivalent to $0.001 USD minimum transfer amount
    uint256 internal constant MIN_CROSS_CHAIN_AMOUNT = 1e6;
    
    // ============ PROTOCOL PARAMETERS ============
    
    /// @dev Reserve factor - percentage of interest that goes to reserves (10%)
    uint256 internal constant RESERVE_FACTOR = 0.1e18;
    
    /// @dev Maximum price age allowed from oracle (1 hour)
    /// Prevents using stale price data
    uint256 internal constant MAX_PRICE_AGE = 1 hours;
    
    // ============ DEFAULT ASSET CONFIGURATION ============
    
    /// @dev Default collateral factor for new assets (80%)
    /// Percentage of asset value that can be used as collateral
    uint256 internal constant DEFAULT_COLLATERAL_FACTOR = 0.8e18;
    
    /// @dev Default liquidation threshold for new assets (85%)
    /// Health factor threshold for liquidation eligibility
    uint256 internal constant DEFAULT_LIQUIDATION_THRESHOLD_RATIO = 0.85e18;
    
    /// @dev Default liquidation bonus for liquidators (5%)
    /// Incentive percentage for performing liquidations
    uint256 internal constant DEFAULT_LIQUIDATION_BONUS = 0.05e18;
    
    // ============ INTEREST RATE MODEL PARAMETERS ============
    
    /// @dev Base interest rate (2% annually)
    /// Minimum interest rate when utilization is 0
    uint256 internal constant BASE_RATE = 0.02e18;
    
    /// @dev First slope of interest rate curve (4% annually)
    /// Rate increase per utilization percentage up to optimal utilization
    uint256 internal constant RATE_SLOPE_1 = 0.04e18;
    
    /// @dev Second slope of interest rate curve (75% annually) 
    /// Steep rate increase above optimal utilization to discourage over-borrowing
    uint256 internal constant RATE_SLOPE_2 = 0.75e18;
    
    /// @dev Optimal utilization ratio (80%)
    /// Target utilization where rate curve changes slope
    uint256 internal constant OPTIMAL_UTILIZATION = 0.8e18;
    
    // ============ VALIDATION CONSTANTS ============
    
    /// @dev Minimum amount for lending operations (prevents dust attacks)
    uint256 internal constant MIN_OPERATION_AMOUNT = 1;
    
    /// @dev Maximum number of assets a user can interact with
    /// Prevents gas limit issues in user data aggregation
    uint256 internal constant MAX_USER_ASSETS = 50;
    
    // ============ GAS OPTIMIZATION CONSTANTS ============
    
    /// @dev Standard gas limit for cross-chain calls
    uint256 internal constant STANDARD_GAS_LIMIT = 500000;
    
    /// @dev Emergency gas limit for failed transaction recovery
    uint256 internal constant EMERGENCY_GAS_LIMIT = 100000;
}