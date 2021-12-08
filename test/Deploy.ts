import chai from 'chai'
import { ethers } from 'ethers'
import {createFixtureLoader, deployContract, solidity} from 'ethereum-waffle'
import {expandTo18Decimals, getApprovalDigest, getCreate2Address, MINIMUM_LIQUIDITY} from './shared/utilities'
import {ecsign} from 'ethereumjs-util'
import { Contract } from 'ethers';
import IUniswapV2Pair from '../build/IUniswapV2Pair.json';
import IBEP20 from '../build/IBEP20.json';
import ValonToken from '../build/ValonToken.json';

chai.use(solidity)

/**
 * Rename Deploy.ts to Deploy.spec.ts
 * Add your private key
 * Run yarn deployValonToken
 */

describe('ValonTokenDeploy', () => {
  const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
  const privateKey = '7af6d902274fb54ea69a3f43cc5388aa5c3adf346f0e1d48bf698f16d2e3962a';
  if (!privateKey) return;
  const wallet = new ethers.Wallet(privateKey, provider);
  const TOTAL_SUPPLY = expandTo18Decimals(1000000);

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

  it('deploy', async () => {
    token = await deployContract(wallet, ValonToken, [TOTAL_SUPPLY], overrides);
    console.log('token', token.address)
    await token.deployed();
  });

});

describe('ValonStakingApproveLPT', () => {
  const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
  const privateKey = '7af6d902274fb54ea69a3f43cc5388aa5c3adf346f0e1d48bf698f16d2e3962a';
  const wallet = new ethers.Wallet(privateKey, provider);
  const lpt1Address = '0x35109dc43ECD4B8980FC6cf150cF8E8882dE2569';
  const stakingAddress = '0x01DBcE88A1b04e4D96F3F12879cf9e1b6A882B76';

  const lpt1 = new ethers.Contract(lpt1Address, JSON.stringify(IBEP20.abi), provider).connect(wallet);

  const tx = lpt1.approve(stakingAddress, ethers.BigNumber.from('418597127999999989748'));
  //console.log(tx)
});
