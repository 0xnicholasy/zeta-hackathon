import { z } from 'zod';
import { isEVMAddress } from '@/types/address';

// DepositContract schemas
export const addSupportedAssetSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
  decimals: z.coerce.number().min(0).max(18, 'Decimals must be between 0 and 18'),
  isNative: z.boolean(),
});

export const removeSupportedAssetSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
});

// UniversalLendingProtocol schemas
export const addAssetSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
  priceInUSD: z.coerce.number().min(0, 'Price must be positive'),
});

export const updatePriceSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
  priceInUSD: z.coerce.number().min(0, 'Price must be positive'),
});

export const setAllowedChainSchema = z.object({
  chainId: z.coerce.number().min(1, 'Chain ID is required'),
  allowed: z.boolean(),
});

export const mapZRC20Schema = z.object({
  zrc20: z.string().min(1, 'ZRC20 address is required').refine(isEVMAddress, 'Invalid EVM address'),
  chainId: z.coerce.number().min(1, 'Chain ID is required'),
  symbol: z.string().min(1, 'Symbol is required'),
});

export const setPriceOracleSchema = z.object({
  priceOracle: z.string().min(1, 'Price oracle address is required').refine(isEVMAddress, 'Invalid EVM address'),
});

// Type exports
export type AddSupportedAssetForm = z.infer<typeof addSupportedAssetSchema>;
export type RemoveSupportedAssetForm = z.infer<typeof removeSupportedAssetSchema>;
export type AddAssetForm = z.infer<typeof addAssetSchema>;
export type UpdatePriceForm = z.infer<typeof updatePriceSchema>;
export type SetAllowedChainForm = z.infer<typeof setAllowedChainSchema>;
export type MapZRC20Form = z.infer<typeof mapZRC20Schema>;
export type SetPriceOracleForm = z.infer<typeof setPriceOracleSchema>;