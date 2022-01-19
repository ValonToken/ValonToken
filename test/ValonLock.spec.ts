import chai, { expect } from 'chai';
import { ethers, Contract } from 'ethers';
import { solidity, MockProvider, deployContract } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest, _to18Digits } from './shared/utilities';
import ValonToken from '../build/ValonToken.json';
import ValonLock from '../build/ValonLock.json';

chai.use(solidity)

describe('ValonLock', () => {
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
  let LOCK: Contract;

  beforeEach(async () => {
    token = await deployContract(wallet, ValonToken, [ethers.BigNumber.from('90000000000000000000000000')]);
    LOCK = await deployContract(
      wallet,
      ValonLock,
      [token.address]
    );
    const walletUser = token.connect(provider.getSigner(wallet.address));
    walletUser.approve(LOCK.address, '90000000000000000000000000');
    expect(await token.balanceOf(wallet.address)).to.eq('90000000000000000000000000');
  });

  it('lock vlon', async () => {
    const walletUserLOCK = LOCK.connect(provider.getSigner(wallet.address));
    const walletUserToken = token.connect(provider.getSigner(wallet.address));
    const currentBlockHeight = await LOCK.getBlockHeight();
    const endBlockHeight = currentBlockHeight.add(100000);
    await walletUserLOCK.lockVLON(endBlockHeight, '90000000000000000000000000');

    expect(await token.balanceOf(LOCK.address)).to.eq('90000000000000000000000000');
    expect(await walletUserLOCK.getStartHeight(wallet.address)).to.eq('4');
    expect(await walletUserLOCK.getClaimedHeight(wallet.address)).to.eq('4');
    expect(await walletUserLOCK.getEndHeight(wallet.address)).to.eq('100002');
    const VLONPerBlock = ethers.BigNumber.from('900018000360007200144');
    expect(await walletUserLOCK.getVLONPerBlock(wallet.address)).to.eq(VLONPerBlock); // 900 vlon

    // 1 block mined
    await walletUserToken.approve(LOCK.address, '90000000000000000000000000');
    expect(await walletUserLOCK.getUnclaimedBlocks(wallet.address)).to.eq('1');
    expect(await walletUserLOCK.getClaimableVLON(wallet.address)).to.eq(VLONPerBlock);

    // 2 block mined
    await walletUserToken.approve(LOCK.address, '90000000000000000000000000');
    expect(await walletUserLOCK.getUnclaimedBlocks(wallet.address)).to.eq('2');
    expect(await walletUserLOCK.getClaimableVLON(wallet.address)).to.eq(VLONPerBlock.mul(2));

    // 3 block mined
    await walletUserToken.approve(LOCK.address, '90000000000000000000000000');
    expect(await walletUserLOCK.getUnclaimedBlocks(wallet.address)).to.eq('3');
    expect(await walletUserLOCK.getClaimableVLON(wallet.address)).to.eq(VLONPerBlock.mul(3));

    // claim
    await walletUserLOCK.claimVLON();
    expect(await token.balanceOf(wallet.address)).to.eq(VLONPerBlock.mul(4));
    expect(await walletUserLOCK.getClaimableVLON(wallet.address)).to.eq(0);
    expect(await walletUserLOCK.getClaimedHeight(wallet.address)).to.eq('8');

    // 1 block mined
    await walletUserToken.approve(LOCK.address, '90000000000000000000000000');
    expect(await walletUserLOCK.getUnclaimedBlocks(wallet.address)).to.eq('1');
    expect(await walletUserLOCK.getClaimableVLON(wallet.address)).to.eq(VLONPerBlock);

    // claim
    await walletUserLOCK.claimVLON();
    expect(await token.balanceOf(wallet.address)).to.eq(VLONPerBlock.mul(6));
    expect(await walletUserLOCK.getClaimableVLON(wallet.address)).to.eq(0);
    expect(await walletUserLOCK.getClaimedHeight(wallet.address)).to.eq('10');

  });

});
