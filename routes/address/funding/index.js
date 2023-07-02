require('dotenv').config();
const { Alchemy, Network, AssetTransfersCategory, SortingOrder } = require('alchemy-sdk');
const express = require('express');

const router = express.Router();

router.get('/:address', async (req, res) => {
	const ethereumAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
	const { address } = req.params;

	if (!ethereumAddressRegex.test(address)) {
		res.status(200).json({ success: false, result: { error: 'Invalid Ethereum address provided' } });
		return;
	}

	const alchemy = new Alchemy({
		apiKey: process.env.ALCHEMY_API_KEY,
		network: Network.ETH_MAINNET,
	});

	let funding = [];

	try {
		const transfers = (await alchemy.core.getAssetTransfers({
			fromBlock: '0x0',
			toBlock: 'latest',
			category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL],
			withMetadata: true,
			excludeZeroValue: true,
			maxCount: 10,
			toAddress: address,
			order: SortingOrder.ASCENDING,
		})).transfers;

		funding = transfers.map(transfer => {
			return {
				from: transfer.from,
				time: new Date(transfer.metadata.blockTimestamp),
				value: transfer.value,
			};
		});
	}
	catch (err) {
		console.error(err);
		res.status(200).json({ success: false, result: { error: 'Could not get eth transfers for this address' } });
		return;
	}

	res.status(200).json({ success: true, result: funding });
});

module.exports = router;