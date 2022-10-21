const { ethers } = require("hardhat")

async function enterLottery() {
	const lottery = await ethers.getContract("Lottery")
	const entranceFee = await lottery.getEntraceFee()
	await lottery.enterLottery({ value: entranceFee })
	console.log("Entered")
}

enterLottery()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
