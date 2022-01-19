import chai, { expect } from 'chai';
import { ethers, Contract } from 'ethers';
import { solidity, MockProvider, deployContract } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest, _to18Digits } from './shared/utilities';
import ValonToken from '../build/ValonToken.json';
import ValonMigrator from '../build/ValonMigrator.json';

chai.use(solidity)

const TOTAL_SUPPLY = expandTo18Decimals(10000000);
const bnbAmount = ethers.BigNumber.from('1000000000000000000');

describe('ValonMigrator', () => {
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
  let MIGRATOR: Contract;

  beforeEach(async () => {
    token = await deployContract(wallet, ValonToken, [ethers.BigNumber.from('250000000000000000000000000')]);
    tokenOld = await deployContract(wallet, ValonToken, [ethers.BigNumber.from('250000000000000000000000000')]);
    MIGRATOR = await deployContract(
      wallet,
      ValonMigrator,
      [tokenOld.address, token.address]
    );
    const walletUser = token.connect(provider.getSigner(wallet.address));
    walletUser.approve(MIGRATOR.address, TOTAL_SUPPLY);
    expect(await token.balanceOf(wallet.address)).to.eq('250000000000000000000000000');
  });

  it('migrate', async () => {
    const walletUserTokenOld = tokenOld.connect(provider.getSigner(wallet.address));
    const walletUserMIGRATOR = MIGRATOR.connect(provider.getSigner(wallet.address));
    const otherUserMIGRATOR = MIGRATOR.connect(provider.getSigner(other.address));
    const otherUserTokenOld = tokenOld.connect(provider.getSigner(other.address));
    const otherUser2MIGRATOR = MIGRATOR.connect(provider.getSigner(other2.address));
    const otherUser2TokenOld = tokenOld.connect(provider.getSigner(other2.address));

    otherUserTokenOld.approve(MIGRATOR.address, '10000000000000000000000');
    await walletUserTokenOld.transfer(other.address, '10000000000000000000000');
    otherUser2TokenOld.approve(MIGRATOR.address, '30000000000000000000000');
    await walletUserTokenOld.transfer(other2.address, '30000000000000000000000');

    expect(otherUserMIGRATOR.migrate({
      value: '0'
    })).to.reverted;

    expect(otherUserMIGRATOR.migrate({
      value: '40000000000000000'
    })).to.reverted;

    await otherUserMIGRATOR.migrate({
      value: '50000000000000000'
    });

    expect(otherUserMIGRATOR.migrate({
      value: '50000000000000000'
    })).to.reverted;

    expect(await otherUserMIGRATOR.getMigratedVLON(other.address)).to.eq('10000000000000000000000');
    expect(await otherUserMIGRATOR.getTotalMigratedVLON()).to.eq('10000000000000000000000');

    // user #2
    await otherUser2MIGRATOR.migrate({
      value: '50000000000000000'
    });

    expect(await otherUserMIGRATOR.getMigratedVLON(other.address)).to.eq('10000000000000000000000');
    expect(await otherUserMIGRATOR.getMigratedVLON(other2.address)).to.eq('30000000000000000000000');
    expect(await otherUserMIGRATOR.getTotalMigratedVLON()).to.eq('40000000000000000000000');
    expect(await tokenOld.balanceOf(wallet.address)).to.eq('250000000000000000000000000');

    // claim 20%
    await walletUserMIGRATOR.setVestingPercentage(20);
    expect(await token.balanceOf(other.address)).to.eq('0');
    await otherUserMIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('2000000000000000000000');
    expect(await otherUserMIGRATOR.getClaimedVLON(other.address)).to.eq('2000000000000000000000');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;

    expect(await token.balanceOf(other2.address)).to.eq('0');
    await otherUser2MIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('6000000000000000000000');
    expect(await otherUser2MIGRATOR.getClaimedVLON(other2.address)).to.eq('6000000000000000000000');
    expect(otherUser2MIGRATOR.claimMigratedVLON()).to.reverted;

    // claim 40%
    await walletUserMIGRATOR.setVestingPercentage(40);
    expect(await token.balanceOf(other.address)).to.eq('2000000000000000000000');
    await otherUserMIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('4000000000000000000000');
    expect(await otherUserMIGRATOR.getClaimedVLON(other.address)).to.eq('4000000000000000000000');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;

    await walletUserMIGRATOR.setVestingPercentage(40);
    expect(await token.balanceOf(other2.address)).to.eq('6000000000000000000000');
    await otherUser2MIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('12000000000000000000000');
    expect(await otherUser2MIGRATOR.getClaimedVLON(other2.address)).to.eq('12000000000000000000000');
    expect(otherUser2MIGRATOR.claimMigratedVLON()).to.reverted;

    // claim 60%
    await walletUserMIGRATOR.setVestingPercentage(60);
    expect(await token.balanceOf(other.address)).to.eq('4000000000000000000000');
    await otherUserMIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('6000000000000000000000');
    expect(await otherUserMIGRATOR.getClaimedVLON(other.address)).to.eq('6000000000000000000000');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;

    await walletUserMIGRATOR.setVestingPercentage(60);
    expect(await token.balanceOf(other2.address)).to.eq('12000000000000000000000');
    await otherUser2MIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('18000000000000000000000');
    expect(await otherUser2MIGRATOR.getClaimedVLON(other2.address)).to.eq('18000000000000000000000');
    expect(otherUser2MIGRATOR.claimMigratedVLON()).to.reverted;

    // claim 80%
    await walletUserMIGRATOR.setVestingPercentage(80);
    expect(await token.balanceOf(other.address)).to.eq('6000000000000000000000');
    await otherUserMIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('8000000000000000000000');
    expect(await otherUserMIGRATOR.getClaimedVLON(other.address)).to.eq('8000000000000000000000');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;

    await walletUserMIGRATOR.setVestingPercentage(80);
    expect(await token.balanceOf(other2.address)).to.eq('18000000000000000000000');
    await otherUser2MIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('24000000000000000000000');
    expect(await otherUser2MIGRATOR.getClaimedVLON(other2.address)).to.eq('24000000000000000000000');
    expect(otherUser2MIGRATOR.claimMigratedVLON()).to.reverted;

    // claim 100%
    await walletUserMIGRATOR.setVestingPercentage(100);
    expect(await token.balanceOf(other.address)).to.eq('8000000000000000000000');
    await otherUserMIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('10000000000000000000000');
    expect(await otherUserMIGRATOR.getClaimedVLON(other.address)).to.eq('10000000000000000000000');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;

    await walletUserMIGRATOR.setVestingPercentage(100);
    expect(await token.balanceOf(other2.address)).to.eq('24000000000000000000000');
    await otherUser2MIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other2.address)).to.eq('30000000000000000000000');
    expect(await otherUser2MIGRATOR.getClaimedVLON(other2.address)).to.eq('30000000000000000000000');
    expect(otherUser2MIGRATOR.claimMigratedVLON()).to.reverted;
  });

  it('blacklist', async () => {
    const walletUserTokenOld = tokenOld.connect(provider.getSigner(wallet.address));
    const walletUserMIGRATOR = MIGRATOR.connect(provider.getSigner(wallet.address));
    const otherUserMIGRATOR = MIGRATOR.connect(provider.getSigner(other.address));
    const otherUserTokenOld = tokenOld.connect(provider.getSigner(other.address));
    const otherUser2MIGRATOR = MIGRATOR.connect(provider.getSigner(other2.address));
    const otherUser2TokenOld = tokenOld.connect(provider.getSigner(other2.address));

    otherUserTokenOld.approve(MIGRATOR.address, '10000000000000000000000');
    await walletUserTokenOld.transfer(other.address, '10000000000000000000000');
    otherUser2TokenOld.approve(MIGRATOR.address, '30000000000000000000000');
    await walletUserTokenOld.transfer(other2.address, '30000000000000000000000');

    await walletUserMIGRATOR.setBlacklisted(other.address, true);

    expect(otherUserMIGRATOR.migrate({
      value: '0'
    })).to.reverted;

    await otherUserMIGRATOR.migrate({
      value: '50000000000000000'
    });

    // claim 20%
    await walletUserMIGRATOR.setVestingPercentage(20);
    expect(await token.balanceOf(other.address)).to.eq('0');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;
    expect(await token.balanceOf(other.address)).to.eq('0');
    expect(otherUserMIGRATOR.getClaimedVLON(other.address)).to.empty;
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;
  });

  it('whitelist', async () => {
    const walletUserTokenOld = tokenOld.connect(provider.getSigner(wallet.address));
    const walletUserMIGRATOR = MIGRATOR.connect(provider.getSigner(wallet.address));
    const otherUserMIGRATOR = MIGRATOR.connect(provider.getSigner(other.address));
    const otherUserTokenOld = tokenOld.connect(provider.getSigner(other.address));
    const otherUser2MIGRATOR = MIGRATOR.connect(provider.getSigner(other2.address));
    const otherUser2TokenOld = tokenOld.connect(provider.getSigner(other2.address));

    otherUserTokenOld.approve(MIGRATOR.address, '10000000000000000000000');
    await walletUserTokenOld.transfer(other.address, '10000000000000000000000');
    otherUser2TokenOld.approve(MIGRATOR.address, '30000000000000000000000');
    await walletUserTokenOld.transfer(other2.address, '30000000000000000000000');

    await walletUserMIGRATOR.setWhitelisted(other.address, true);

    await otherUserMIGRATOR.migrate({
      value: '0'
    });

    // claim 20%
    await walletUserMIGRATOR.setVestingPercentage(20);
    expect(await token.balanceOf(other.address)).to.eq('0');
    await otherUserMIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('2000000000000000000000');
    expect(await otherUserMIGRATOR.getClaimedVLON(other.address)).to.eq('2000000000000000000000');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;
  });

  it('viplist', async () => {
    const walletUserTokenOld = tokenOld.connect(provider.getSigner(wallet.address));
    const walletUserMIGRATOR = MIGRATOR.connect(provider.getSigner(wallet.address));
    const otherUserMIGRATOR = MIGRATOR.connect(provider.getSigner(other.address));
    const otherUserTokenOld = tokenOld.connect(provider.getSigner(other.address));
    const otherUser2MIGRATOR = MIGRATOR.connect(provider.getSigner(other2.address));
    const otherUser2TokenOld = tokenOld.connect(provider.getSigner(other2.address));

    otherUserTokenOld.approve(MIGRATOR.address, '10000000000000000000000');
    await walletUserTokenOld.transfer(other.address, '10000000000000000000000');
    otherUser2TokenOld.approve(MIGRATOR.address, '30000000000000000000000');
    await walletUserTokenOld.transfer(other2.address, '30000000000000000000000');

    await walletUserMIGRATOR.setWhitelisted(other.address, true);
    await walletUserMIGRATOR.setViplisted(other.address, true);

    await otherUserMIGRATOR.migrate({
      value: '0'
    });

    // claim 20%
    await walletUserMIGRATOR.setVestingPercentage(20);
    expect(await token.balanceOf(other.address)).to.eq('0');
    await otherUserMIGRATOR.claimMigratedVLON();
    expect(await token.balanceOf(other.address)).to.eq('10000000000000000000000');
    expect(await otherUserMIGRATOR.getClaimedVLON(other.address)).to.eq('10000000000000000000000');
    expect(otherUserMIGRATOR.claimMigratedVLON()).to.reverted;
  });

});
