pragma solidity 0.8.7;
import { IBEP20 } from './interfaces/IBEP20.sol';
import { SafeBEP20 } from './libs/SafeBEP20.sol';
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ValonToken } from './ValonToken.sol';

contract ValonIDO is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    ValonToken public valonToken;
    uint256 private _startBlockHeight;
    uint256 private _endBlockHeight;
    uint256 private _totalSupply;
    uint256 private _totalSold;
    uint256 private _rate;
    uint256 private _minimum;
    uint256 private _maximum;
    uint256 private _priceVLON;
    uint256 private _totalClaimed;
    bool private _allowClaiming;
    bool private _active;
    mapping(address => uint256) reservedVLON;
    mapping(address => uint256) reservedBNB;

    //migrate
    bool private _migrationActive = true;
    ValonToken public valonTokenOld;
    uint256 private _migrateFee = 50000000000000000; // 0.05bnb
    uint256 private _migratePercentage; // 0 - 100 percentage
    uint256 private _totalMigrated;
    mapping(address => uint256) migratedVLON;
    mapping(address => uint256) migrateClaimedVLON;
    mapping(address => bool) migrateBlacklist;

    //vault
    mapping(address => uint256) lockedVLON;
    mapping(address => uint256) lockStartHeight;
    mapping(address => uint256) lockClaimedHeight;
    mapping(address => uint256) lockEndHeight;
    mapping(address => uint256) lockClaimedVLON;

    constructor(
        ValonToken valonTokenAddressOld,
        ValonToken valonTokenAddress,
        uint256 totalSupply,
        uint256 totalSold,
        uint256 timeBlocks,
        uint256 rate,
        uint256 min,
        uint256 max
    ) {
        valonTokenOld = valonTokenAddressOld;
        valonToken = valonTokenAddress;
        _totalSupply = totalSupply;
        _totalSold = totalSold;
        _startBlockHeight = block.number;
        _endBlockHeight = block.number.add(timeBlocks);
        _rate = rate;
        _active = true;
        _minimum = min;
        _maximum = max;
        _allowClaiming = false;
    }

    receive() external payable nonReentrant {
        _handlePayment(msg.sender, msg.value);
    }

    function _handlePayment(address sender, uint256 value) private {
        require(value > 0, "BNB value needs to be more than 0");
        require(value >= _minimum, "BNB value needs to be more than minimum");
        require(value <= _maximum, "BNB value needs to be less than maximum");
        require(reservedBNB[sender].add(value) <= _maximum, "BNB total value needs to be less than maximum");
        require(block.number <= _endBlockHeight, "Sales campaign has already finished");
        require(_totalSold <= _totalSupply, "Sales campaign has been sold out");
        require(_active, "Sales campaign is not active");

        uint256 bnbUsdPrice = _rate.mul(20000000000000000);
        uint256 bnbAmountUSD = (bnbUsdPrice.mul(value)).div(10**18);
        uint256 currentPrice = bnbUsdPrice.div(_rate);
        uint256 receivedAmountValon = bnbAmountUSD.mul(10**18).div(currentPrice);
        reservedVLON[sender] = reservedVLON[sender].add(receivedAmountValon);
        reservedBNB[sender] = reservedBNB[sender].add(value);
        _totalSold = _totalSold.add(receivedAmountValon);
    }

    function claimVLON() public nonReentrant {
        require(_allowClaiming && !_active, "Not allowed to claim yet");
        require(reservedVLON[msg.sender] > 0, "No VLON Reserved For User");

        uint256 amountVLON = reservedVLON[msg.sender];
        reservedVLON[msg.sender] = 0;
        require(valonToken.transferFrom(owner(), msg.sender, amountVLON), "Transaction failed");
        _totalClaimed = _totalClaimed.add(amountVLON);
    }

    function getReservedVLON(address _address) public view returns(uint256) {
        return reservedVLON[_address];
    }

    function getReservedBNB(address _address) public view returns(uint256) {
        return reservedBNB[_address];
    }

    function getTotalSupply() public view returns(uint256) {
        return _totalSupply;
    }

    function getTotalClaimed() public view returns(uint256) {
        return _totalClaimed;
    }

    function getStartBlockHeight() public view returns(uint256) {
        return _startBlockHeight;
    }

    function getEndBlockHeight() public view returns(uint256) {
        return _endBlockHeight;
    }

    function getTotalSold() public view returns(uint256) {
        return _totalSold;
    }

    function getRate() public view returns(uint256) {
        return _rate;
    }

    function getActive() public view returns(bool) {
        return _active;
    }

    function getBlockHeight() public view returns(uint256) {
        return block.number;
    }

    function getBnbBalance() public view returns(uint256) {
        return address(this).balance;
    }

    /*
    *   ADMIN
    * * * * * * * * * */
    function setClaimable(bool allowClaim) public onlyOwner {
        _allowClaiming = allowClaim;
    }

    function setRate(uint256 rate) public onlyOwner {
        _rate = rate;
    }

    function setEndBlockHeight(uint256 endBlockHeight) public onlyOwner {
        _endBlockHeight = endBlockHeight;
    }

    function setActive(bool active) public onlyOwner {
        _active = active;
    }

    function withdrawBNB(uint256 amount) public onlyOwner {
        (bool succeed, /*bytes memory data*/) = owner().call{value: amount}("");
        require(succeed, "Failed to withdraw Ether");
    }

    function reset(uint256 totalSupply, uint256 totalSold, uint256 timeBlocks, uint256 rate) public onlyOwner {
        _totalSupply = totalSupply;
        _totalSold = totalSold;
        _startBlockHeight = block.number;
        _endBlockHeight = block.number.add(timeBlocks);
        _rate = rate;
        _totalSold = 0;
        _active = true;
    }

    /*
    *   MIGRATE
    * * * * * * * * * */
    function setMigrateVestingPercentage(uint256 percentage) public onlyOwner {
        _migratePercentage = percentage;
    }

    function migrate() public payable nonReentrant {
        require(valonTokenOld.balanceOf(msg.sender) > 0, "No VLON Found");
        require(migratedVLON[msg.sender] == 0, "Already migrated");
        require(msg.value >= _migrateFee, "Fee required");
        require(_migrationActive, "Migration has already finished");

        uint256 amountVLON = valonTokenOld.balanceOf(msg.sender);
        require(valonTokenOld.transferFrom(msg.sender, owner(), amountVLON), "Transaction failed");
        migratedVLON[msg.sender] = amountVLON;
        _totalMigrated = _totalMigrated.add(amountVLON);
    }

    function claimMigratedVLON() public nonReentrant {
        require(migratedVLON[msg.sender] > 0, "No VLON to migrate");
        require(!migrateBlacklist[msg.sender], "Blacklisted for breaking the rules");
        require(_migrationActive, "Migration has already finished");
        require(_migratePercentage > 0, "Migration not configured");

        uint256 amountVLON = migratedVLON[msg.sender].div(100).mul(_migratePercentage);
        amountVLON = amountVLON.sub(migrateClaimedVLON[msg.sender]);
        require(amountVLON > 0, "Error migrating");

        migrateClaimedVLON[msg.sender] = migrateClaimedVLON[msg.sender].add(amountVLON);
        require(valonToken.transferFrom(owner(), msg.sender, amountVLON), "Transaction failed");
    }

    function getMigratedVLON(address _address) public view returns(uint256) {
        return migratedVLON[_address];
    }

    function getMigrateClaimedVLON(address _address) public view returns(uint256) {
        return migrateClaimedVLON[_address];
    }

    function getTotalMigratedVLON() public view returns(uint256) {
        return _totalMigrated;
    }

    /*
    *   LOCK
    * * * * * * * * * */
    function lockVLON(uint256 endBlockHeight, uint256 amountVLON) public onlyOwner {
        require(lockedVLON[msg.sender] == 0, "Already locked");
        require(valonToken.transferFrom(msg.sender, owner(), amountVLON), "Transaction failed");

        lockStartHeight[msg.sender] = block.number;
        lockClaimedHeight[msg.sender] = block.number;
        lockEndHeight[msg.sender] = endBlockHeight;
        lockClaimedVLON[msg.sender] = 0;
        lockedVLON[msg.sender] = amountVLON;
    }

    function getLockClaimableVLON(address _address) public view returns(uint256) {
        require(lockedVLON[_address] > 0, "Nothing locked");
        require(lockStartHeight[_address] > 0 && lockStartHeight[_address] < lockEndHeight[_address], "Nothing locked");

        uint256 totalBlocks = lockEndHeight[_address].sub(lockStartHeight[_address]);
        uint256 blocksSinceLastClaimed = block.number.sub(lockClaimedHeight[_address]);
        uint256 amountVlonPerBlock = lockedVLON[_address].div(totalBlocks);
        return blocksSinceLastClaimed.mul(amountVlonPerBlock);
    }
}