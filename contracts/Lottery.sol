// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Lottery__NotEnoughEthEntered();
error Lottery__TransferFailed();
error Lottery__LoterryClosed();
error Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 lotteryState);

/** @title A sample Lottery Contract
 * @author Laurent Mescudi
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink Keepers(Automation)
 * @notice Be on the lookout for Huncho#6869
 */
contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
	/* Type declarations */
	enum LotteryState {
		OPEN,
		CALCULATING
	}

	/* State Variables */
	address payable[] private s_players;
	bytes32 private immutable i_keyHash;
	uint32 private immutable i_callbackGasLimit;
	uint64 private immutable i_subscriptionId;
	uint256 private immutable i_entraceFee;
	uint16 private constant REQUEST_CONFIRMATIONS = 3;
	uint32 private constant NUM_WORDS = 1;
	VRFCoordinatorV2Interface private immutable i_coordinator;

	// Lottery Variables
	address private s_recentWinner;
	LotteryState private s_lotteryState;
	uint256 private s_lastTimeStamp;
	uint256 private immutable i_interval;

	/* Events */
	event LotteryEnter(address indexed player);
	event RequestedLotteryWinner(uint256 indexed requestId);
	event WinnerPicked(address indexed winner);

	/* Functions */
	constructor(
		address vrfCoordinatorV2,
		uint256 entraceFee,
		bytes32 keyHash,
		uint64 subscriptionId,
		uint32 callbackGasLimit,
		uint256 updateInterval
	) VRFConsumerBaseV2(vrfCoordinatorV2) {
		i_entraceFee = entraceFee;
		i_coordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
		i_keyHash = keyHash;
		i_subscriptionId = subscriptionId;
		i_callbackGasLimit = callbackGasLimit;
		s_lotteryState = LotteryState.OPEN;
		s_lastTimeStamp = block.timestamp;
		i_interval = updateInterval;
	}

	function enterLottery() public payable {
		if (msg.value < i_entraceFee) {
			revert Lottery__NotEnoughEthEntered();
		}
		if (s_lotteryState != LotteryState.OPEN) {
			revert Lottery__LoterryClosed();
		}
		s_players.push(payable(msg.sender));

		emit LotteryEnter(msg.sender);
	}

	/**
	 * @dev This is the function that the Chainlink Keeper nodes call
	 * they look for the 'upkeepNeeded' to return true.
	 * Following should be true in order to retuern true:
	 * 1. Our time interval should have passed
	 * 2. Lottery should have at least 1 player and some ETH
	 * 3. our subscrption is funded with LINK
	 * 4. Lottery should be in an "open" state
	 */
	function checkUpkeep(
		bytes memory /* checkData */
	)
		public
		override
		returns (
			bool upkeepNeeded,
			bytes memory /* performData */
		)
	{
		bool isOpen = (LotteryState.OPEN == s_lotteryState);
		bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
		bool hasPlayers = (s_players.length > 0);
		bool hasBalance = address(this).balance > 0;

		upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
	}

	function performUpkeep(
		bytes calldata /* performData */
	) external override {
		(bool upkeepNeeded, ) = checkUpkeep("");
		if (!upkeepNeeded) {
			revert Lottery__UpkeepNotNeeded(
				address(this).balance,
				s_players.length,
				uint256(s_lotteryState)
			);
		}
		s_lotteryState = LotteryState.CALCULATING;
		uint256 requestId = i_coordinator.requestRandomWords(
			i_keyHash,
			i_subscriptionId,
			REQUEST_CONFIRMATIONS,
			i_callbackGasLimit,
			NUM_WORDS
		);
		emit RequestedLotteryWinner(requestId);
	}

	function fulfillRandomWords(
		uint256,
		/* requestId */
		uint256[] memory randomWords
	) internal override {
		uint256 indexOfWinner = randomWords[0] % s_players.length;
		address payable recentWinner = s_players[indexOfWinner];
		s_recentWinner = recentWinner;
		s_lotteryState = LotteryState.OPEN;
		s_players = new address payable[](0);
		s_lastTimeStamp = block.timestamp;
		(bool success, ) = recentWinner.call{value: address(this).balance}("");
		if (!success) {
			revert Lottery__TransferFailed();
		}
		emit WinnerPicked(recentWinner);
	}

	/* View / Pure Function */
	function getEntraceFee() public view returns (uint256) {
		return i_entraceFee;
	}

	function getPlayer(uint256 index) public view returns (address) {
		return s_players[index];
	}

	function getRecentWinner() public view returns (address) {
		return s_recentWinner;
	}

	function getLotteryState() public view returns (LotteryState) {
		return s_lotteryState;
	}

	function getNumWords() public pure returns (uint256) {
		return NUM_WORDS;
	}

	function getNumberOfPlayers() public view returns (uint256) {
		return s_players.length;
	}

	function getLatestTimeStamp() public view returns (uint256) {
		return s_lastTimeStamp;
	}

	function getRequestConfirmations() public pure returns (uint256) {
		return REQUEST_CONFIRMATIONS;
	}

	function getInterval() public view returns (uint256) {
		return i_interval;
	}
}
