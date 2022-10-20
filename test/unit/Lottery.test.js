const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) // will only on dev/local chain
	? describe.skip
	: describe("Lottery", async () => {
			let Lottery, vrfCoordinatorV2Mock, lotteryEntraceFee, deployer, interval
			const chainId = network.config.chainId

			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer
				await deployments.fixture(["all"]) // deploys everything in deploy with tag all
				Lottery = await ethers.getContract("Lottery", deployer)
				vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
				lotteryEntraceFee = await Lottery.getEntraceFee()
				interval = await Lottery.getInterval()
			})

			describe("Constructor", async () => {
				it("initializes the lottery correctly", async () => {
					// ideally tests are 1 asset per "it"
					const LotteryState = await Lottery.getLotteryState()
					assert.equal(LotteryState.toString(), "0")
					assert.equal(interval.toString(), networkConfig[chainId]["updateInterval"])
				})
			})
			describe("enterLottery", async () => {
				it("reverts when you dont pay enough", async function () {
					await expect(Lottery.enterLottery()).to.be.revertedWith(
						"Lottery__NotEnoughEthEntered"
					)
				})
				it("records players when they enter", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					const response = await Lottery.getPlayer(0)
					assert.equal(response, deployer)
				})
				it("emits event on enter", async () => {
					await expect(Lottery.enterLottery({ value: lotteryEntraceFee }))
						.to.emit(Lottery, "LotteryEnter")
						.withArgs(deployer)
				})
				it("doesnt allow entrance when lottery is calculating", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
					await network.provider.send("evm_mine", [])
					await Lottery.performUpkeep([]) // empty call data
					await expect(
						Lottery.enterLottery({ value: lotteryEntraceFee })
					).to.be.revertedWith("Lottery__LoterryClosed")
				})
			})
			describe("checkUpkeep", async () => {
				it("returns false if people havent sent any ETH", async () => {
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
					await network.provider.send("evm_mine", [])
					const bal = await Lottery.provider.getBalance(Lottery.address)
					const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
					assert(!upkeepNeeded)
					assert.equal(0, bal)
				})
				it("returns false if the lottery is calculating", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 3])
					await network.provider.send("evm_mine", [])
					await Lottery.performUpkeep("0x") // another way to send black bytes object
					const lotteryState = await Lottery.getLotteryState()
					const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep("0x")
					assert.equal(lotteryState.toString() == "1", upkeepNeeded == false)
				})
				it("returns false if enough time hasnt passed", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() - 5])
					await network.provider.send("evm_mine", [])
					const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep("0x")
					assert(!upkeepNeeded)
				})

				it("returns true if enough time has passed, has players, eth, and is open", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 6])
					await network.provider.send("evm_mine", [])
					const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep("0x")
					assert(upkeepNeeded)
				})
			})
			describe("performUpkeep", async () => {
				it("it can only run if checkupkeep is true", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 6])
					await network.provider.send("evm_mine", [])
					const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep("0x")
					const response = await Lottery.performUpkeep("0x")
					assert(upkeepNeeded) // true
					assert(response)
				})
				it("reverts when checkupkeep is false", async () => {
					const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep("0x")
					assert(!upkeepNeeded) // false
					await expect(Lottery.performUpkeep("0x")).to.be.revertedWith(
						"Lottery__UpkeepNotNeeded"
					)
				})
				it("updates the raffle state and emits a requestId personal", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 6])
					await network.provider.send("evm_mine", [])

					await expect(Lottery.performUpkeep("0x")).to.emit(
						Lottery,
						"RequestedLotteryWinner"
					)
					const lotteryState = await Lottery.getLotteryState()

					assert.equal(lotteryState.toString(), "1")
				})
				it("updates the raffle state and emits a requestId", async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
					await network.provider.send("evm_mine", [])

					const tx = await Lottery.performUpkeep("0x")
					const txReciept = await tx.wait(1)
					const lotteryState = await Lottery.getLotteryState()
					const requestId = txReciept.events[1].args.requestId

					assert.equal(lotteryState.toString(), "1")
					assert(requestId.toNumber() > 0)
				})
			})
			describe("fulfillRandomWords", async () => {
				beforeEach(async () => {
					await Lottery.enterLottery({ value: lotteryEntraceFee })
					await network.provider.send("evm_increaseTime", [interval.toNumber() + 3])
					await network.provider.send("evm_mine", [])
				})
				it("can only be called after performUpkeep", async () => {
					await expect(
						vrfCoordinatorV2Mock.fulfillRandomWords(0, Lottery.address)
					).to.be.revertedWith("nonexistent request")
					await expect(
						vrfCoordinatorV2Mock.fulfillRandomWords(1, Lottery.address)
					).to.be.revertedWith("nonexistent request")
				})
				it("picks a winner, resets the lottery, and sends money", async () => {
					const additionalEntrants = 3 // 3 more players will be simulated
					const startingAccountIndex = 1 // since deployer is at 0
					const accounts = await ethers.getSigners() // gets hh generated accounts
					for (
						let i = startingAccountIndex;
						i < startingAccountIndex + additionalEntrants;
						i++
					) {
						let accountConnectedLottery = Lottery.connect(accounts[i])
						await accountConnectedLottery.enterLottery({ value: lotteryEntraceFee })
					}
					const startingTimeStamp = await Lottery.getLatestTimeStamp()

					// performUpkeep (mock being on Chainlink Keeper)
					// fulfillRandomWords (mock being the Chainlink VRF)
					// We will have to wait for the fulfillRandomWords to be called on test/mainnet
					// setting up listener using .once
					await new Promise(async (resolve, reject) => {
						Lottery.once("WinnerPicked", async () => {
							console.log("WiinerPicked event fired!")
							try {
								// Grab ending values that were updated
								const recentWinner = await Lottery.getRecentWinner() // address
								const lotteryState = await Lottery.getLotteryState() // enum
								// const winnerBalance = await Lottery.provider.getBalance(
								// 	recentWinner
								// ) // uint256
								const endingWinnerBalance = await accounts[1].getBalance() //uint256
								const endingTimeStap = await Lottery.getLatestTimeStamp() // uint256
								const numPlayers = await Lottery.getNumberOfPlayers() //uint256
								await expect(Lottery.getPlayer(0)).to.be.reverted
								assert.equal(numPlayers, 0)
								assert.equal(lotteryState.toString(), "0")
								assert(endingTimeStap > startingTimeStamp)

								assert.equal(
									endingWinnerBalance.toString(),
									startingWinnerBalance.add(
										lotteryEntraceFee
											.mul(additionalEntrants)
											.add(lotteryEntraceFee)
											.toString()
									)
								)
								resolve() // if try passes, resolves the promise
							} catch (e) {
								reject(e) // if try fails, rejects the promise
							}
						})
						// kicking off the event by mocking the chainlink keepers and vrf coordinator
						// run scenario to fire event here within Promise; variable scope
						const tx = await Lottery.performUpkeep("0x") // sim Chainlink keeper here
						const txReciept = await tx.wait(1)
						const startingWinnerBalance = await accounts[1].getBalance()
						await vrfCoordinatorV2Mock.fulfillRandomWords(
							// cant sim vrf on livenet, call Mock
							txReciept.events[1].args.requestId,
							Lottery.address
						) // listener picks up here
					})
				})
			})
	  })
