require('dotenv').config();
const express = require('express');
const ethers = require('ethers');
const fetch = require('node-fetch');
const UniswapV2PairABI = require('../../../lib/abi/UniswapV2Pair.json');

const router = express.Router();

const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const UNISWAP_V2_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

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

const honeypotis = async (tokenAddress, pairAddress) => {
	const res = await fetch(`https://api.honeypot.is/v1/IsHoneypot?chainID=1&router=${UNISWAP_V2_ROUTER_ADDRESS}&address=${tokenAddress}&pair=${pairAddress}`);
	return await res.json();
};

const dextools = async (pairAddress) => {
	const res = await fetch(`https://www.dextools.io/shared/data/pair?address=${pairAddress.toLowerCase()}&chain=ether`);
	const json = await res.json();
	if (json.data) {
		const data = {};
		data.price = json.data?.[0].price ?? null;
		data.metrics = json.data?.[0].metrics ?? null;
		const links = json.data?.[0].token.links ?? null;
		if (links) {
			data.links = Object.values(links).filter(link => link !== '');
		}
		else {
			data.links = [];
		}
		return data;
	}
	else {
		return {
			price: null,
			metrics: null,
			links: [],
		};
	}
};

const getLiquidityLocks = async (pairAddress) => {
	const UNICRYPT_ADDRESS = '0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214';
	const TEAM_FINANCE_ADDRESS = '0xE2fE530C047f2d85298b07D9333C05737f1435fB';
	const infuraProvider = new ethers.InfuraProvider(1, process.env.INFURA_API_KEY);
	const defaultProvider = new ethers.JsonRpcProvider('http://hypernode.justcubes.io:8545');
	const unicryptInterface = new ethers.Interface([
		'function getNumLocksForToken(address) view returns (uint)',
		'function tokenLocks(address, uint) view returns (uint256 lockDate, uint256 amount, uint256 initialAmount, uint256 unlockDate, uint256 lockID, address owner)',
	]);
	const teamFinanceInterface = new ethers.Interface([
		'event Deposit(uint256 id, address indexed tokenAddress, address indexed withdrawalAddress, uint256 amount, uint256 unlockTime)',
		'function lockedToken(uint) view returns (address tokenAddress, address withdrawalAddress, uint256 tokenAmount, uint256 unlockTime, bool withdrawn)',
	]);
	const TeamFinance = new ethers.Contract(TEAM_FINANCE_ADDRESS, teamFinanceInterface, infuraProvider);
	const Unicrypt = new ethers.Contract(UNICRYPT_ADDRESS, unicryptInterface, defaultProvider);
	const Pair = new ethers.Contract(pairAddress, UniswapV2PairABI, defaultProvider);

	let totalLPSupply, numUnicryptLocks, teamFinanceLockLogs, currentBlock, amountLPBurned;
	try {
		const teamFinanceLogFilter = TeamFinance.filters.Deposit(null, pairAddress);
		[currentBlock, totalLPSupply, amountLPBurned, numUnicryptLocks, teamFinanceLockLogs] = await Promise.all([
			defaultProvider.getBlock(),
			Pair.totalSupply(),
			Pair.balanceOf('0x000000000000000000000000000000000000dEaD'),
			Unicrypt.getNumLocksForToken(pairAddress),
			TeamFinance.queryFilter(teamFinanceLogFilter),
		]);
	}
	catch (err) {
		console.error('pair-details::getLiquidityLocks - Error occurred while checking totalLPSupply or numUnicryptLocks:');
		console.error(err);
		return [];
	}

	const burnedLP = [];
	if (BigInt(amountLPBurned) > 0n) {
		burnedLP.push({
			locker: 'burn',
			amount: amountLPBurned.toString(),
			unlocks: null,
			percent: Number((BigInt(amountLPBurned) * 10000n) / totalLPSupply) / 10_000,
		});
	}

	const getUnicryptLocks = async () => {
		const queries = [];
		for (let i = 0; i < numUnicryptLocks; ++i) {
			queries.push(Unicrypt.tokenLocks(pairAddress, i));
		}
		const queryResults = await Promise.all(queries);
		const locks = queryResults.map(res => {
			return {
				locker: 'unicrypt',
				amount: res[1].toString(),
				unlocks: res[3].toString(),
				percent: Number((res[1] * 10000n) / totalLPSupply) / 10_000,
			};
		});
		return locks.filter(lock => BigInt(lock.unlocks) > BigInt(currentBlock.timestamp));
	};

	const getTeamFinanceLocks = async () => {
		const queries = [];
		for (let i = 0; i < teamFinanceLockLogs.length; ++i) {
			queries.push(TeamFinance.lockedToken(teamFinanceLockLogs[i].args[0]));
		}
		const queryResults = await Promise.all(queries);
		const locks = queryResults.map(res => {
			return {
				locker: 'team_finance',
				amount: res[2].toString(),
				unlocks: res[3].toString(),
				percent: Number((res[2] * 10000n) / totalLPSupply) / 10_000,
			};
		});
		return locks.filter(lock => BigInt(lock.unlocks) > BigInt(currentBlock.timestamp));
	};

	let unicryptLocks, teamFinanceLocks;
	try {
		[unicryptLocks, teamFinanceLocks] = await Promise.all([
			getUnicryptLocks(),
			getTeamFinanceLocks(),
		]);
		return [...unicryptLocks, ...teamFinanceLocks, ...burnedLP];
	}
	catch (err) {
		console.error('pair-details::getLiquidityLocks - Error while retrieving locks:');
		console.error(err);
		return [];
	}
};

