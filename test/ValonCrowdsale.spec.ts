import chai, { expect } from 'chai';
import { ethers, Contract } from 'ethers';
import { solidity, MockProvider, deployContract } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest, _to18Digits } from './shared/utilities';
import ValonToken from '../build/ValonToken.json';
import ValonCrowdsale from '../build/ValonCrowdsale.json';
import { resolveProperties } from '@ethersproject/contracts/node_modules/@ethersproject/properties';

chai.use(solidity)

const TOTAL_SUPPLY = expandTo18Decimals(10000000);
const bnbAmount = ethers.BigNumber.from('1000000000000000000');

describe('ValonCrowdsale', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      accounts: [
        {
          balance: '10000000000000000000000',
          secretKey: Buffer.from('7af6d902274fb54ea69a3f43cc5388aa5c3adf346f0e1d48bf698f16d2e3962a', 'hex')
        },
        {
          balance: '10000000000000000000000',
          secretKey: Buffer.from('7af6d902274fb54ea69a3f43cc5388aa5c3adf346f0e1d48bf698f16d2e3962b', 'hex')
        }
      ],
      gasLimit: 9999999
    }
  });

  const [wallet, other, other2, other3] = provider.getWallets();
  let token: Contract;
  let crowdsale: Contract;

  beforeEach(async () => {
    token = await deployContract(wallet, ValonToken, [ethers.BigNumber.from('250000000000000000000000000')]);
    crowdsale = await deployContract(wallet, ValonCrowdsale, [token.address, TOTAL_SUPPLY, 0, 9999999, 30000]);
    const walletUser = token.connect(provider.getSigner(wallet.address));
    walletUser.approve(crowdsale.address, TOTAL_SUPPLY);
  });

  it('receive bnb', async () => {
    const otherUserCrowdsale = crowdsale.connect(provider.getSigner(other.address));
    const ownerAddress = await otherUserCrowdsale.owner();
    const allowance = await token.allowance(wallet.address, crowdsale.address);
    expect(allowance).to.eq(TOTAL_SUPPLY);
    expect(ownerAddress).to.eq(wallet.address);

    // #1
    await other.sendTransaction({
      to: crowdsale.address,
      value: bnbAmount.mul(1)
    });

    let crowdsaleBalance = await provider.getBalance(crowdsale.address);
    expect(crowdsaleBalance).to.eq(bnbAmount.mul(1));

    let tokenBalance = await token.balanceOf(other.address);
    expect(tokenBalance).to.eq('30000000000000000000000');

    let phase = await crowdsale.getPhase();
    expect(phase).to.eq('1');

    // #2
    await other.sendTransaction({
      to: crowdsale.address,
      value: bnbAmount.mul(50)
    });

    crowdsaleBalance = await provider.getBalance(crowdsale.address);
    expect(crowdsaleBalance).to.eq(bnbAmount.mul(51));

    tokenBalance = await token.balanceOf(other.address);
    expect(tokenBalance).to.eq('1530000000000000000000000');

    phase = await crowdsale.getPhase();
    expect(phase).to.eq('2');

    // #3
    await other.sendTransaction({
      to: crowdsale.address,
      value: bnbAmount.mul(100)
    });

    crowdsaleBalance = await provider.getBalance(crowdsale.address);
    expect(crowdsaleBalance).to.eq(bnbAmount.mul(151));

    tokenBalance = await token.balanceOf(other.address);
    expect(tokenBalance).to.eq('4257272727272727272727272');

    phase = await crowdsale.getPhase();
    expect(phase).to.eq('5');

    // #4
    await other.sendTransaction({
      to: crowdsale.address,
      value: bnbAmount.mul(100)
    });

    crowdsaleBalance = await provider.getBalance(crowdsale.address);
    expect(crowdsaleBalance).to.eq(bnbAmount.mul(251));

    tokenBalance = await token.balanceOf(other.address);
    expect(tokenBalance).to.eq('6400129870129870129870129');

    phase = await crowdsale.getPhase();
    expect(phase).to.eq('7');

    // #5
    await other.sendTransaction({
      to: crowdsale.address,
      value: bnbAmount.mul(100)
    });

    crowdsaleBalance = await provider.getBalance(crowdsale.address);
    expect(crowdsaleBalance).to.eq(bnbAmount.mul(351));

    tokenBalance = await token.balanceOf(other.address);
    expect(tokenBalance).to.eq('8275129870129870129870129');

    phase = await crowdsale.getPhase();
    expect(phase).to.eq('9');

    // #6
    expect(other.sendTransaction({
      to: crowdsale.address,
      value: bnbAmount.mul(200)
    })).to.reverted;

    crowdsaleBalance = await provider.getBalance(crowdsale.address);
    expect(crowdsaleBalance).to.eq(bnbAmount.mul(351));

    tokenBalance = await token.balanceOf(other.address);
    expect(tokenBalance).to.eq('8275129870129870129870129');

    phase = await crowdsale.getPhase();
    expect(phase).to.eq('9');

    // withdraw bnb
    let walletBalance = await provider.getBalance(wallet.address);

    const walletCrowdsale = crowdsale.connect(provider.getSigner(wallet.address));
    await walletCrowdsale.withdrawBNB(bnbAmount.mul(100));

    crowdsaleBalance = await provider.getBalance(crowdsale.address);
    expect(crowdsaleBalance).to.eq(bnbAmount.mul(251));

    let walletBalance2 = await provider.getBalance(wallet.address);
    expect(walletBalance2.sub(walletBalance)).to.gt('99999900000000000000');
  });

});
