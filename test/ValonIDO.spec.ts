import chai, { expect } from 'chai';
import { ethers, Contract } from 'ethers';
import { solidity, MockProvider, deployContract } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest, _to18Digits } from './shared/utilities';
import ValonToken from '../build/ValonToken.json';
import ValonIDO from '../build/ValonIDO.json';

chai.use(solidity)

const TOTAL_SUPPLY = expandTo18Decimals(10000000);
const bnbAmount = ethers.BigNumber.from('1000000000000000000');

describe('ValonIDO', () => {
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
        },
        {
          balance: '10000000000000000000000',
          secretKey: Buffer.from('7af6d902274fb54ea69a3f43cc5388aa5c3adf346f0e1d48bf698f16d2e3962c', 'hex')
        },
        {
          balance: '10000000000000000000000',
          secretKey: Buffer.from('7af6d902274fb54ea69a3f43cc5388aa5c3adf346f0e1d48bf698f16d2e3962d', 'hex')
        }
      ],
      gasLimit: 9999999
    }
  });

  const [wallet, other, other2, other3] = provider.getWallets();
  let token: Contract;
  let tokenOld: Contract;
  let IDO: Contract;

  beforeEach(async () => {
    token = await deployContract(wallet, ValonToken, [ethers.BigNumber.from('250000000000000000000000000')]);
    tokenOld = await deployContract(wallet, ValonToken, [ethers.BigNumber.from('250000000000000000000000000')]);
    IDO = await deployContract(
      wallet,
      ValonIDO,
      [tokenOld.address, token.address, TOTAL_SUPPLY, 0, 9999999, 30000, '100000000000000000', '10000000000000000000']
    );
    const walletUser = token.connect(provider.getSigner(wallet.address));
    walletUser.approve(IDO.address, TOTAL_SUPPLY);
  });

  it('receive bnb', async () => {
    const otherUserIDO = IDO.connect(provider.getSigner(other.address));
    const ownerAddress = await otherUserIDO.owner();
    const allowance = await token.allowance(wallet.address, IDO.address);
    expect(allowance).to.eq(TOTAL_SUPPLY);
    expect(ownerAddress).to.eq(wallet.address);

    // #1
    await other.sendTransaction({
      to: IDO.address,
      value: bnbAmount.mul(1)
    });

    let IDOBalance = await provider.getBalance(IDO.address);
    expect(IDOBalance).to.eq(bnbAmount.mul(1));

    let reservedVLON = await IDO.getReservedVLON(other.address);
    expect(reservedVLON).to.eq('30000000000000000000000');

    let reservedBNB = await IDO.getReservedBNB(other.address);
    expect(reservedBNB).to.eq('1000000000000000000');

    // #2
    await other.sendTransaction({
      to: IDO.address,
      value: bnbAmount.mul(9)
    });

    IDOBalance = await provider.getBalance(IDO.address);
    expect(IDOBalance).to.eq(bnbAmount.mul(10));

    reservedVLON = await IDO.getReservedVLON(other.address);
    expect(reservedVLON).to.eq('300000000000000000000000');

    reservedBNB = await IDO.getReservedBNB(other.address);
    expect(reservedBNB).to.eq('10000000000000000000');

    // #3 - OVER MAX
    expect(other.sendTransaction({
      to: IDO.address,
      value: bnbAmount.mul(1)
    })).to.reverted;
  });

  it('claim vlon', async () => {
    const walletUserIDO = IDO.connect(provider.getSigner(wallet.address));
    const otherUserIDO = IDO.connect(provider.getSigner(other.address));

    // #1
    await other.sendTransaction({
      to: IDO.address,
      value: bnbAmount.mul(1)
    });

    let IDOBalance = await provider.getBalance(IDO.address);
    expect(IDOBalance).to.eq(bnbAmount.mul(1));

    let reservedVLON = await IDO.getReservedVLON(other.address);
    expect(reservedVLON).to.eq('30000000000000000000000');

    let reservedBNB = await IDO.getReservedBNB(other.address);
    expect(reservedBNB).to.eq('1000000000000000000');

    // claim
    await walletUserIDO.setActive(false);
    await walletUserIDO.setClaimable(true);
    await otherUserIDO.claimVLON();

    reservedVLON = await IDO.getReservedVLON(other.address);
    expect(reservedVLON).to.eq('0');
    expect(await token.balanceOf(other.address)).to.eq('30000000000000000000000');
    expect(otherUserIDO.claimVLON()).to.reverted;
  });

  it('multi user', async () => {
    const walletUserIDO = IDO.connect(provider.getSigner(wallet.address));
    const otherUserIDO = IDO.connect(provider.getSigner(other.address));
    const otherUser2IDO = IDO.connect(provider.getSigner(other2.address));
    const otherUser3IDO = IDO.connect(provider.getSigner(other3.address));

    // #1
    await other.sendTransaction({
      to: IDO.address,
      value: bnbAmount.mul(1)
    });

    await other2.sendTransaction({
      to: IDO.address,
      value: bnbAmount.mul(2)
    });

    await other3.sendTransaction({
      to: IDO.address,
      value: bnbAmount.mul(5)
    });

    let IDOBalance = await provider.getBalance(IDO.address);
    expect(IDOBalance).to.eq(bnbAmount.mul(8));

    expect(await IDO.getReservedVLON(other.address)).to.eq('30000000000000000000000');
    expect(await IDO.getReservedVLON(other2.address)).to.eq('60000000000000000000000');
    expect(await IDO.getReservedVLON(other3.address)).to.eq('150000000000000000000000');

    expect(await IDO.getReservedBNB(other.address)).to.eq('1000000000000000000');
    expect(await IDO.getReservedBNB(other2.address)).to.eq('2000000000000000000');
    expect(await IDO.getReservedBNB(other3.address)).to.eq('5000000000000000000');

    expect(await IDO.getTotalSold()).to.eq('240000000000000000000000');

    // claim
    await walletUserIDO.setActive(false);
    await walletUserIDO.setClaimable(true);

    await otherUserIDO.claimVLON();
    expect(await token.balanceOf(other.address)).to.eq('30000000000000000000000');
    expect(otherUserIDO.claimVLON()).to.reverted;
    expect(await IDO.getTotalClaimed()).to.eq('30000000000000000000000');

    await otherUser2IDO.claimVLON();
    expect(await token.balanceOf(other2.address)).to.eq('60000000000000000000000');
    expect(otherUser2IDO.claimVLON()).to.reverted;
    expect(await IDO.getTotalClaimed()).to.eq('90000000000000000000000');

    await otherUser3IDO.claimVLON();
    expect(await token.balanceOf(other3.address)).to.eq('150000000000000000000000');
    expect(otherUser3IDO.claimVLON()).to.reverted;
    expect(await IDO.getTotalClaimed()).to.eq('240000000000000000000000');
  });

  it('migrate', async () => {
    const walletUserTokenOld = tokenOld.connect(provider.getSigner(wallet.address));
    const walletUserIDO = IDO.connect(provider.getSigner(wallet.address));
    const otherUserIDO = IDO.connect(provider.getSigner(other.address));
    const otherUserTokenOld = tokenOld.connect(provider.getSigner(other.address));
    const otherUser2IDO = IDO.connect(provider.getSigner(other2.address));
    const otherUser2TokenOld = tokenOld.connect(provider.getSigner(other2.address));

    otherUserTokenOld.approve(IDO.address, '10000000000000000000000');
    await walletUserTokenOld.transfer(other.address, '10000000000000000000000');
    otherUser2TokenOld.approve(IDO.address, '30000000000000000000000');
    await walletUserTokenOld.transfer(other2.address, '30000000000000000000000');

    expect(otherUserIDO.migrate({
      value: '0'
    })).to.reverted;

    expect(otherUserIDO.migrate({
      value: '40000000000000000'
    })).to.reverted;

    await otherUserIDO.migrate({
      value: '50000000000000000'
    });

    expect(otherUserIDO.migrate({
      value: '50000000000000000'
    })).to.reverted;

    expect(await otherUserIDO.getMigratedVLON(other.address)).to.eq('10000000000000000000000');
    expect(await otherUserIDO.getTotalMigratedVLON()).to.eq('10000000000000000000000');

    // user #2
    await otherUser2IDO.migrate({
      value: '50000000000000000'
    });

    expect(await otherUserIDO.getMigratedVLON(other.address)).to.eq('10000000000000000000000');
    expect(await otherUserIDO.getMigratedVLON(other2.address)).to.eq('30000000000000000000000');
    expect(await otherUserIDO.getTotalMigratedVLON()).to.eq('40000000000000000000000');
    expect(await tokenOld.balanceOf(wallet.address)).to.eq('250000000000000000000000000');

    // claim 20%
    await walletUserIDO.setMigrateVestingPercentage(20);
    expect(await token.balanceOf(other.address)).to.eq('0');
    await otherUserIDO.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('2000000000000000000000');
    expect(await otherUserIDO.getMigrateClaimedVLON(other.address)).to.eq('2000000000000000000000');
    expect(otherUserIDO.claimMigratedVLON()).to.reverted;

    expect(await token.balanceOf(other2.address)).to.eq('0');
    await otherUser2IDO.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('6000000000000000000000');
    expect(await otherUser2IDO.getMigrateClaimedVLON(other2.address)).to.eq('6000000000000000000000');
    expect(otherUser2IDO.claimMigratedVLON()).to.reverted;

    // claim 40%
    await walletUserIDO.setMigrateVestingPercentage(40);
    expect(await token.balanceOf(other.address)).to.eq('2000000000000000000000');
    await otherUserIDO.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('4000000000000000000000');
    expect(await otherUserIDO.getMigrateClaimedVLON(other.address)).to.eq('4000000000000000000000');
    expect(otherUserIDO.claimMigratedVLON()).to.reverted;

    await walletUserIDO.setMigrateVestingPercentage(40);
    expect(await token.balanceOf(other2.address)).to.eq('6000000000000000000000');
    await otherUser2IDO.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('12000000000000000000000');
    expect(await otherUser2IDO.getMigrateClaimedVLON(other2.address)).to.eq('12000000000000000000000');
    expect(otherUser2IDO.claimMigratedVLON()).to.reverted;

    // claim 60%
    await walletUserIDO.setMigrateVestingPercentage(60);
    expect(await token.balanceOf(other.address)).to.eq('4000000000000000000000');
    await otherUserIDO.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('6000000000000000000000');
    expect(await otherUserIDO.getMigrateClaimedVLON(other.address)).to.eq('6000000000000000000000');
    expect(otherUserIDO.claimMigratedVLON()).to.reverted;

    await walletUserIDO.setMigrateVestingPercentage(60);
    expect(await token.balanceOf(other2.address)).to.eq('12000000000000000000000');
    await otherUser2IDO.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('18000000000000000000000');
    expect(await otherUser2IDO.getMigrateClaimedVLON(other2.address)).to.eq('18000000000000000000000');
    expect(otherUser2IDO.claimMigratedVLON()).to.reverted;

    // claim 80%
    await walletUserIDO.setMigrateVestingPercentage(80);
    expect(await token.balanceOf(other.address)).to.eq('6000000000000000000000');
    await otherUserIDO.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('8000000000000000000000');
    expect(await otherUserIDO.getMigrateClaimedVLON(other.address)).to.eq('8000000000000000000000');
    expect(otherUserIDO.claimMigratedVLON()).to.reverted;

    await walletUserIDO.setMigrateVestingPercentage(80);
    expect(await token.balanceOf(other2.address)).to.eq('18000000000000000000000');
    await otherUser2IDO.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('24000000000000000000000');
    expect(await otherUser2IDO.getMigrateClaimedVLON(other2.address)).to.eq('24000000000000000000000');
    expect(otherUser2IDO.claimMigratedVLON()).to.reverted;

    // claim 100%
    await walletUserIDO.setMigrateVestingPercentage(100);
    expect(await token.balanceOf(other.address)).to.eq('8000000000000000000000');
    await otherUserIDO.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('10000000000000000000000');
    expect(await otherUserIDO.getMigrateClaimedVLON(other.address)).to.eq('10000000000000000000000');
    expect(otherUserIDO.claimMigratedVLON()).to.reverted;

    await walletUserIDO.setMigrateVestingPercentage(100);
    expect(await token.balanceOf(other2.address)).to.eq('24000000000000000000000');
    await otherUser2IDO.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('30000000000000000000000');
    expect(await otherUser2IDO.getMigrateClaimedVLON(other2.address)).to.eq('30000000000000000000000');
    expect(otherUser2IDO.claimMigratedVLON()).to.reverted;
  });

  /*it('lock', async () => {
    const walletUserIDO = IDO.connect(provider.getSigner(wallet.address));
    await walletUserIDO.lockVLON('25000000000000000000000000'); // 25mil
  });*/

});
