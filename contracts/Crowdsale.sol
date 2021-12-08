pragma solidity 0.8.7;
import { IBEP20 } from './interfaces/IBEP20.sol';
import { SafeBEP20 } from './libs/SafeBEP20.sol';
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import { ValonToken } from './ValonToken.sol';

contract ValonCrowdsale is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    ValonToken public valonToken;
    uint256 private _startBlockHeight;
    uint256 private _endBlockHeight;
    uint256 private _totalSupply;
    uint256 private _totalSold;
    uint256 private _rate;
    bool private _active;

    constructor(
        ValonToken valonTokenAddress,
        uint256 totalSupply,
        uint256 totalSold,
        uint256 timeBlocks,
        uint256 rate
    ) {
        valonToken = valonTokenAddress;
        _totalSupply = totalSupply;
        _totalSold = totalSold;
        _startBlockHeight = block.number;
        _endBlockHeight = block.number.add(timeBlocks);
        _rate = rate;
        _active = true;
    }

    receive() external payable {
        _handlePayment(msg.sender, msg.value);
    }

    function _handlePayment(address sender, uint256 value) private {
        require(value > 0, "BNB value needs to be more than 0");
        require(block.number <= _endBlockHeight, "Sales campaign has already finished");
        require(_totalSold <= _totalSupply, "Sales campaign has been sold out");
        require(_active, "Sales campaign is not active");

        uint256 bnbUsdPrice = _rate.mul(20000000000000000);
        uint256 bnbAmountUSD = (bnbUsdPrice.mul(value)).div(10**18);
        uint256 phasePriceIncrease = (bnbUsdPrice.div(_rate)).div(10);
        uint256 phase = getPhase();
        uint256 currentPrice = (bnbUsdPrice.div(_rate)).add((phasePriceIncrease.mul(phase.sub(1))));
        uint256 receivedAmountValon = bnbAmountUSD.mul(10**18).div(currentPrice);
        uint256 allowance = valonToken.allowance(owner(), address(this));
        require(allowance >= receivedAmountValon, "No allowance from owner");

        _totalSold = _totalSold.add(receivedAmountValon);
        bool transaction = valonToken.transferFrom(owner(), sender, receivedAmountValon);
        require(transaction, "Transaction failed");
    }

    function getPhase() public view returns(uint256) {
        uint256 phaseAmount = _totalSupply.div(10);
        if (_totalSold <= phaseAmount) { return 1; }
        else if (_totalSold > phaseAmount && _totalSold <= phaseAmount.mul(2)) { return 2; }
        else if (_totalSold > phaseAmount.mul(2) && _totalSold <= phaseAmount.mul(3)) { return 3; }
        else if (_totalSold > phaseAmount.mul(3) && _totalSold <= phaseAmount.mul(4)) { return 4; }
        else if (_totalSold > phaseAmount.mul(4) && _totalSold <= phaseAmount.mul(5)) { return 5; }
        else if (_totalSold > phaseAmount.mul(5) && _totalSold <= phaseAmount.mul(6)) { return 6; }
        else if (_totalSold > phaseAmount.mul(6) && _totalSold <= phaseAmount.mul(7)) { return 7; }
        else if (_totalSold > phaseAmount.mul(7) && _totalSold <= phaseAmount.mul(8)) { return 8; }
        else if (_totalSold > phaseAmount.mul(8) && _totalSold <= phaseAmount.mul(9)) { return 9; }
        else { return 10; }
    }

    function getTotalSupply() public view returns(uint256) {
        return _totalSupply;
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
}