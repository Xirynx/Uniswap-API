require('dotenv').config();
const express = require('express');
const ethers = require('ethers');
const fetch = require('node-fetch');
const UniswapV3PairABI = require('../../../lib/abi/UniswapV3Pair.json');

const router = express.Router();

const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const getSourceCode = async (address) => {
	try {
		const etherscan_url = `https://api.etherscan.io/api?apikey=${process.env.ETHERSCAN_API_KEY}`;
		const req = await fetch(etherscan_url + `&module=contract&action=getsourcecode&address=${address}`);
		const res = await req.json();
		const code = res.result[0].SourceCode;
		if (!code) return null;
		return code;
	}
	catch (err) {
		console.error('pair-details::getSourceCode - Error retrieving source code from etherscan:');
		console.error(err);
		return null;
	}
};

const getTokenData = async (address) => {
	try {
		const qeuryString = `query($address: String!) {
			getTokenInfo(address: $address, networkId: 1) {
				circulatingSupply
				isScam
				links {
					discord
					email
					facebook
					github
					instagram
					linkedin
					reddit
					slack
					telegram
					twitch
					twitter
					website
					wechat
					whitepaper
					youtube
				}
			}
		}`;

		const res = await fetch('https://api.defined.fi', {
			body: JSON.stringify({
				query: qeuryString,
				variables: {
					address: address,
				},
			}),
			headers: {
				'Content-Type': 'application/json',
				'X-Api-Key': process.env.DEFINED_API_KEY,
			},
			method: 'POST',
		});

		const { data: { getTokenInfo } } = await res.json();
		const links = Object.values(getTokenInfo.links ?? {}).filter(link => link);
		const isScam = getTokenInfo.isScam === true;
		const circulatingSupply = Number(getTokenInfo.circulatingSupply);

		return {
			links,
			isScam,
			circulatingSupply,
		};
	}
	catch (err) {
		console.error(err);
		return {
			links: [],
			isScam: null,
			circulatingSupply: null,
		};
	}
};

const getTokenPrice = async (address) => {
	try {
		const qeuryString = `query($address: String!) {
			getTokenPrices(
				inputs: [
					{ address: $address, networkId: 1 }
				]
			) {
				priceUsd
			}
		}`;

		const res = await fetch('https://api.defined.fi', {
			body: JSON.stringify({
				query: qeuryString,
				variables: {
					address: address,
				},
			}),
			headers: {
				'Content-Type': 'application/json',
				'X-Api-Key': process.env.DEFINED_API_KEY,
			},
			method: 'POST',
		});

		const { data: { getTokenPrices: [ { priceUsd } ] } } = await res.json();
		return Number(priceUsd);
	}
	catch {
		return null;
	}
};

// const getFirstSync = async (pairAddress, fromBlock = 0, toBlock = 'latest') => {
const getFirstSync = async () => {
	// try {
	// 	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	// 	const logs = await provider.getLogs({
	// 		address: WETH_ADDRESS,
	// 		topics: [
	// 			'0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
	// 			[null],
	// 			ethers.toBeHex(pairAddress, 32),
	// 		],
	// 		fromBlock: fromBlock,
	// 		toBlock: toBlock,
	// 	});
	// 	// Sort the logs array by block number in ascending order
	// 	logs.sort((a, b) => a.blockNumber - b.blockNumber);
	// 	console.log(logs);
	// 	const firstLog = logs[0];
	// 	console.log(firstLog);
	// 	const [, , value] = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']).parseLog(firstLog).args;
	// 	return value;
	// }
	// catch (err) {
	// 	console.log(err);
	// 	const message = err?.error?.message;
	// 	if (!message) return null;
	// 	// Check if message contains block range, then extract the two values
	// 	const blockRangeRegex = /\[([^\s,]+),\s+([^\s\]]+)\]/;
	// 	const matches = message.match(blockRangeRegex);
	// 	if (!matches) return null;
	// 	const fromBlockValue = matches[1];
	// 	const toBlockValue = matches[2];
	// 	console.log('Reaches', fromBlockValue, toBlockValue);
	// 	const res = await getFirstSync(pairAddress, fromBlockValue, toBlockValue);
	// 	return res;
	// }
	return { reserve0: 0, reserve1: 0 };
};

// const getLiquidity = async (pairAddress) => {
// 	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
// 	const erc20Interface = new ethers.Interface([
// 		'function balanceOf(address) view returns (uint256)',
// 	]);
// 	const contract = new ethers.Contract(WETH_ADDRESS, erc20Interface, provider);
// 	const liquidity = Number(ethers.formatEther(await contract.balanceOf(pairAddress)));
// 	if (typeof liquidity === 'number' && !isNaN(liquidity)) return liquidity;
// 	else return null;
// };

