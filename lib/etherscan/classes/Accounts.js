"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Accounts = void 0;
const Client_1 = require("./Client");
const BlockTag_1 = require("../types/BlockTag");
class Accounts extends Client_1.Client {
    constructor(apiKey) {
        super(apiKey);
        this.module = 'account';
    }
    async getEtherBalance(address, tag = BlockTag_1.BlockTag.LATEST) {
        const urlSearchParams = new URLSearchParams([
            ['module', this.module],
            ['action', 'balance'],
            ['address', address],
            ['tag', tag]
        ]);
        const res = await this.dispatch(urlSearchParams);
        return BigInt(res);
    }
    async getMultipleEtherBalances(addresses, tag = BlockTag_1.BlockTag.LATEST) {
        const urlSearchParams = new URLSearchParams([
            ['module', this.module],
            ['action', 'balancemulti'],
            ['address', addresses.join(',')],
            ['tag', tag]
        ]);
        const res = await this.dispatch(urlSearchParams);
        return res;
    }
    async getNormalTransactions(address, options) {
        if (!options)
            options = {};
        const urlSearchParams = new URLSearchParams([
            ['module', this.module],
            ['action', 'txlist'],
            ['address', address],
            ['startblock', options.startBlock?.toString() || '0'],
            ['endblock', options.endBlock?.toString() || '99999999'],
            ['page', options.page?.toString() || '1'],
            ['offset', options.offset?.toString() || '10'],
            ['sort', options.sort || 'asc']
        ]);
        const res = await this.dispatch(urlSearchParams);
        return res;
    }
    async getInternalTransactions(address, options) {
        if (!options)
            options = {};
        const urlSearchParams = new URLSearchParams([
            ['module', this.module],
            ['action', 'txlistinternal'],
            ['address', address],
            ['startblock', options.startBlock?.toString() || '0'],
            ['endblock', options.endBlock?.toString() || '99999999'],
            ['page', options.page?.toString() || '1'],
            ['offset', options.offset?.toString() || '10'],
            ['sort', options.sort || 'asc']
        ]);
        const res = await this.dispatch(urlSearchParams);
        return res;
    }
}
exports.Accounts = Accounts;
