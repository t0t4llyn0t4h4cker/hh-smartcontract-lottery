const { assert, expect } = require("chai")
const { network, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name) // will only on livechain
	? describe.skip
	: describe("Lottery Staging Tests", async () => {
			let Lottery, lotteryEntraceFee, deployer

			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer
				Lottery = await ethers.getContract("Lottery", deployer)
				lotteryEntraceFee = await Lottery.getEntraceFee()
			})

			describe("fulfillRandomWords", async () => {
				it("works with live Chainink Keepers and Chainlink VRF, we get a random winner", async () => {
					// enter raffle
					console.log("Crafting test :)")
					const startingTimeStamp = await Lottery.getLatestTimeStamp() // uint256
					const accounts = await ethers.getSigners()

					console.log("Setting up Listener...")
					await new Promise(async (resolve, reject) => {
						// setup listener before we enter lottery
						Lottery.once("WinnerPicked", async () => {
							console.log("WinnerPicked event fired!")
							try {
								// validate asserts here
								const recentWinner = await Lottery.getRecentWinner() // address
								const lotteryState = await Lottery.getLotteryState() // enum
								const endingWinnerBalance = await accounts[0].getBalance() // uint256
								const endingTimeStap = await Lottery.getLatestTimeStamp() // uint256
								// const numPlayers = await Lottery.getNumberofPlayers() // uint256

								await expect(Lottery.getPlayer(0)).to.be.reverted
								assert.equal(recentWinner, accounts[0].address)
								assert.equal(lotteryState.toString(), "0")
								assert.equal(
									endingWinnerBalance.toString(),
									startingWinnerBalance.add(lotteryEntraceFee).toString()
								)
								assert(endingTimeStap > startingTimeStamp)

								resolve() // if try passes, resolves the promise
							} catch (e) {
								console.log(e)
								reject(e) // uf try fails, rejects the promise
							}
						})
						// setup listener before we enterLottery
						// to account for any BLOCK issues
						console.log("Entering Lottery...")
						const tx = await Lottery.enterLottery({ value: lotteryEntraceFee })
						await tx.wait(1)
						console.log("Time to wait for listener to work")
						const startingWinnerBalance = await accounts[0].getBalance()
						// code WONT complete until listener (.once) has finished
					})
				})
			})
	  })