const getEtherPrice = async () => {
	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const interface = new ethers.Interface([
		'function decimals() external view returns (uint8)',
		'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
	]);
	try {
		const CHAINLINK_ORACLE = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
		const contract = new ethers.Contract(CHAINLINK_ORACLE, interface, provider);
		const [decimals, latestRoundData] = await Promise.all([
			contract.decimals(),
			contract.latestRoundData(),
		]);
		const latestAnswer = latestRoundData.answer;
		const price = Number(ethers.formatUnits(latestAnswer, decimals));
		if (typeof price === 'number' && !isNaN(price)) return price;
		return null;
	}
	catch {
		return null;
	}
};

const honeypotis = async (pairAddress) => {
	const res = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${pairAddress}&chainID=1`);
	return await res.json();
};

// const dextools = async (pairAddress) => {
// 	const res = await fetch(`https://www.dextools.io/shared/data/pair?address=${pairAddress.toLowerCase()}&chain=ether`);
// 	const json = await res.json();
// 	if (json.data) {
// 		const price = json.data?.[0].price ?? null;
// 		const metrics = json.data?.[0].metrics ?? null;
// 		const holders = json.data?.[0]?.token?.metrics?.holders ?? null;
// 		let links = json.data?.[0].token.links ?? null;
// 		if (links) {
// 			links = Object.values(links).filter(link => link !== '');
// 		}
// 		else {
// 			links = [];
// 		}
// 		return {
// 			price,
// 			metrics,
// 			holders,
// 			links,
// 		};
// 	}
// 	else {
// 		return {
// 			price: null,
// 			metrics: null,
// 			holders: null,
// 			links: [],
// 		};
// 	}
// };

const defined = async (tokenAddress) => {
	const [
		price,
		data,
		holders,
	] = await Promise.all([
		getTokenPrice(tokenAddress).catch(() => null),
		getTokenData(tokenAddress).catch(() => null),
		null,
	]);

	return {
		price,
		holders,
		links: data?.links ?? [],
	};
};

const findLinksFromSourceCode = (code) => {
	if (!code) return [];
	code = code.replaceAll('\\n', ' ');
	const matches = code.match(/https?:\/\/[^\s]+/g);
	if (matches == null) return [];
	const filteredMatches = matches.filter(match => {
		const filteredLinks = [
			'github.com/ethereum',
			'github.com/OpenZeppelin',
			'readthedocs.io',
			'consensys.net',
			'ethereum.org',
			'openzeppelin.com',
			'forum.zeppelin.solutions',
			'github.com/oraclize',
			'docs.ethers.io',
			'ethereum.github.io',
			'eth.wiki',
			'docs.metamask.io',
			'hardhat.org',
		];
		for (const filteredLink of filteredLinks) {
			if (match.includes(filteredLink)) return false;
		}
		return true;
	});
	return filteredMatches;
};

async function getSwapLogs(pairAddress, fromBlock, toBlock) {
	if (fromBlock > toBlock) return [];
	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const interface = new ethers.Interface([
		'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)',
	]);
	const contract = new ethers.Contract(pairAddress, interface, provider);
	try {
		return await contract.queryFilter('Swap', fromBlock, toBlock);
	}
	catch (err) {
		console.log(err);
		if (err.error.code === -32602) {
			const midBlock = (fromBlock + toBlock) >> 1;
			const [logsLeft, logsRight] = await Promise.all([
				getSwapLogs(pairAddress, fromBlock, midBlock),
				getSwapLogs(pairAddress, midBlock + 1, toBlock),
			]);
			return [...logsLeft, ...logsRight];
		}
		else {
			return [];
		}
	}
}

const countSwapsfromLogs = (swapLogs, token0) => {
	let buys = 0;
	let sells = 0;
	let numToken0Out = 0;
	let numToken1Out = 0;

	swapLogs.forEach(log => {
		if (log.args[2] < 0n && log.args[3] > 0n) numToken0Out++;
		if (log.args[3] < 0n && log.args[2] > 0n) numToken1Out++;
	});

	const wethIsToken0 = ethers.getAddress(token0) === ethers.getAddress(WETH_ADDRESS);

	buys = wethIsToken0 ? numToken1Out : numToken0Out;
	sells = wethIsToken0 ? numToken0Out : numToken1Out;

	return { buys, sells };
};

router.get('/:address', async (req, res) => {
	const ethereumAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
	const { address } = req.params;
	const { count_trades } = req.query;

	if (!ethereumAddressRegex.test(address)) {
		res.status(200).json({ success: false, result: { error: 'Invalid Ethereum address provided' } });
		return;
	}

	const erc20Interface = new ethers.Interface([
		'function name() view returns (string)',
		'function symbol() view returns (string)',
		'function decimals() view returns (uint)',
		'function totalSupply() view returns (uint)',
		'function owner() view returns (address)',
		'function balanceOf(address) view returns (uint)',
	]);

	const provider = new ethers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY);
	const pairContract = new ethers.Contract(address, UniswapV3PairABI, provider);
	const wethContract = new ethers.Contract(WETH_ADDRESS, erc20Interface, provider);

	let pairDetails;
	try {
		pairDetails = await Promise.all([
			pairContract.token0(),
			pairContract.token1(),
			wethContract.balanceOf(await pairContract.getAddress()),
			pairContract.fee(),
			provider.getBlockNumber(),
		]);
	}
	catch (err) {
		console.error(err);
		res.status(200).json({ success: false, result: { error: 'Address does not correspond to existing pair on Uniswap V3' } });
		return;
	}

	const [address0, address1, pooled_eth_bigint, pool_fee_bigint, blockNumber] = pairDetails;

	if (address0.toLowerCase() !== WETH_ADDRESS.toLowerCase() && address1.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
		res.status(200).json({ success: false, result: { error: 'At least one token in pair must be wrapped ether' } });
		return;
	}

	let tokenAddress;
	if (address0.toLowerCase() === WETH_ADDRESS.toLowerCase()) tokenAddress = address1;
	else tokenAddress = address0;

	const erc20Contract = new ethers.Contract(tokenAddress, erc20Interface, provider);

	let honeypotisData, definedData, sourceCode, locks, swapLogs, token_name, token_symbol, token_decimals_bigint, token_total_supply_bigint, owner, firstSync, etherPrice;
	try {
		[
			honeypotisData,
			definedData,
			sourceCode,
			locks,
			swapLogs,
			token_name,
			token_symbol,
			token_decimals_bigint,
			token_total_supply_bigint,
			owner,
			firstSync,
			etherPrice,
		] = await Promise.all([
			honeypotis(tokenAddress, await pairContract.getAddress()),
			defined(tokenAddress),
			getSourceCode(tokenAddress),
			null,
			count_trades === 'true' ? getSwapLogs(await pairContract.getAddress(), blockNumber - 7200, blockNumber) : [],
			erc20Contract.name().catch(() => '<Unnamed Token>'),
			erc20Contract.symbol().catch(() => 'ERC20'),
			erc20Contract.decimals().catch(() => 18),
			erc20Contract.totalSupply().catch(() => null),
			erc20Contract.owner().catch(() => null),
			getFirstSync(await pairContract.getAddress()).catch(() => null),
			getEtherPrice().catch(() => null),
		]);
	}
	catch (err) {
		res.status(500).json({ success: false, result: { error: 'Errored while retrieving pair details' } });
	}

	const pool_type = 'uniswap-v3';
	const pool_address = address;
	const pool_fee = Number(pool_fee_bigint);
	const token_address = tokenAddress;
	const token_supply = Number(ethers.formatUnits(token_total_supply_bigint, token_decimals_bigint));
	const price = definedData?.price ?? null;
	const market_cap = token_total_supply_bigint ? Number(ethers.formatUnits(token_total_supply_bigint, token_decimals_bigint)) * price : null;
	const pooled_eth = Number(ethers.formatEther(pooled_eth_bigint));
	const pooled_eth_initial = firstSync.reserve0;
	const current_liquidity = etherPrice ? pooled_eth * etherPrice * 2 : null;
	const pool_growth = pooled_eth_initial ? Number((current_liquidity / pooled_eth_initial - 1).toFixed(2)) : null;
	const token_holders = null;
	const { buys: buys_24h, sells: sells_24h } = countSwapsfromLogs(swapLogs, address0);
	const buy_tax = (honeypotisData?.simulationResult?.buyTax ?? 0) + (pool_fee / 10_000);
	const sell_tax = (honeypotisData?.simulationResult?.sellTax ?? 0) + (pool_fee / 10_000);
	const buy_gas = honeypotisData?.simulationResult?.buyGas ?? null;
	const sell_gas = honeypotisData?.simulationResult?.sellGas ?? null;
	const max_buy = honeypotisData?.simulationResult?.maxBuy?.withToken ?? null;
	const max_sell = honeypotisData?.simulationResult?.maxSell?.withToken ?? null;
	const is_honeypot = honeypotisData?.honeypotResult?.isHoneypot ?? null;
	const verified = sourceCode ? true : false;
	const links = Array.from(new Set([...findLinksFromSourceCode(sourceCode), ...(definedData?.links ?? [])]));
	const token_decimals = Number(token_decimals_bigint);

	let renounced = false;
	if (owner && owner === ethers.ZeroAddress) renounced = true;

	const result = {
		pool_type,
		pool_address,
		token_address,
		token_name,
		token_symbol,
		token_decimals,
		token_supply,
		price,
		market_cap,
		pooled_eth,
		pooled_eth_initial,
		current_liquidity,
		pool_growth,
		token_holders,
		buys_24h,
		sells_24h,
		buy_tax,
		sell_tax,
		buy_gas,
		sell_gas,
		max_buy,
		max_sell,
		owner,
		is_honeypot,
		verified,
		renounced,
		links,
		locks,
	};

	res.status(200).send({ success: true, result });
});

module.exports = router;