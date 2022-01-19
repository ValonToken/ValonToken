pragma solidity 0.8.7;
import { IBEP20 } from './interfaces/IBEP20.sol';
import { SafeBEP20 } from './libs/SafeBEP20.sol';
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ValonToken } from './ValonToken.sol';

contract ValonMigrator is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    ValonToken public valonToken;
    ValonToken public valonTokenOld;
    bool private _active = true;
    uint256 private _fee = 50000000000000000; // 0.05bnb
    uint256 private _percentage; // 0 - 100 percentage
    uint256 private _totalMigrated;
    mapping(address => uint256) migratedVLON;
    mapping(address => uint256) claimedVLON;
    mapping(address => bool) blacklist;
    mapping(address => bool) whitelist;
    mapping(address => bool) viplist;

    constructor(
        ValonToken valonTokenAddressOld,
        ValonToken valonTokenAddress
    ) {
        valonTokenOld = valonTokenAddressOld;
        valonToken = valonTokenAddress;
    }

    receive() external payable nonReentrant {
        migrate();
    }

    /*
    *   MIGRATE
    * * * * * * * * * */
    function setVestingPercentage(uint256 percentage) public onlyOwner {
        _percentage = percentage;
    }

    function setFee(uint256 valueWei) public onlyOwner {
        _fee = valueWei;
    }

    function setBlacklisted(address _address, bool value) public onlyOwner {
        blacklist[_address] = value;
    }

    function setWhitelisted(address _address, bool value) public onlyOwner {
        whitelist[_address] = value;
    }

    function setViplisted(address _address, bool value) public onlyOwner {
        viplist[_address] = value;
    }

    function getBlacklisted(address _address) public view returns(bool) {
        return blacklist[_address];
    }

    function getWhitelisted(address _address) public view returns(bool) {
        return whitelist[_address];
    }

    function getViplisted(address _address) public view returns(bool) {
        return viplist[_address];
    }

    function migrate() public payable nonReentrant {
        require(valonTokenOld.balanceOf(msg.sender) > 0, "No VLON Found");
        require(migratedVLON[msg.sender] == 0, "Already migrated");
        require(_active, "Migration has already finished");
        if (!whitelist[msg.sender]) {
            require(msg.value >= _fee, "Fee required");
        }

        uint256 amountVLON = valonTokenOld.balanceOf(msg.sender);
        require(valonTokenOld.transferFrom(msg.sender, owner(), amountVLON), "Transaction failed");
        migratedVLON[msg.sender] = amountVLON;
        _totalMigrated = _totalMigrated.add(amountVLON);
    }

    function claimMigratedVLON() public nonReentrant {
        require(migratedVLON[msg.sender] > 0, "No VLON to migrate");
        require(!blacklist[msg.sender], "Blacklisted for breaking the rules");
        require(_active, "Migration has already finished");
        require(_percentage > 0, "Migration not configured");

        uint256 amountVLON = migratedVLON[msg.sender].div(100).mul(_percentage);
        amountVLON = amountVLON.sub(claimedVLON[msg.sender]);

        if (viplist[msg.sender]) {
            amountVLON = migratedVLON[msg.sender];
        }

        require(amountVLON > 0, "Error migrating");

        claimedVLON[msg.sender] = claimedVLON[msg.sender].add(amountVLON);
        require(valonToken.transferFrom(owner(), msg.sender, amountVLON), "Transaction failed");
    }

    function getMigratedVLON(address _address) public view returns(uint256) {
        return migratedVLON[_address];
    }

    function getClaimedVLON(address _address) public view returns(uint256) {
        return claimedVLON[_address];
    }

    function getTotalMigratedVLON() public view returns(uint256) {
        return _totalMigrated;
    }
}