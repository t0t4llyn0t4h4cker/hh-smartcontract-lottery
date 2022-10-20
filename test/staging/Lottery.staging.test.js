const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name) // will only on livechain
	? describe.skip
	: describe("Lottery", async () => {
			let Lottery, lotteryEntraceFee, deployer

			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer
				Lottery = await ethers.getContract("Lottery", deployer)
				lotteryEntraceFee = await Lottery.getEntraceFee()
			})

			describe("fulfillRandomWords", async () => {
				it("works with live Chainink Keepers and Chainlink VRF, we get a random winner", async () => {
					// enter raffle
					const startingTimeStamp = await Lottery.getLatestTimeStamp() // uint256
					const accounts = await ethers.getSigners()

					await new Promise(async (resolve, reject) => {
						Lottery.once("WinnerPicked", async () => {
							console.log("WiinerPicked event fired!")
							try {
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
						await Lottery.enterLottery({ value: lotteryEntraceFee })
						const startingWinnerBalance = await accounts[0].getBalance()
						// code WONT complete until listener (.once) has finished
					})
				})
			})
	  })
