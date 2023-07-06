require('dotenv').config();
const express = require('express');
const ethers = require('ethers');
const { WETH9, Token, ChainId, QUOTER_ADDRESSES, Fraction, Percent } = require('@uniswap/sdk-core');
const { FeeAmount } = require('@uniswap/v3-sdk');

const router = express.Router();

const erc20Interface = new ethers.Interface([
	'function decimals() view returns (uint)',
	'function name() view returns (string)',
	'function symbol() view returns (string)',
]);
const quoterInterface = new ethers.Interface([
	'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
]);

const isEthereumAddress = (address) => {
	const regex = /^(0x)?[0-9a-fA-F]{40}$/;
	return regex.test(address);
};

const buyQuoteV3 = async (tokenAddress, feeAmount, inputAmount, slippage_bips) => {
	if (!isEthereumAddress(tokenAddress)) return null;
	if (typeof feeAmount !== 'number') return null;
	if (typeof inputAmount !== 'bigint') return null;
	if (typeof slippage_bips !== 'number') return null;

	if (![FeeAmount.HIGH, FeeAmount.LOW, FeeAmount.LOWEST, FeeAmount.MEDIUM].includes(feeAmount)) return null;
	if (slippage_bips < 0 || slippage_bips > 10_000) return null;

	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const tokenContract = new ethers.Contract(tokenAddress, erc20Interface, provider);

	const tokenDecimals = await tokenContract.decimals().catch(() => 18);

	const weth = WETH9[1];
	const token = new Token(ChainId.MAINNET, tokenAddress, Number(tokenDecimals));

	const quoter = new ethers.Contract(QUOTER_ADDRESSES['1'], quoterInterface, provider);
	const slippageTolerance = new Percent(slippage_bips, '10000');

	const amountOut = (await quoter.quoteExactInputSingle.staticCall(weth.address, token.address, feeAmount, inputAmount.toString(), 0).catch(() => 0n)).toString();
	const amountOutMin = new Fraction('1').add(slippageTolerance).invert().multiply(amountOut.toString()).quotient.toString();
	const path = ethers.solidityPacked(['address', 'uint24', 'address'], [weth.address, feeAmount, token.address]);

	if (amountOut === 0n) return null;

	return {
		amountOut,
		amountOutMin,
		path,
	};
};

const sellQuoteV3 = async (tokenAddress, feeAmount, inputAmount, slippageBips) => {
	if (!isEthereumAddress(tokenAddress)) return null;
	if (typeof feeAmount !== 'number') return null;
	if (typeof inputAmount !== 'bigint') return null;
	if (typeof slippageBips !== 'number') return null;

	if (![FeeAmount.HIGH, FeeAmount.LOW, FeeAmount.LOWEST, FeeAmount.MEDIUM].includes(feeAmount)) return null;
	if (slippageBips < 0 || slippageBips > 10_000) return null;

	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const tokenContract = new ethers.Contract(tokenAddress, erc20Interface, provider);

	const tokenDecimals = await tokenContract.decimals().catch(() => 18);

	const weth = WETH9[1];
	const token = new Token(ChainId.MAINNET, tokenAddress, Number(tokenDecimals));

	const quoter = new ethers.Contract(QUOTER_ADDRESSES['1'], quoterInterface, provider);
	const slippageTolerance = new Percent(slippageBips, '10000');

	const amountOut = (await quoter.quoteExactInputSingle.staticCall(token.address, weth.address, feeAmount, inputAmount.toString(), 0).catch(() => 0n)).toString();
	const amountOutMin = new Fraction('1').add(slippageTolerance).invert().multiply(amountOut.toString()).quotient.toString();
	const path = ethers.solidityPacked(['address', 'uint24', 'address'], [token.address, feeAmount, weth.address]);

	if (amountOut === 0n) return null;

	return {
		amountOut,
		amountOutMin,
		path,
	};
};

router.get('/', async (req, res) => {
	const { address, feeAmount, type, amountIn } = req.query;
	let { slippageBips } = req.query;

	if (typeof slippageBips === 'undefined') slippageBips = '0';

	if (!isEthereumAddress(address)) {
		res.status(200).json({ success: false, result: { error: 'Invalid Ethereum address provided' } });
		return;
	}

	if (type !== 'buy' && type !== 'sell') {
		res.status(200).json({ success: false, result: { error: 'Invalid type provided' } });
		return;
	}

	if (typeof feeAmount === 'undefined') {
		res.status(200).json({ success: false, result: { error: 'feeAmount is required' } });
		return;
	}

	try {
		const feeAmountNumber = Number(feeAmount);
		if (![FeeAmount.HIGH, FeeAmount.LOW, FeeAmount.LOWEST, FeeAmount.MEDIUM].includes(feeAmountNumber)) throw new Error('Invalid feeAmount provided');
	}
	catch {
		res.status(200).json({ success: false, result: { error: 'Invalid feeAmount provided' } });
		return;
	}

	try {
		const amountInBigInt = BigInt(amountIn);
		if (amountInBigInt <= 0n) throw new Error('amountIn <= 0n');
	}
	catch {
		res.status(200).json({ success: false, result: { error: 'Invalid amountIn provided' } });
		return;
	}

	try {
		const slippageBipsNumber = Number(slippageBips);
		if (slippageBipsNumber < 0 || slippageBipsNumber > 10_000) throw new Error('slippageBips < 0 || slippageBips > 100');
	}
	catch {
		res.status(200).json({ success: false, result: { error: 'Invalid slippageBips provided' } });
		return;
	}

	const quote = type == 'buy' ? await buyQuoteV3(address, Number(feeAmount), BigInt(amountIn), Number(slippageBips)) : await sellQuoteV3(address, Number(feeAmount), BigInt(amountIn), Number(slippageBips));

	if (!quote) {
		res.status(200).json({ success: false, result: { error: 'Could not quote this trade!' } });
		return;
	}

	res.status(200).json({ success: true, result: quote });
});

module.exports = router;