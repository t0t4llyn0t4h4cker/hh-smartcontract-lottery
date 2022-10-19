const { assert } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) // will only on dev/local chain
	? describe.skip
	: describe("Lottery", async function () {
			let Lottery, vrfCoordinatorV2Mock
			const chainId = network.config.chainId

			beforeEach(async function () {
				const { deployer } = await getNamedAccounts()
				await deployments.fixture(["all"]) // deploys everything in deploy with tag all
				Lottery = await ethers.getContract("Lottery", deployer)
				vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
			})

			describe("Constructor", async function () {
				it("initializes the lottery correctly", async function () {
					// ideally tests are 1 asset per "it"
					const LotteryState = await Lottery.getLotteryState()
					const interval = await Lottery.getInterval()
					assert.equal(LotteryState.toString(), "0")
					assert.equal(interval.toString(), networkConfig[chainId]["updateInterval"])
				})
			})
	  })
