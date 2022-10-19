const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) // will only on dev/local chain
	? describe.skip
	: describe("Lottery", async function () {
			let Lottery, vrfCoordinatorV2Mock, lotteryEntraceFee, deployer, interval
			const chainId = network.config.chainId

			beforeEach(async function () {
				deployer = (await getNamedAccounts()).deployer
				await deployments.fixture(["all"]) // deploys everything in deploy with tag all
				Lottery = await ethers.getContract("Lottery", deployer)
				vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
				lotteryEntraceFee = await Lottery.getEntraceFee()
				interval = await Lottery.getInterval()
			})

			describe("Constructor", async function () {
				it("initializes the lottery correctly", async function () {
					// ideally tests are 1 asset per "it"
					const LotteryState = await Lottery.getLotteryState()
					assert.equal(LotteryState.toString(), "0")
					assert.equal(interval.toString(), networkConfig[chainId]["updateInterval"])
				})
			})
			describe("enterLottery", async function () {
				it("reverts when you dont pay enough", async function () {
					await expect(Lottery.enterLottery()).to.be.revertedWith(
						"Lottery__NotEnoughEthEntered"
					)
				})
				it("records players when they enter", async function () {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					const response = await Lottery.getPlayer(0)
					assert.equal(response, deployer)
				})
				it("emits event on enter", async function () {
					await expect(Lottery.enterLottery({ value: lotteryEntraceFee }))
						.to.emit(Lottery, "LotteryEnter")
						.withArgs(deployer)
				})
				it("doesnt allow entrance when lottery is calculating", async function () {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
					await network.provider.send("evm_mine", [])
					await Lottery.performUpkeep([]) // empty call data
					await expect(
						Lottery.enterLottery({ value: lotteryEntraceFee })
					).to.be.revertedWith("Lottery__LoterryClosed")
				})
			})
	  })
