const Web3 = require('web3');
const web3 = new Web3();

// Error selectors from the contract
const errors = [
  'Unauthorized()',
  'AssetNotSupported(address)',
  'InvalidAmount()',
  'InsufficientCollateral()',
  'InsufficientLiquidity()',
  'InsufficientBalance()',
  'InsufficientGasFee(address,uint256,uint256)',
  'HealthFactorTooLow()'
];

console.log('Error selectors:');
errors.forEach(error => {
  const signature = web3.utils.sha3(error);
  const selector = signature.slice(0, 10);
  console.log(`${error}: ${selector}`);
});

// Check if 0x3a23d825 matches any of these
const targetSelector = '0x3a23d825';
console.log(`\nTarget selector: ${targetSelector}`);
const match = errors.find(error => {
  const signature = web3.utils.sha3(error);
  const selector = signature.slice(0, 10);
  return selector === targetSelector;
});
console.log(`Match: ${match || 'No match found'}`);