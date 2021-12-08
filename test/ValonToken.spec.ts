import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { solidity, MockProvider, deployContract } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest, _to18Digits } from './shared/utilities';
import ValonToken from '../build/ValonToken.json';

chai.use(solidity)

const TOTAL_SUPPLY = expandTo18Decimals(1000000)
const TEST_AMOUNT = expandTo18Decimals(10)

describe('ValonToken', () => {
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
  const [wallet, other, other2, other3] = provider.getWallets()

  let token: Contract
  beforeEach(async () => {
    token = await deployContract(wallet, ValonToken, [TOTAL_SUPPLY])
  });

  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    const name = await token.name()
    expect(name).to.eq('Valon')
    expect(await token.symbol()).to.eq('VLON')
    expect(await token.decimals()).to.eq(18)
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY)
  });

  it('approve', async () => {
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
  })

  it('transfer', async () => {
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('transfer:fail', async () => {
    await expect(token.transfer(other.address, TOTAL_SUPPLY.add(1))).to.be.reverted // ds-math-sub-underflow
    await expect(token.connect(other).transfer(wallet.address, 1)).to.be.reverted // ds-math-sub-underflow
  })

  it('transferFrom', async () => {
    await token.approve(other.address, TEST_AMOUNT)
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(0)
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })
});
