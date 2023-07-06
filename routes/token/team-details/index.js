require('dotenv').config();
const { Etherscan } = require('../../../lib/etherscan');
const ethers = require('ethers');
const express = require('express');

const router = express.Router();

router.get('/:address', async (req, res) => {
	const ethereumAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
	const { address } = req.params;

	if (!ethereumAddressRegex.test(address)) {
		res.status(200).json({ success: false, result: { error: 'Invalid Ethereum address provided' } });
		return;
	}

	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const erc20Interface = new ethers.Interface([
		'function balanceOf(address) view returns (uint256)',
		'function decimals() view returns (uint8)',
		'function owner() view returns (address)',
	]);

	const contract = new ethers.Contract(address, erc20Interface, provider);
	const etherscan = new Etherscan(process.env.ETHERSCAN_API_KEY);

	let deployer, owner, token_decimals;
	try {
		const [contractCreation, contractOwner, decimals] = await Promise.all([
			etherscan.contracts.getContractCreation([address]),
			contract.owner().catch(() => null),
			contract.decimals().catch(() => 18),
		]);
		deployer = contractCreation[0]?.contractCreator ?? null;
		owner = contractOwner;
		token_decimals = decimals;
	}
	catch (err) {
		deployer = null;
		owner = null;
	}

	let deployer_holdings, owner_holdings;
	try {
		[deployer_holdings, owner_holdings] = await Promise.all([
			contract.balanceOf(deployer).catch(() => 0n),
			contract.balanceOf(owner).catch(() => 0n),
		]);
	}
	catch (err) {
		deployer_holdings = 0n;
		owner_holdings = 0n;
	}

	deployer_holdings = ethers.formatUnits(deployer_holdings, token_decimals);
	owner_holdings = ethers.formatUnits(owner_holdings, token_decimals);

	const result = {
		deployer,
		deployer_holdings,
		owner,
		owner_holdings,
	};

	res.status(200).json({ success: true, result });
});

module.exports = router;