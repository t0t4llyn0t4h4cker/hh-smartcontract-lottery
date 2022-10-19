const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("1")

module.exports = async ({ getNamedAccounts, deployments }) => {
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()
	const chainID = network.config.chainId
	let vrfcoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

	if (developmentChains.includes(network.name)) {
		vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
		vrfcoordinatorV2Address = vrfCoordinatorV2Mock.address
		const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
		const transactionReciept = await transactionResponse.wait(1)
		subscriptionId = transactionReciept.events[0].args.subId
		log("Subscription created successfully")
		// fund the sub
		await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
		log("Successfully Funded Subscription")
	} else {
		vrfcoordinatorV2Address = networkConfig[chainID]["vrfCoordinatorV2"]
		subscriptionId = networkConfig[chainID]["subscriptionId"]
	}

	const entranceFee = networkConfig[chainID]["entranceFee"]
	const keyHash = networkConfig[chainID]["keyHash"]
	const callbackGasLimit = networkConfig[chainID]["callbackGasLimit"]
	const updateInterval = networkConfig[chainID]["updateInterval"]

	const args = [
		vrfcoordinatorV2Address,
		entranceFee,
		keyHash,
		subscriptionId,
		callbackGasLimit,
		updateInterval,
	]
	const lottery = await deploy("Lottery", {
		from: deployer,
		args: args,
		log: true,
		waitConfirmations: 1,
	})
	if (developmentChains.includes(network.name)) {
		log("Local network detected, Consumer added to vrfCoordinatorV2Mock")
		await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address)
	}
	log(`Lottery deployed at ${lottery.address}`)

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await verify(lottery.address, args)
	}

	log("---------------------------------------------------------------------")
}
module.exports.tags = ["all", "deploy"]
