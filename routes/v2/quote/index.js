require('dotenv').config();
const express = require('express');
const ethers = require('ethers');
const { ChainId, Token, WETH9, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { Trade, Route, Pair } = require('@uniswap/v2-sdk');

const router = express.Router();

const isEthereumAddress = (address) => {
	const regex = /^(0x)?[0-9a-fA-F]{40}$/;
	return regex.test(address);
};

const buyQuoteV2 = async (tokenAddress, inputAmount, slippageBips) => {
	if (!isEthereumAddress(tokenAddress)) return null;
	if (typeof inputAmount !== 'bigint') return null;
	if (typeof slippageBips !== 'number') return null;

	const erc20Interface = new ethers.Interface([
		'function decimals() view returns (uint)',
		'function name() view returns (string)',
		'function symbol() view returns (string)',
	]);
	const pairInterface = new ethers.Interface([
		'function getReserves() view returns (uint reserves0, uint reserves1, uint timestamp)',
	]);

	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const tokenContract = new ethers.Contract(tokenAddress, erc20Interface, provider);

	const [tokenDecimals, tokenName, tokenSymbol] = await Promise.all([
		await tokenContract.decimals().catch(() => 18),
		await tokenContract.name().catch(() => '<Unnamed Token>'),
		await tokenContract.symbol().catch(() => '<NONE>'),
	]);

	const weth = WETH9[1];
	const token = new Token(ChainId.MAINNET, tokenAddress, Number(tokenDecimals), tokenSymbol, tokenName);

	const pairAddress = Pair.getAddress(weth, token);
	const pairContract = new ethers.Contract(pairAddress, pairInterface, provider);

	const [reserve0, reserve1] = await pairContract.getReserves().catch(() => [0n, 0n, 0n]);
	if (reserve0 === 0n && reserve1 === 0n) return null;
	const token0 = new Pair(CurrencyAmount.fromRawAmount(weth, 1), CurrencyAmount.fromRawAmount(token, 1)).token0;
	const token1 = new Pair(CurrencyAmount.fromRawAmount(weth, 1), CurrencyAmount.fromRawAmount(token, 1)).token1;

	const pair = new Pair(CurrencyAmount.fromRawAmount(token0, reserve0.toString()), CurrencyAmount.fromRawAmount(token1, reserve1.toString()));
	const route = new Route([pair], weth, token);
	const slippage = new Percent(slippageBips.toString(), '10000');

	let trade;
	try {
		trade = new Trade(route, CurrencyAmount.fromRawAmount(weth, inputAmount.toString()), TradeType.EXACT_INPUT);
	}
	catch (err) {
		if (err.toString() === 'InsufficientInputAmountError') return null;
		console.error('v2/quote::buyQuoteV2 - Unexpected error when quoting trade:');
		console.error(err);
		return null;
	}

	const amountOut = ethers.parseUnits(trade.outputAmount.toExact(), token.decimals).toString();
	const amountOutMin = ethers.parseUnits(trade.minimumAmountOut(slippage).toExact(), token.decimals).toString();
	const path = [weth.address, token.address];

	return {
		amountOut,
		amountOutMin,
		path,
	};
};

const sellQuoteV2 = async (tokenAddress, inputAmount, slippageBips) => {
	if (!isEthereumAddress(tokenAddress)) return null;
	if (typeof inputAmount !== 'bigint') return null;
	if (typeof slippageBips !== 'number') return null;

	const erc20Interface = new ethers.Interface([
		'function decimals() view returns (uint)',
		'function name() view returns (string)',
		'function symbol() view returns (string)',
	]);
	const pairInterface = new ethers.Interface([
		'function getReserves() view returns (uint reserves0, uint reserves1, uint timestamp)',
	]);

	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const tokenContract = new ethers.Contract(tokenAddress, erc20Interface, provider);

	const [tokenDecimals, tokenName, tokenSymbol] = await Promise.all([
		await tokenContract.decimals().catch(() => 18),
		await tokenContract.name().catch(() => '<Unnamed Token>'),
		await tokenContract.symbol().catch(() => '<NONE>'),
	]);

	const weth = WETH9[1];
	const token = new Token(ChainId.MAINNET, tokenAddress, Number(tokenDecimals), tokenSymbol, tokenName);

	const pairAddress = Pair.getAddress(weth, token);
	const pairContract = new ethers.Contract(pairAddress, pairInterface, provider);

	const [reserve0, reserve1] = await pairContract.getReserves().catch(() => [0n, 0n, 0n]);
	if (reserve0 === 0n && reserve1 === 0n) return null;

	const token0 = new Pair(CurrencyAmount.fromRawAmount(weth, 1), CurrencyAmount.fromRawAmount(token, 1)).token0;
	const token1 = new Pair(CurrencyAmount.fromRawAmount(weth, 1), CurrencyAmount.fromRawAmount(token, 1)).token1;

	const pair = new Pair(CurrencyAmount.fromRawAmount(token0, reserve0.toString()), CurrencyAmount.fromRawAmount(token1, reserve1.toString()));
	const route = new Route([pair], token, weth);
	const slippage = new Percent(slippageBips.toString(), '10000');

	let trade;
	try {
		trade = new Trade(route, CurrencyAmount.fromRawAmount(token, inputAmount.toString()), TradeType.EXACT_INPUT);
	}
	catch (err) {
		if (err.toString() === 'InsufficientInputAmountError') return null;
		console.error('v2/quote::sellQuoteV2 - Unexpected error when quoting trade:');
		console.error(err);
		return null;
	}

	const amountOut = ethers.parseUnits(trade.outputAmount.toExact(), weth.decimals).toString();
	const amountOutMin = ethers.parseUnits(trade.minimumAmountOut(slippage).toExact(), weth.decimals).toString();
	const path = [token.address, weth.address];

	return {
		amountOut,
		amountOutMin,
		path,
	};
};

router.get('/', async (req, res) => {
	const { address, type, amountIn } = req.query;
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

	const quote = type == 'buy' ? await buyQuoteV2(address, BigInt(amountIn), Number(slippageBips)) : await sellQuoteV2(address, BigInt(amountIn), Number(slippageBips));

	if (!quote) {
		res.status(200).json({ success: false, result: { error: 'Could not quote this trade!' } });
		return;
	}

	res.status(200).json({ success: true, result: quote });
});

module.exports = router;