import chai from 'chai'
import * as ethers from 'ethers'
import {createFixtureLoader, deployContract, solidity} from 'ethereum-waffle'
import {expandTo18Decimals, getApprovalDigest, getCreate2Address, MINIMUM_LIQUIDITY} from './shared/utilities'
import {MaxUint256} from 'ethers/constants'
import {BigNumber, bigNumberify, keccak256} from 'ethers/utils'
import {ecsign} from 'ethereumjs-util'
import { Contract } from 'ethers';
import IUniswapV2Pair from '../build/IUniswapV2Pair.json';
import IBEP20 from '../build/IBEP20.json';

chai.use(solidity)

/**
 * Rename Deploy.ts to Deploy.spec.ts
 * Add your private key
 * Update contract key after each deployment
 * Deploy token: yarn deployPlateToken
 * Deploy master: yarn deployPlateMaster
 * Deploy router: yarn deployPlateRouter
 * Transfer ownership: yarn deployTransferOwnership
 * Rename back to Deploy.ts
 */
describe('ValonDeploy', () => {
  const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
  //  const provider = ethers.getDefaultProvider('rinkeby');
  const privateKey = '';
  if (!privateKey) return;
  const wallet = new ethers.Wallet(privateKey, provider);

  let overrides = {
    //        3022211
    //gasLimit: 9999999
    gasLimit: 9999999,
    gasPrice: 39000000000
  };

  const factoryAddress = '0x40F8dE538828Ad7Ab24C7aF3f910b33E3F9e6f8f'

  beforeEach(async () => {
    let gasPrice = await provider.getGasPrice();
    console.log(`current gas Price ${gasPrice}`);
    gasPrice = gasPrice.mul(3);
    console.log(`new gas Price ${gasPrice}`);
    overrides = Object.assign(overrides, {gasPrice: gasPrice.toNumber()});
  });

});

describe('ValonSwapTokenDeploy', () => {
  const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
  const privateKey = '';
  if (!privateKey) return;
  const wallet = new ethers.Wallet(privateKey, provider);

  let overrides = {
    gasLimit: 9999999,
    gasPrice: 39000000000
  };

  const factoryAddress = '0x40F8dE538828Ad7Ab24C7aF3f910b33E3F9e6f8f';
  let token: Contract;

  beforeEach(async () => {
    let gasPrice = await provider.getGasPrice();
    console.log(`current gas Price ${gasPrice}`);
    gasPrice = gasPrice.mul(3);
    console.log(`new gas Price ${gasPrice}`);
    overrides = Object.assign(overrides, {gasPrice: gasPrice.toNumber()});
  });

  /*it('deploy', async () => {
    token = await deployContract(wallet, ValonToken, [TOTAL_SUPPLY], overrides);
    console.log('token', token.address)
    await token.deployed();
  });*/

});

describe('ValonStakingApproveLPT', () => {
  const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
  const privateKey = '';
  const wallet = new ethers.Wallet(privateKey, provider);
  const lpt1Address = '0x35109dc43ECD4B8980FC6cf150cF8E8882dE2569';
  const stakingAddress = '0x01DBcE88A1b04e4D96F3F12879cf9e1b6A882B76';

  const lpt1 = new ethers.Contract(lpt1Address, JSON.stringify(IBEP20.abi), provider).connect(wallet);

  const tx = lpt1.approve(stakingAddress, bigNumberify('418597127999999989748'));
  //console.log(tx)
});
