require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

/** @type import('hardhat/config').HardhatUserConfig */

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

module.exports = {
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			chainId: 31337,
			blockConfirmations: 5,
		},
		goerli: {
			chainId: 5,
			blockConfirmations: 4,
			url: GOERLI_RPC_URL,
			saveDeployments: true,
			accounts: [PRIVATE_KEY],
		},
	},
	solidity: "0.8.8",
	namedAccounts: {
		deployer: {
			default: 0,
		},
		player: {
			default: 1,
		},
	},
	etherscan: { apiKey: ETHERSCAN_API_KEY },
	gasReporter: {
		enabled: false,
		outputFile: "gas-report.txt",
		noColors: true,
		currency: "USD",
		// token: "Matic",
		// coinmarketcap: COINMARKETCAP_API_KEY,
	},
	mocha: {
		timeout: 500000, // 500 seconds max for running tests
	},
}
