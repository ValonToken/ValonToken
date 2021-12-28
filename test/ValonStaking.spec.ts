import chai, { expect } from 'chai';
import { ethers, Contract } from 'ethers';
//import { MaxUint256 } from 'ethers/constants';
//import { ethers.BigNumber.from, hexlify, keccak256, defaultAbiCoder, toUtf8Bytes, BigNumber } from 'ethers/utils';
import { solidity, MockProvider, deployContract } from 'ethereum-waffle';
import { ecsign } from 'ethereumjs-util';
import { expandTo18Decimals, getApprovalDigest, _to18Digits } from './shared/utilities';
import ValonToken from '../build/ValonToken.json';
import ValonStaking from '../build/ValonStaking.json';
import MockBEP20 from '../build/MockBEP20.json';

chai.use(solidity)

const TOTAL_SUPPLY = expandTo18Decimals(600000000);
const DIFFICULTY = 100;
const REWARD_CAP = 300000000;
const REWARDS_PER_BLOCK = ethers.BigNumber.from('4822530864197531000');

describe('ValonStaking', () => {
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
  let lpt1: Contract;
  let lpt2: Contract;
  let lpt3: Contract;
  let token: Contract;
  let staking: Contract;

  beforeEach(async () => {
    lpt1 = await deployContract(wallet, MockBEP20, [TOTAL_SUPPLY, 'LPT1', 'LPT1']);
    lpt2 = await deployContract(wallet, MockBEP20, [TOTAL_SUPPLY, 'LPT2', 'LPT2']);
    lpt3 = await deployContract(wallet, MockBEP20, [TOTAL_SUPPLY, 'LPT3', 'LPT3']);
    token = await deployContract(wallet, ValonToken, [TOTAL_SUPPLY]);
    staking = await deployContract(wallet, ValonStaking, [token.address, REWARD_CAP, DIFFICULTY, REWARDS_PER_BLOCK.toString()]);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY);

    const walletUserToken = token.connect(provider.getSigner(wallet.address));
    await walletUserToken.transfer(staking.address, expandTo18Decimals(REWARD_CAP));
    expect(await token.balanceOf(staking.address)).to.eq(expandTo18Decimals(REWARD_CAP));

    await walletUserToken.transferOwnership(staking.address);
  });

  it('create pool', async () => {
    const walletUser = staking.connect(provider.getSigner(wallet.address));
    let poolInfo = await walletUser.getPoolInfo(lpt1.address);
    expect(poolInfo[0]).to.eq('0x0000000000000000000000000000000000000000');

    await walletUser.createPool(lpt1.address);
    expect(walletUser.createPool(lpt1.address)).to.reverted;

    poolInfo = await walletUser.getPoolInfo(lpt1.address);
    expect(poolInfo[0]).to.eq(lpt1.address);

  });

  it('add stake', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));

    // transfer LPT to other user & check balance
    await walletUserStaking.createPool(lpt1.address);
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(0);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100));
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(100));
    const otherUserLpt1Balance = await otherUserLpt1.balanceOf(other.address);
    expect(otherUserLpt1Balance).to.eq(expandTo18Decimals(100));

    // approve staking contract & add stake
    expect(await walletUserStaking.getLptBalance(lpt1.address, staking.address)).to.eq(0);
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100));
    const allowance = await otherUserLpt1.allowance(other.address, staking.address);
    expect(allowance).to.eq(expandTo18Decimals(100));

    expect(otherUserStaking.addStake(lpt1.address, expandTo18Decimals(101))).to.reverted;
    expect(otherUserStaking.addStake(lpt2.address, expandTo18Decimals(100))).to.reverted;
    expect(otherUserStaking.addStake(lpt1.address, ethers.BigNumber.from(0))).to.reverted;
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100));
    expect(await walletUserStaking.getLptBalance(lpt1.address, staking.address)).to.eq(expandTo18Decimals(100));
    const otherUserStakeAmount = await otherUserStaking.getStake(lpt1.address, other.address);
    expect(otherUserStakeAmount).to.eq(expandTo18Decimals(100));

    let poolInfo = await walletUserStaking.getPoolInfo(lpt1.address);
    expect(poolInfo[0]).to.eq(lpt1.address); // lpToken address
    expect(poolInfo[1]).to.eq(expandTo18Decimals(100)); // total stakes

    //remove stake
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(100));
    expect(await walletUserStaking.getLptBalance(lpt1.address, staking.address)).to.eq(0);
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(100));
    poolInfo = await walletUserStaking.getPoolInfo(lpt1.address);
    expect(poolInfo[1]).to.eq(expandTo18Decimals(0));
  });

  it('difficulty & reward amount', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));

    // transfer LPT to other user & check balance
    await walletUserStaking.createPool(lpt1.address);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100));

    // empty values
    expect(await otherUserStaking.getStakingPower(lpt1.address, other.address)).to.eq(0);
    expect(await otherUserStaking.getPoolStakingPower(lpt1.address)).to.eq(0);
    expect(await otherUserStaking.getDifficulty()).to.eq(DIFFICULTY);
    expect(await otherUserStaking.getStakeBlockheight(lpt1.address, other.address)).to.eq(0);
    expect(await otherUserStaking.getTotalStakes()).to.eq(0);
    expect(await otherUserStaking.getTotalRewards()).to.eq(0);
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(100));

    // add 1 stake
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(10));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(10));
    expect(await otherUserStaking.getStakingPower(lpt1.address, other.address)).to.eq('1000000000000000000');
    expect(await otherUserStaking.getPoolStakingPower(lpt1.address)).to.eq('1000000000000000000');
    expect(await otherUserStaking.getDifficulty()).to.eq(DIFFICULTY);
    let currentBlockHeight = await otherUserStaking.getBlockHeight();
    expect(await otherUserStaking.getStakeBlockheight(lpt1.address, other.address)).to.eq(currentBlockHeight);
    expect(await otherUserStaking.getTotalStakes()).to.eq(expandTo18Decimals(10));
    expect(await otherUserStaking.getTotalRewards()).to.eq(0);
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(90));

    // remove stake
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(10));
    expect(await otherUserStaking.getStakingPower(lpt1.address, other.address)).to.eq(0);
    expect(await otherUserStaking.getPoolStakingPower(lpt1.address)).to.eq(0);
    expect(await otherUserStaking.getDifficulty()).to.eq(DIFFICULTY);
    currentBlockHeight = await otherUserStaking.getBlockHeight();
    expect(await otherUserStaking.getStakeBlockheight(lpt1.address, other.address)).to.eq(currentBlockHeight);
    expect(await otherUserStaking.getTotalStakes()).to.eq(0);
    expect(await otherUserStaking.getTotalRewards()).to.eq(REWARDS_PER_BLOCK.toString());
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(100));
    
    // difficulty calculations
    await walletUserStaking.setTotalRewards(expandTo18Decimals(30000000)); // 10%
    const diff = ethers.BigNumber.from(DIFFICULTY);
    let newDiff = diff.sub(diff.div(10));
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    let reward = REWARDS_PER_BLOCK.sub(REWARDS_PER_BLOCK.div(10));
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(150000000)); // 50%
    newDiff = diff.sub(diff.div(2));
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.sub(REWARDS_PER_BLOCK.div(2));
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);
    
    await walletUserStaking.setTotalRewards(expandTo18Decimals(300000000)); // 100%
    newDiff = ethers.BigNumber.from(1);
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.div(ethers.BigNumber.from(DIFFICULTY));
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(600000000)); // 200%
    newDiff = ethers.BigNumber.from(1);
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.div(ethers.BigNumber.from(DIFFICULTY));
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(64680000)); // 21.56%
    newDiff = diff.sub(diff.mul(2156).div(10000));
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.sub(REWARDS_PER_BLOCK.mul(21).div(100));
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(226080000)); // 75.36%
    newDiff = diff.sub(diff.mul(7536).div(10000));
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.sub(REWARDS_PER_BLOCK.mul(75).div(100));
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    //difficulty with more precision
    await walletUserStaking.setDifficulty(10000);
    await walletUserStaking.setTotalRewards(expandTo18Decimals(30000000)); // 10%
    let diffPrecision = ethers.BigNumber.from(10000);
    newDiff = diffPrecision.sub(diffPrecision.div(10));
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.sub(REWARDS_PER_BLOCK.div(10));
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(226080000)); // 75.36%
    newDiff = diffPrecision.sub(diffPrecision.mul(7536).div(10000));
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    let difficulty10000 = ethers.BigNumber.from(10000);
    reward = REWARDS_PER_BLOCK.mul(newDiff).div(difficulty10000);
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(99990000)); // 33.33%
    newDiff = diffPrecision.sub(diffPrecision.mul(3333).div(10000));
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.mul(newDiff).div(difficulty10000);
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(300000000)); // 100%
    newDiff = ethers.BigNumber.from(1);
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.mul(newDiff).div(difficulty10000);
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);

    await walletUserStaking.setTotalRewards(expandTo18Decimals(600000000)); // 200%
    newDiff = ethers.BigNumber.from(1);
    expect(await otherUserStaking.getDifficulty()).to.eq(newDiff.toString());
    reward = REWARDS_PER_BLOCK.mul(newDiff).div(difficulty10000);
    expect(await walletUserStaking.getRewardsPerBlock()).to.eq(reward);
  });
  
  it('rewards', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));

    // test rewards
    await walletUserStaking.createPool(lpt1.address);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(10));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(10));
    await provider.send('evm_mine', [{}]);
    let  unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt1.address, other.address);
    expect(unrealizedRewards).to.eq(REWARDS_PER_BLOCK.toString());

    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt1.address, other.address);
    expect(unrealizedRewards).to.eq(REWARDS_PER_BLOCK.mul(2).toString());

    // empty
    unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt2.address, other.address);
    expect(unrealizedRewards).to.eq(0);

    unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt1.address, other2.address);
    expect(unrealizedRewards).to.eq(0);

    let realizedRewards = await otherUserStaking.getRealizedRewards(lpt1.address, other.address);
    expect(realizedRewards).to.eq(0);

    let actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    expect(actualRewards).to.eq(REWARDS_PER_BLOCK.mul(2).toString());

    // stake 2
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(10));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(10));
    unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt1.address, other2.address);
    expect(unrealizedRewards).to.eq(0);

    realizedRewards = await otherUserStaking.getRealizedRewards(lpt1.address, other.address);
    expect(realizedRewards).to.eq(REWARDS_PER_BLOCK.mul(4).toString());

    actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    expect(actualRewards).to.eq(REWARDS_PER_BLOCK.mul(4).toString());

    // remove stake
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(10));
    unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt1.address, other2.address);
    expect(unrealizedRewards).to.eq(0);

    realizedRewards = await otherUserStaking.getRealizedRewards(lpt1.address, other.address);
    expect(realizedRewards).to.eq(REWARDS_PER_BLOCK.mul(5).toString());

    actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    expect(actualRewards).to.eq(REWARDS_PER_BLOCK.mul(5).toString());
    expect(await otherUserStaking.getStake(lpt1.address, other.address)).to.eq(expandTo18Decimals(10));
    let poolInfo = await otherUserStaking.getPoolInfo(lpt1.address);
    expect(poolInfo[1]).to.eq(expandTo18Decimals(10)); // total stake
    expect(poolInfo[2]).to.eq(REWARDS_PER_BLOCK.mul(5).toString()); // total rewards

    // remove stake 2
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(10));
    unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt1.address, other2.address);
    expect(unrealizedRewards).to.eq(0);

    realizedRewards = await otherUserStaking.getRealizedRewards(lpt1.address, other.address);
    expect(realizedRewards).to.eq(REWARDS_PER_BLOCK.mul(6).toString());

    actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    expect(actualRewards).to.eq(REWARDS_PER_BLOCK.mul(6).toString());
    expect(await otherUserStaking.getStake(lpt1.address, other.address)).to.eq(0);
    poolInfo = await otherUserStaking.getPoolInfo(lpt1.address);
    expect(poolInfo[1]).to.eq(0); // total stake
    expect(poolInfo[2]).to.eq(REWARDS_PER_BLOCK.mul(6).toString()); // total rewards

    // rewards should stop
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    unrealizedRewards = await otherUserStaking.getUnrealizedRewards(lpt1.address, other2.address);
    expect(unrealizedRewards).to.eq(0);

    realizedRewards = await otherUserStaking.getRealizedRewards(lpt1.address, other.address);
    expect(realizedRewards).to.eq(REWARDS_PER_BLOCK.mul(6).toString());

    actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    expect(actualRewards).to.eq(REWARDS_PER_BLOCK.mul(6).toString());
    expect(await otherUserStaking.getStake(lpt1.address, other.address)).to.eq(0);
    poolInfo = await otherUserStaking.getPoolInfo(lpt1.address);
    expect(poolInfo[1]).to.eq(0); // total stake
    expect(poolInfo[2]).to.eq(REWARDS_PER_BLOCK.mul(6).toString()); // total rewards
  });

  it('rewards: multi user', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const walletUserLpt2 = lpt2.connect(provider.getSigner(wallet.address));
    const walletUserLpt3 = lpt3.connect(provider.getSigner(wallet.address));

    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const otherUserLpt2 = lpt2.connect(provider.getSigner(other.address));
    const otherUserLpt3 = lpt3.connect(provider.getSigner(other.address));

    const otherUser2Lpt1 = lpt1.connect(provider.getSigner(other2.address));
    const otherUser2Lpt2 = lpt2.connect(provider.getSigner(other2.address));
    const otherUser2Lpt3 = lpt3.connect(provider.getSigner(other2.address));

    const otherUser3Lpt1 = lpt1.connect(provider.getSigner(other3.address));
    const otherUser3Lpt2 = lpt2.connect(provider.getSigner(other3.address));
    const otherUser3Lpt3 = lpt3.connect(provider.getSigner(other3.address));

    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking1 = staking.connect(provider.getSigner(other.address));
    const otherUserStaking2 = staking.connect(provider.getSigner(other2.address));
    const otherUserStaking3 = staking.connect(provider.getSigner(other3.address));

    await walletUserStaking.createPool(lpt1.address);
    await walletUserStaking.createPool(lpt2.address);
    await walletUserStaking.createPool(lpt3.address);

    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100));
    await walletUserLpt1.transfer(other2.address, expandTo18Decimals(100));
    await walletUserLpt1.transfer(other3.address, expandTo18Decimals(100));
    
    await walletUserLpt2.transfer(other.address, expandTo18Decimals(100));
    await walletUserLpt2.transfer(other2.address, expandTo18Decimals(100));
    await walletUserLpt2.transfer(other3.address, expandTo18Decimals(100));

    await walletUserLpt3.transfer(other.address, expandTo18Decimals(100));
    await walletUserLpt3.transfer(other2.address, expandTo18Decimals(100));
    await walletUserLpt3.transfer(other3.address, expandTo18Decimals(100));


    //LP1 - staking block heights
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(10));
    await otherUser2Lpt1.approve(staking.address, expandTo18Decimals(20));
    await otherUser3Lpt1.approve(staking.address, expandTo18Decimals(50));
    await otherUserStaking1.addStake(lpt1.address, expandTo18Decimals(10));
    let user1StakeBlock = await otherUserStaking1.getStakeBlockheight(lpt1.address, other.address);
    await otherUserStaking2.addStake(lpt1.address, expandTo18Decimals(20));
    let user2StakeBlock = await otherUserStaking2.getStakeBlockheight(lpt1.address, other2.address);
    await otherUserStaking3.addStake(lpt1.address, expandTo18Decimals(50));
    let user3StakeBlock = await otherUserStaking3.getStakeBlockheight(lpt1.address, other3.address);

    //stakes & balances
    const totalStakes = await walletUserStaking.getTotalStakes();
    expect(totalStakes).to.eq(expandTo18Decimals(80));
    expect(await walletUserStaking.getStake(lpt1.address, other.address)).to.eq(expandTo18Decimals(10));
    expect(await walletUserStaking.getStake(lpt1.address, other2.address)).to.eq(expandTo18Decimals(20));
    expect(await walletUserStaking.getStake(lpt1.address, other3.address)).to.eq(expandTo18Decimals(50));
    expect(await walletUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(90));
    expect(await walletUserStaking.getLptBalance(lpt1.address, other2.address)).to.eq(expandTo18Decimals(80));
    expect(await walletUserStaking.getLptBalance(lpt1.address, other3.address)).to.eq(expandTo18Decimals(50));
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other.address)).to.eq(0);
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other2.address)).to.eq(0);
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other3.address)).to.eq(0);
    expect(await otherUserStaking1.getStakingPower(lpt1.address, other.address)).to.eq('125000000000000000');
    expect(await otherUserStaking2.getStakingPower(lpt1.address, other2.address)).to.eq('250000000000000000');
    expect(await otherUserStaking3.getStakingPower(lpt1.address, other3.address)).to.eq('625000000000000000');
    expect(await otherUserStaking3.getPoolStakingPower(lpt1.address)).to.eq('1000000000000000000');

    //rewards
    let blockHeight = ethers.BigNumber.from(await walletUserStaking.getBlockHeight());
    let user1Blocks = blockHeight.sub(user1StakeBlock);
    let user2Blocks = blockHeight.sub(user2StakeBlock);
    let user3Blocks = blockHeight.sub(user3StakeBlock);
    let user1Rewards = REWARDS_PER_BLOCK.mul(user1Blocks).mul('125000000000000000').div('1000000000000000000');
    let user2Rewards = REWARDS_PER_BLOCK.mul(user2Blocks).mul('250000000000000000').div('1000000000000000000');
    let user3Rewards = REWARDS_PER_BLOCK.mul(user3Blocks).mul('625000000000000000').div('1000000000000000000');
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other.address)).to.eq(user1Rewards);
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other2.address)).to.eq(user2Rewards);
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other3.address)).to.eq(user3Rewards);

    // add more stake
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(33));
    await otherUser2Lpt1.approve(staking.address, expandTo18Decimals(3));
    await otherUser3Lpt1.approve(staking.address, expandTo18Decimals(17));

    await otherUserStaking1.addStake(lpt1.address, expandTo18Decimals(33)); // 43
    let user1RealizedRewards = REWARDS_PER_BLOCK.mul(user1Blocks.add(4)).mul('125000000000000000').div('1000000000000000000');
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other.address)).to.eq(user1RealizedRewards);
    user1StakeBlock = await otherUserStaking1.getStakeBlockheight(lpt1.address, other.address);

    await otherUserStaking2.addStake(lpt1.address, expandTo18Decimals(3));  // 23
    let user2RealizedRewards = REWARDS_PER_BLOCK.mul(user2Blocks.add(5)).mul('176991150442477876').div('1000000000000000000'); // 43 + 20 + 50 = 113
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other2.address)).to.eq(user2RealizedRewards);
    user2StakeBlock = await otherUserStaking2.getStakeBlockheight(lpt1.address, other2.address);

    await otherUserStaking3.addStake(lpt1.address, expandTo18Decimals(17)); // 67 total = 133
    let user3RealizedRewards = REWARDS_PER_BLOCK.mul(user3Blocks.add(6)).mul('431034482758620689').div('1000000000000000000'); // 43 + 23 + 50 = 116
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other3.address)).to.eq(user3RealizedRewards);
    user3StakeBlock = await otherUserStaking3.getStakeBlockheight(lpt1.address, other3.address);

    blockHeight = ethers.BigNumber.from(await walletUserStaking.getBlockHeight());
    user1Blocks = blockHeight.sub(user1StakeBlock);
    user2Blocks = blockHeight.sub(user2StakeBlock);
    user3Blocks = blockHeight.sub(user3StakeBlock);

    user1Rewards = REWARDS_PER_BLOCK.mul(user1Blocks).mul('323308270676691729').div('1000000000000000000'); // 43 / 133
    user2Rewards = REWARDS_PER_BLOCK.mul(user2Blocks).mul('172932330827067669').div('1000000000000000000'); // 23 / 133
    user3Rewards = REWARDS_PER_BLOCK.mul(user3Blocks).mul('503759398496240601').div('1000000000000000000'); // 67 / 133
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other.address)).to.eq(user1Rewards);
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other2.address)).to.eq(user2Rewards);
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other3.address)).to.eq(user3Rewards);

    //remove stake
    const test = user1Rewards = REWARDS_PER_BLOCK.mul(user1Blocks.add(1)).mul('323308270676691729').div('1000000000000000000');
    let user1UnrealizedRewards = await walletUserStaking.getUnrealizedRewards(lpt1.address, other.address);
    user1RealizedRewards = await walletUserStaking.getRealizedRewards(lpt1.address, other.address);
    user1Rewards = user1UnrealizedRewards.add(user1RealizedRewards).add(
      REWARDS_PER_BLOCK.mul('323308270676691729').div('1000000000000000000')
    ); // 43 + 23 + 67 = 133
    await otherUserStaking1.removeStake(lpt1.address, expandTo18Decimals(43));
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other.address)).to.eq(user1Rewards);

    let user2UnrealizedRewards = await walletUserStaking.getUnrealizedRewards(lpt1.address, other2.address);
    user2RealizedRewards = await walletUserStaking.getRealizedRewards(lpt1.address, other2.address);
    user2Rewards = user2UnrealizedRewards.add(user2RealizedRewards).add(
      REWARDS_PER_BLOCK.mul('255555555555555555').div('1000000000000000000')
    ); // 23 + 67 = 90
    await otherUserStaking2.removeStake(lpt1.address, expandTo18Decimals(23));
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other2.address)).to.eq(user2Rewards);

    let user3UnrealizedRewards = await walletUserStaking.getUnrealizedRewards(lpt1.address, other3.address);
    user3RealizedRewards = await walletUserStaking.getRealizedRewards(lpt1.address, other3.address);
    user3Rewards = user3UnrealizedRewards.add(user3RealizedRewards).add(REWARDS_PER_BLOCK);
    await otherUserStaking3.removeStake(lpt1.address, expandTo18Decimals(67));
    expect(await walletUserStaking.getRealizedRewards(lpt1.address, other3.address)).to.eq(user3Rewards);

    expect(await walletUserStaking.getStake(lpt1.address, other.address)).to.eq(0);
    expect(await walletUserStaking.getStake(lpt1.address, other2.address)).to.eq(0);
    expect(await walletUserStaking.getStake(lpt1.address, other3.address)).to.eq(0);
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other.address)).to.eq(0);
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other2.address)).to.eq(0);
    expect(await walletUserStaking.getUnrealizedRewards(lpt1.address, other3.address)).to.eq(0);
    expect(await otherUserStaking1.getStakingPower(lpt1.address, other.address)).to.eq(0);
    expect(await otherUserStaking2.getStakingPower(lpt1.address, other2.address)).to.eq(0);
    expect(await otherUserStaking3.getStakingPower(lpt1.address, other3.address)).to.eq(0);
    expect(await otherUserStaking3.getPoolStakingPower(lpt1.address)).to.eq(0);
    expect(await walletUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(100));
    expect(await walletUserStaking.getLptBalance(lpt1.address, other2.address)).to.eq(expandTo18Decimals(100));
    expect(await walletUserStaking.getLptBalance(lpt1.address, other3.address)).to.eq(expandTo18Decimals(100));
  });

  it('claim rewards', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));

    // test rewards
    await walletUserStaking.createPool(lpt1.address);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(10));
    expect(otherUserStaking.claimRewards(lpt1.address)).to.reverted;
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(10));
    expect(await otherUserStaking.getActualRewards(lpt1.address, other.address)).to.eq(0);

    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block

    await otherUserStaking.claimRewards(lpt1.address);
    let actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    expect(actualRewards).to.eq(0);
    let rewards = REWARDS_PER_BLOCK.mul(4);
    expect(await token.balanceOf(other.address)).to.eq(rewards.toString());

    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserStaking.claimRewards(lpt1.address);
    rewards = REWARDS_PER_BLOCK.mul(8);
    expect(await token.balanceOf(other.address)).to.eq(rewards.toString());

    //remove stake
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(10));
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    expect(await otherUserStaking.getActualRewards(lpt1.address, other.address)).to.eq(REWARDS_PER_BLOCK);
    await otherUserStaking.claimRewards(lpt1.address);
    rewards = REWARDS_PER_BLOCK.mul(9);
    expect(await token.balanceOf(other.address)).to.eq(rewards.toString());
  });

  it('stake pool shares', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const otherUser2Lpt1 = lpt1.connect(provider.getSigner(other2.address));
    const otherUser3Lpt1 = lpt1.connect(provider.getSigner(other3.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));
    const otherUserStaking2 = staking.connect(provider.getSigner(other2.address));
    const otherUserStaking3 = staking.connect(provider.getSigner(other3.address));

    // test rewards
    await walletUserStaking.createPool(lpt1.address);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await walletUserLpt1.transfer(other2.address, expandTo18Decimals(100000));
    await walletUserLpt1.transfer(other3.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));
    await otherUser2Lpt1.approve(staking.address, expandTo18Decimals(100000));
    await otherUser3Lpt1.approve(staking.address, expandTo18Decimals(100000));

    //15000
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(5000));
    await otherUserStaking2.addStake(lpt1.address, expandTo18Decimals(5000));
    await otherUserStaking3.addStake(lpt1.address, expandTo18Decimals(5000));
    expect(await walletUserStaking.getStakingPower(lpt1.address, other.address)).to.eq('333333333333333333');
    expect(await walletUserStaking.getStakingPower(lpt1.address, other2.address)).to.eq('333333333333333333');
    expect(await walletUserStaking.getStakingPower(lpt1.address, other3.address)).to.eq('333333333333333333');
    expect(await walletUserStaking.getTotalStakes()).to.eq(expandTo18Decimals(15000));

    //12500
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(2500));
    expect(await walletUserStaking.getStakingPower(lpt1.address, other.address)).to.eq('200000000000000000');
    expect(await walletUserStaking.getStakingPower(lpt1.address, other2.address)).to.eq('400000000000000000');
    expect(await walletUserStaking.getStakingPower(lpt1.address, other3.address)).to.eq('400000000000000000');
    expect(await walletUserStaking.getTotalStakes()).to.eq(expandTo18Decimals(12500));

    //18000
    await otherUserStaking2.addStake(lpt1.address, expandTo18Decimals(5500));
    expect(await walletUserStaking.getStakingPower(lpt1.address, other.address)).to.eq('138888888888888888');
    expect(await walletUserStaking.getStakingPower(lpt1.address, other2.address)).to.eq('583333333333333333');
    expect(await walletUserStaking.getStakingPower(lpt1.address, other3.address)).to.eq('277777777777777777');
    expect(await walletUserStaking.getTotalStakes()).to.eq(expandTo18Decimals(18000));
  });

  it('timelock', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));

    await walletUserStaking.createPool(lpt1.address);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));
    await walletUserStaking.setTimelockHeight(5);
    await walletUserStaking.setTimelock(true);

    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(5000));
    expect(otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(5000))).to.reverted;
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    expect(otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(5000))).to.reverted;
    expect(await otherUserStaking.getStake(lpt1.address, other.address)).to.eq(expandTo18Decimals(5000));

    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(5000));
    expect(await otherUserStaking.getStake(lpt1.address, other.address)).to.eq(0);
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(100000));
  });

  it('stake amounts and lpt', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));

    await walletUserStaking.createPool(lpt1.address);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));

    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(1632));
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(643));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(85));
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(13));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(11));
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(72));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(1));
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(3));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(9999));
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(8555));
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(173));
    let stake = await otherUserStaking.getStake(lpt1.address, other.address);
    expect(stake).to.eq(expandTo18Decimals(2615));
    expect(await otherUserStaking.getLptBalance(lpt1.address, other.address)).to.eq(expandTo18Decimals(97385));
  });

  it('pool disabled', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));

    await walletUserStaking.createPool(lpt1.address);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));

    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100));
    await walletUserStaking.setPoolActive(lpt1.address, false);
    expect(otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100))).to.reverted;
    await walletUserStaking.setPoolActive(lpt1.address, true);
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100));
    let stake = await otherUserStaking.getStake(lpt1.address, other.address);
    expect(stake).to.eq(expandTo18Decimals(200));

    // disabling pool also disables rewards from being realized
    await walletUserStaking.setPoolActive(lpt1.address, false);
    let realizedRewards = await otherUserStaking.getRealizedRewards(lpt1.address, other.address);
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(100));
    expect(await otherUserStaking.getRealizedRewards(lpt1.address, other.address)).to.eq(realizedRewards);
    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(100));
    expect(await otherUserStaking.getRealizedRewards(lpt1.address, other.address)).to.eq(realizedRewards);

    await otherUserStaking.claimRewards(lpt1.address);
    expect(await token.balanceOf(other.address)).to.eq(realizedRewards);
  });

  it('bonus multiplier', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));
    const otherUser = token.connect(provider.getSigner(other.address));

    await walletUserStaking.createPool(lpt1.address);
    await walletUserStaking.setPoolBonus(lpt1.address, '128900000000000000'); // 12.89%
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));

    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100));
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    let actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    let rewards = REWARDS_PER_BLOCK.add(REWARDS_PER_BLOCK.mul('128900000000000000').div('1000000000000000000'));
    expect(actualRewards).to.eq(rewards);

    // 4822530864197531000 + (4822530864197531000 * 1289 / 10000)
    // bonus reward should be 5444155092592592745.9 * 2 = 10888310185185185491.8
    await otherUserStaking.claimRewards(lpt1.address);
    let valonBalance = await otherUser.balanceOf(other.address);
    expect(valonBalance).to.eq('10888310185185185491');
  });

  it('pool reward sharing', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));
    const otherUser = token.connect(provider.getSigner(other.address));

    await walletUserStaking.createPool(lpt1.address);
    await walletUserStaking.createPool(lpt2.address);
    await walletUserStaking.createPool(lpt3.address);
    await walletUserStaking.setSharePoolRewards(true);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));

    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100));
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    let actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    let rewards = REWARDS_PER_BLOCK.div(3);
    expect(actualRewards).to.eq(rewards);

    await otherUserStaking.claimRewards(lpt1.address);
    let valonBalance = await otherUser.balanceOf(other.address);
    expect(valonBalance).to.eq('3215020576131687333');
  });

  it('pool reward sharing 2', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));
    const otherUser = token.connect(provider.getSigner(other.address));

    await walletUserStaking.setSharePoolRewards(true);
    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));

    await walletUserStaking.createPool(lpt1.address);
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100));
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    let actualRewards = await otherUserStaking.getActualRewards(lpt1.address, other.address);
    let rewards = REWARDS_PER_BLOCK;
    expect(actualRewards).to.eq(rewards);
  });

  it('precision', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const otherUser2Lpt1 = lpt1.connect(provider.getSigner(other2.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));
    const otherUserStaking2 = staking.connect(provider.getSigner(other2.address));

    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await walletUserLpt1.transfer(other2.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));
    await otherUser2Lpt1.approve(staking.address, expandTo18Decimals(100000));

    await walletUserStaking.createPool(lpt1.address);
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(1));
    await otherUserStaking2.addStake(lpt1.address, 100);
    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
    let actualRewards = await otherUserStaking2.getActualRewards(lpt1.address, other2.address);
    expect(actualRewards).to.eq('477');
  });

  it('stake holder count', async () => {
    const walletUserLpt1 = lpt1.connect(provider.getSigner(wallet.address));
    const otherUserLpt1 = lpt1.connect(provider.getSigner(other.address));
    const otherUser2Lpt1 = lpt1.connect(provider.getSigner(other2.address));
    const otherUser3Lpt1 = lpt1.connect(provider.getSigner(other3.address));
    const walletUserStaking = staking.connect(provider.getSigner(wallet.address));
    const otherUserStaking = staking.connect(provider.getSigner(other.address));
    const otherUserStaking2 = staking.connect(provider.getSigner(other2.address));
    const otherUserStaking3 = staking.connect(provider.getSigner(other3.address));

    await walletUserLpt1.transfer(other.address, expandTo18Decimals(100000));
    await walletUserLpt1.transfer(other2.address, expandTo18Decimals(100000));
    await walletUserLpt1.transfer(other3.address, expandTo18Decimals(100000));
    await otherUserLpt1.approve(staking.address, expandTo18Decimals(100000));
    await otherUser2Lpt1.approve(staking.address, expandTo18Decimals(100000));
    await otherUser3Lpt1.approve(staking.address, expandTo18Decimals(100000));

    await walletUserStaking.createPool(lpt1.address);
    await otherUserStaking.addStake(lpt1.address, expandTo18Decimals(100));
    expect((await walletUserStaking.getPoolInfo(lpt1.address))[5]).to.eq(1);

    await otherUserStaking2.addStake(lpt1.address, expandTo18Decimals(100));
    expect((await walletUserStaking.getPoolInfo(lpt1.address))[5]).to.eq(2);

    await otherUserStaking3.addStake(lpt1.address, expandTo18Decimals(100));
    expect((await walletUserStaking.getPoolInfo(lpt1.address))[5]).to.eq(3);

    await otherUserStaking2.removeStake(lpt1.address, expandTo18Decimals(50));
    expect((await walletUserStaking.getPoolInfo(lpt1.address))[5]).to.eq(3);

    await otherUserStaking2.removeStake(lpt1.address, expandTo18Decimals(50));
    expect((await walletUserStaking.getPoolInfo(lpt1.address))[5]).to.eq(2);

    await otherUserStaking3.removeStake(lpt1.address, expandTo18Decimals(100));
    expect((await walletUserStaking.getPoolInfo(lpt1.address))[5]).to.eq(1);

    await otherUserStaking.removeStake(lpt1.address, expandTo18Decimals(100));
    expect((await walletUserStaking.getPoolInfo(lpt1.address))[5]).to.eq(0);

    await otherUserLpt1.approve(other2.address, expandTo18Decimals(1)); // for mining a block
  });
});
