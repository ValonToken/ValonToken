import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { MaxUint256 } from 'ethers/constants';
import { bigNumberify, hexlify, keccak256, defaultAbiCoder, toUtf8Bytes, BigNumber } from 'ethers/utils';
import { solidity, MockProvider, deployContract } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest, _to18Digits } from './shared/utilities';
import ValonToken from '../build/ValonToken.json';

chai.use(solidity)

const TOTAL_SUPPLY = expandTo18Decimals(1000000)
const TEST_AMOUNT = expandTo18Decimals(10)

describe('ValonToken', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
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

  /*it('block height', async () => {
    const height = await token.getBlockHeight();
    expect(height).to.eq('10');

    await provider.send('evm_mine', {});
  });

  it('staking', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    await walletUser.transfer(other.address, 100);
    await otherUser.addStake(1);

    const userBalance = await token.balanceOf(other.address);
    expect(userBalance).to.eq(99);

    const userStake = await token.getStake(other.address);
    expect(userStake).to.eq(1);

    const height = await token.getBlockHeight();
    const userBlockHeght = await token.getStakeBlock(other.address);
    expect(userBlockHeght).to.eq(height);

    await provider.send('evm_mine', {});
    const userBlockHeght2 = await token.getStakeBlock(other.address);
    expect(userBlockHeght2).to.eq(height);

    const totalStakes = await token.getTotalStakes();
    expect(totalStakes).to.eq(1);

    const rewards = await token.getRealizedRewards(other.address);
    expect(rewards).to.eq(0);
  });

  it('rewards after staking: one block', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    await walletUser.transfer(other.address, 100);
    await otherUser.addStake(10);
    expect(await token.getStakingPower(other.address)).to.eq(10000);
    await otherUser.addStake(5);

    const rewardsPerBlock = await token.getRewardsPerBlock();
    const rewards = await token.getRealizedRewards(other.address);
    expect(rewards).to.eq(rewardsPerBlock);

    const totalStakes = await token.getTotalStakes();
    expect(totalStakes).to.eq(15);
  });

  it('rewards after staking: multi block', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    await walletUser.transfer(other.address, 100);
    await otherUser.addStake(10);
    await provider.send('evm_mine', {});
    await otherUser.addStake(5);
    await provider.send('evm_mine', {});

    const rewardsPerBlock = await token.getRewardsPerBlock();
    const rewardsPerBlockx2 = bigNumberify(rewardsPerBlock).mul(2);
    const rewards = await token.getRealizedRewards(other.address);
    expect(rewards).to.eq(rewardsPerBlockx2.toString());

    const totalStakes = await token.getTotalStakes();
    expect(totalStakes).to.eq(15);

    const unRealizedRewards = await token.getUnrealizedRewards(other.address);
    expect(unRealizedRewards).to.eq(rewardsPerBlock);

    const actualRewards = await token.getActualRewards(other.address);
    expect(actualRewards).to.eq(bigNumberify(rewardsPerBlock).mul(3).toString());
  });

  it('rewards after staking: multi user', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    const otherUser2 = token.connect(provider.getSigner(other2.address));
    const otherUser3 = token.connect(provider.getSigner(other3.address));
    await walletUser.transfer(other.address, 100);
    await walletUser.transfer(other2.address, 100);
    await walletUser.transfer(other3.address, 100);

    //staking block heights
    const blockHeight = bigNumberify(await token.getBlockHeight());
    await otherUser.addStake(10);
    const otherStakeBlock = await token.getStakeBlock(other.address);
    expect(otherStakeBlock).to.eq(blockHeight.add(1).toString());

    await otherUser2.addStake(20);
    const other2StakeBlock = await token.getStakeBlock(other2.address);
    expect(other2StakeBlock).to.eq(blockHeight.add(2).toString());

    await otherUser3.addStake(50);
    const other3StakeBlock = await token.getStakeBlock(other3.address);
    expect(other3StakeBlock).to.eq(blockHeight.add(3).toString());

    //stakes & balances
    const totalStakes = await token.getTotalStakes();
    expect(totalStakes).to.eq(80);
    expect(await token.getStake(other.address)).to.eq(10);
    expect(await token.getStake(other2.address)).to.eq(20);
    expect(await token.getStake(other3.address)).to.eq(50);
    expect(await token.balanceOf(other.address)).to.eq(90);
    expect(await token.balanceOf(other2.address)).to.eq(80);
    expect(await token.balanceOf(other3.address)).to.eq(50);
    expect(await token.getRealizedRewards(other.address)).to.eq(0);
    expect(await token.getRealizedRewards(other2.address)).to.eq(0);
    expect(await token.getRealizedRewards(other3.address)).to.eq(0);

    //updated rewards
    let stakingPower = await token.getStakingPower(other.address);
    const rewardsPerBlock = bigNumberify(await token.getRewardsPerBlock());
    expect(await token.getTotalStakes()).to.eq(80);
    expect(await token.getStake(other.address)).to.eq(10);
    expect(stakingPower).to.eq(1250);

    // staking again -> collects realized rewards -> calc unrealized rewards -> test total rewards
    await otherUser.addStake(20);
    const blockHeightEnd = bigNumberify(await token.getBlockHeight());
    const rewards = blockHeightEnd.sub(bigNumberify(otherStakeBlock)).mul(rewardsPerBlock).mul(stakingPower);
    const rewards18 = rewards.div(10000);
    stakingPower = await token.getStakingPower(other.address);
    expect(await token.getRealizedRewards(other.address)).to.eq(rewards18);
    expect(await token.getTotalStakes()).to.eq(100);
    expect(await token.getStake(other.address)).to.eq(30);
    expect(stakingPower).to.eq(3000);

    let unrealizedRewards = await token.getUnrealizedRewards(other.address);
    expect(unrealizedRewards).to.eq(0);

    let totalRewards = await token.getActualRewards(other.address);
    expect(totalRewards).to.eq(rewards18);

    //unrealized rewards after 1 block
    await provider.send('evm_mine', {});
    const additionalRewards = rewardsPerBlock.mul(stakingPower);
    const additionalRewards18 = additionalRewards.div(10000).toString();
    unrealizedRewards = await token.getUnrealizedRewards(other.address);
    expect(unrealizedRewards).to.eq(additionalRewards18.toString());

    totalRewards = await token.getActualRewards(other.address);
    expect(totalRewards).to.eq(rewards18.add(additionalRewards18).toString());
  });

  it('remove stake', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    const rewardsPerBlock = bigNumberify(await token.getRewardsPerBlock());

    await walletUser.transfer(other.address, expandTo18Decimals(50000));
    await otherUser.addStake(expandTo18Decimals(5000));
    await provider.send('evm_mine', {});
    await otherUser.addStake(expandTo18Decimals(5000));
    await provider.send('evm_mine', {});
    await otherUser.addStake(expandTo18Decimals(1000));
    await provider.send('evm_mine', {});

    let realizedRewards = await token.getRealizedRewards(other.address);
    expect(realizedRewards).to.eq(rewardsPerBlock.mul(4).toString());

    let unrealizedRewards = await token.getUnrealizedRewards(other.address);
    expect(unrealizedRewards).to.eq(rewardsPerBlock.toString());

    expect(await token.getStake(other.address)).to.eq(expandTo18Decimals(11000));

    //remove stake 1000
    await otherUser.removeStake(expandTo18Decimals(1000));
    await provider.send('evm_mine', {});

    realizedRewards = await token.getRealizedRewards(other.address);
    expect(realizedRewards).to.eq(rewardsPerBlock.mul(6).toString());

    unrealizedRewards = await token.getUnrealizedRewards(other.address);
    expect(unrealizedRewards).to.eq(rewardsPerBlock.toString());

    expect(await token.getStake(other.address)).to.eq(expandTo18Decimals(10000));
    expect(await token.balanceOf(other.address)).to.eq(expandTo18Decimals(40000));

    //remove stake 5000
    await otherUser.removeStake(expandTo18Decimals(5000));
    realizedRewards = await token.getRealizedRewards(other.address);
    expect(realizedRewards).to.eq(rewardsPerBlock.mul(8).toString());

    unrealizedRewards = await token.getUnrealizedRewards(other.address);
    expect(unrealizedRewards).to.eq(0);
  });

  it('claim rewards', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    const rewardsPerBlock = bigNumberify(await token.getRewardsPerBlock());

    await walletUser.transfer(other.address, expandTo18Decimals(50000));
    await otherUser.addStake(expandTo18Decimals(5000));
    await provider.send('evm_mine', {});
    await otherUser.addStake(expandTo18Decimals(2000));
    await provider.send('evm_mine', {});
    expect(await token.getStake(other.address)).to.eq(expandTo18Decimals(7000));
    expect(await token.getStakingPower(other.address)).to.eq(10000);

    let actualRewards = bigNumberify(await token.getActualRewards(other.address));
    expect(await token.balanceOf(other.address)).to.eq(expandTo18Decimals(43000));

    await otherUser.claimRewards();
    const claimedRewards = actualRewards.add(rewardsPerBlock);
    expect(await token.balanceOf(other.address)).to.eq(claimedRewards.add(expandTo18Decimals(43000)).toString());
    expect(await token.getStake(other.address)).to.eq(expandTo18Decimals(7000));
    expect(await token.getUnrealizedRewards(other.address)).to.eq(0);
    expect(await token.getRealizedRewards(other.address)).to.eq(0);
    expect(await token.getTotalRewards()).to.eq(claimedRewards);
    await otherUser.claimRewards();
    expect(await token.balanceOf(other.address)).to.eq(claimedRewards.add(rewardsPerBlock).add(expandTo18Decimals(43000)).toString());
    expect(await token.getStake(other.address)).to.eq(expandTo18Decimals(7000));
    expect(await token.getUnrealizedRewards(other.address)).to.eq(0);
    expect(await token.getRealizedRewards(other.address)).to.eq(0);
    expect(await token.getTotalRewards()).to.eq(claimedRewards.add(rewardsPerBlock));
  });

  it('difficulty', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    const rewardsPerBlock = bigNumberify(await token.getRewardsPerBlock());

    await walletUser.transfer(other.address, expandTo18Decimals(50000));
    expect(otherUser.activateDifficulty(true)).to.reverted;
    expect(await token.getDifficulty()).to.eq(100);
    expect(await token.getDifficultyActivated()).to.eq(false);
    await walletUser.activateDifficulty(true);
    expect(await token.getDifficultyActivated()).to.eq(true);
    await otherUser.addStake(expandTo18Decimals(5000));
    await provider.send('evm_mine', {});

    expect(await token.getUnrealizedRewards(other.address)).to.eq(rewardsPerBlock.toString());
    expect(await token.getRealizedRewards(other.address)).to.eq(0);
    expect(await token.getTotalRewards()).to.eq(0);
  });

  it('stake pool shares', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    const otherUser2 = token.connect(provider.getSigner(other2.address));
    const otherUser3 = token.connect(provider.getSigner(other3.address));
    await walletUser.transfer(other.address, expandTo18Decimals(50000));
    await walletUser.transfer(other2.address, expandTo18Decimals(50000));
    await walletUser.transfer(other3.address, expandTo18Decimals(50000));

    //15000
    await otherUser.addStake(expandTo18Decimals(5000));
    await otherUser2.addStake(expandTo18Decimals(5000));
    await otherUser3.addStake(expandTo18Decimals(5000));
    expect(await token.getStakingPower(other.address)).to.eq(3333);
    expect(await token.getStakingPower(other2.address)).to.eq(3333);
    expect(await token.getStakingPower(other3.address)).to.eq(3333);
    expect(await token.getTotalStakes()).to.eq(expandTo18Decimals(15000));

    //12500
    await otherUser.removeStake(expandTo18Decimals(2500));
    expect(await token.getStakingPower(other.address)).to.eq(2000);
    expect(await token.getStakingPower(other2.address)).to.eq(4000);
    expect(await token.getStakingPower(other3.address)).to.eq(4000);
    expect(await token.getTotalStakes()).to.eq(expandTo18Decimals(12500));

    //18000
    await otherUser2.addStake(expandTo18Decimals(5500));
    expect(await token.getStakingPower(other.address)).to.eq(1388);
    expect(await token.getStakingPower(other2.address)).to.eq(5833);
    expect(await token.getStakingPower(other3.address)).to.eq(2777);
    expect(await token.getTotalStakes()).to.eq(expandTo18Decimals(18000));
  });

  it('compound', async () => {
    const walletUser = token.connect(provider.getSigner(wallet.address));
    const otherUser = token.connect(provider.getSigner(other.address));
    await walletUser.transfer(other.address, expandTo18Decimals(50000));
    const rewardsPerBlock = bigNumberify(await token.getRewardsPerBlock());

    await otherUser.addStake(expandTo18Decimals(5000));
    await provider.send('evm_mine', {});
    const stake = bigNumberify(await token.getStake(other.address));
    await otherUser.compound();
    const balance = bigNumberify(await token.balanceOf(other.address));
    expect(await token.balanceOf(other.address)).to.eq(balance.toString());
    expect(await token.getStake(other.address)).to.eq(stake.add(rewardsPerBlock.mul(2)).toString());
    expect(await token.getActualRewards(other.address)).to.eq(0);
  });*/
  //permissions

  // think about totalRewards, how to calculate?? if only on claim -> ppl can print without claiming

  // MAKE GIT FOR THIS PROJECT
  // timelock for staking, need to stay minimum 1 day in staking
  // max staking power, need to cap?
  // admin disable staking

  // clean up swap token from reflection shits
  // test swapping and other functionality
  // add staking to swap token
  // test
})