const findLinksFromSourceCode = (code) => {
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

router.get('/:address', async (req, res) => {
	const ethereumAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
	const { address } = req.params;

	if (!ethereumAddressRegex.test(address)) {
		res.status(200).json({ success: false, result: { error: 'Invalid Ethereum address provided' } });
		return;
	}

	const provider = new ethers.JsonRpcProvider('http://hypernode.justcubes.io:8545');
	const pairContract = new ethers.Contract(address, UniswapV2PairABI, provider);

	let pairDetails;
	try {
		pairDetails = await Promise.all([
			pairContract.token0(),
			pairContract.token1(),
			pairContract.getReserves(),
		]);
	}
	catch (err) {
		res.status(200).json({ success: false, result: { error: 'Address does not correspond to existing pair on Uniswap V2' } });
		return;
	}

	const [address0, address1, reserves] = pairDetails;

	if (address0.toLowerCase() !== WETH_ADDRESS.toLowerCase() && address1.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
		res.status(200).json({ success: false, result: { error: 'At least one token in pair must be wrapped ether' } });
		return;
	}

	let tokenAddress;
	if (address0.toLowerCase() === WETH_ADDRESS.toLowerCase()) tokenAddress = address1;
	else tokenAddress = address0;

	const erc20Interface = new ethers.Interface([
		'function name() view returns (string)',
		'function symbol() view returns (string)',
		'function decimals() view returns (uint)',
		'function totalSupply() view returns (uint)',
		'function owner() view returns (address)',
	]);

	const erc20Contract = new ethers.Contract(tokenAddress, erc20Interface, provider);

	let honeypotisData, dextoolsData, sourceCode, locks, token_name, token_symbol, token_decimals_bigint, token_total_supply_bigint, owner;
	try {
		[
			honeypotisData,
			dextoolsData,
			sourceCode,
			locks,
			token_name,
			token_symbol,
			token_decimals_bigint,
			token_total_supply_bigint,
			owner,
		] = await Promise.all([
			honeypotis(tokenAddress, await pairContract.getAddress()),
			dextools(await pairContract.getAddress()),
			getSourceCode(tokenAddress),
			getLiquidityLocks(await pairContract.getAddress()),
			erc20Contract.name().catch(() => '<Unnamed Token>'),
			erc20Contract.symbol().catch(() => 'ERC20'),
			erc20Contract.decimals().catch(() => 18),
			erc20Contract.totalSupply().catch(() => null),
			erc20Contract.owner().catch(() => null),
		]);
	}
	catch (err) {
		res.status(500).json({ success: false, result: { error: 'Errored while retrieving pair details' } });
	}

	const token_address = tokenAddress;
	const price = dextoolsData?.price;
	const market_cap = token_total_supply_bigint ? Number(ethers.formatUnits(token_total_supply_bigint, token_decimals_bigint)) * price : null;
	const pooled_eth = address0.toLowerCase() === WETH_ADDRESS.toLowerCase() ? Number(ethers.formatEther(reserves[0])) : Number(ethers.formatEther(reserves[1]));
	const initial_liquidity = dextoolsData?.metrics?.initialLiquidity ?? 0;
	const current_liquidity = dextoolsData?.metrics?.liquidity ?? 0;
	const buy_tax = honeypotisData?.BuyTax ?? null;
	const sell_tax = honeypotisData?.SellTax ?? null;
	const is_honeypot = honeypotisData?.IsHoneypot ?? null;
	const verified = sourceCode ? true : false;
	const links = Array.from(new Set([...findLinksFromSourceCode(sourceCode), ...(dextoolsData?.links ?? [])]));
	const token_decimals = Number(token_decimals_bigint);

	let renounced = false;
	if (owner && owner === ethers.ZeroAddress) renounced = true;

	const result = {
		token_address,
		token_name,
		token_symbol,
		token_decimals,
		price,
		market_cap,
		pooled_eth,
		initial_liquidity,
		current_liquidity,
		buy_tax,
		sell_tax,
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