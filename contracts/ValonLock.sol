pragma solidity 0.8.7;
import { IBEP20 } from './interfaces/IBEP20.sol';
import { SafeBEP20 } from './libs/SafeBEP20.sol';
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ValonToken } from './ValonToken.sol';

contract ValonLock is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    ValonToken public valonToken;
    mapping(address => uint256) lockedVLON;
    mapping(address => uint256) startHeight;
    mapping(address => uint256) claimedHeight;
    mapping(address => uint256) endHeight;
    mapping(address => uint256) claimedVLON;

    constructor(
        ValonToken valonTokenAddress
    ) {
        valonToken = valonTokenAddress;
    }

    function lockVLON(uint256 endBlockHeight, uint256 amountVLON) public nonReentrant {
        require(lockedVLON[msg.sender] == 0, "Already locked");
        require(valonToken.transferFrom(msg.sender, address(this), amountVLON), "Transaction failed");

        startHeight[msg.sender] = block.number;
        claimedHeight[msg.sender] = block.number;
        endHeight[msg.sender] = endBlockHeight;
        claimedVLON[msg.sender] = 0;
        lockedVLON[msg.sender] = amountVLON;
    }

    function getClaimableVLON(address _address) public view returns(uint256) {
        require(lockedVLON[_address] > 0, "Nothing locked");
        require(startHeight[_address] > 0 && startHeight[_address] < endHeight[_address], "Nothing locked");

        uint256 blocksSinceLastClaimed = getUnclaimedBlocks(_address);
        uint256 amountVlonPerBlock = getVLONPerBlock(_address);
        return blocksSinceLastClaimed.mul(amountVlonPerBlock);
    }

    function claimVLON() public nonReentrant {
        require(claimedHeight[msg.sender] < endHeight[msg.sender], "Nothing to claim");

        uint256 claimableVLON = getClaimableVLON(msg.sender);
        require(claimableVLON > 0, "Nothing to claim");

        require(valonToken.transfer(msg.sender, claimableVLON), "Failed to transfer rewards");
        claimedHeight[msg.sender] = block.number;

        if (block.number >= endHeight[msg.sender]) {
            claimedHeight[msg.sender] = endHeight[msg.sender];
        }

        claimedVLON[msg.sender] = claimedVLON[msg.sender].add(claimableVLON);
    }

    function getVLONPerBlock(address _address) public view returns(uint256) {
        require(endHeight[_address] > 0, "Nothing locked");
        require(startHeight[_address] > 0, "Nothing locked");
        require(lockedVLON[_address] > 0, "Nothing locked");

        uint256 totalBlocks = endHeight[_address].sub(startHeight[_address]);
        uint256 amountVlonPerBlock = lockedVLON[_address].div(totalBlocks);
        return amountVlonPerBlock;
    }

    function getUnclaimedBlocks(address _address) public view returns(uint256) {
        uint256 blockHeight = block.number;
        if (block.number >= endHeight[_address]) {
            blockHeight = endHeight[_address];
        }
        return blockHeight.sub(claimedHeight[_address]);
    }

    function getStartHeight(address _address) public view returns(uint256) {
        return startHeight[_address];
    }

    function getEndHeight(address _address) public view returns(uint256) {
        return endHeight[_address];
    }

    function getClaimedHeight(address _address) public view returns(uint256) {
        return claimedHeight[_address];
    }

    function getClaimedVLON(address _address) public view returns(uint256) {
        return claimedVLON[_address];
    }

    function getLockedVLON(address _address) public view returns(uint256) {
        return lockedVLON[_address];
    }

    function getBlockHeight() public view returns(uint256) {
        return block.number;
    }
}