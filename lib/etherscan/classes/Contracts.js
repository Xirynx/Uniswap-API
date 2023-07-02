"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Contracts = void 0;
const Client_1 = require("./Client");
class Contracts extends Client_1.Client {
    constructor(apiKey) {
        super(apiKey);
        this.module = 'contract';
    }
    async getAbi(address) {
        const urlSearchParams = new URLSearchParams([
            ['module', this.module],
            ['action', 'getabi'],
            ['address', address]
        ]);
        const res = await this.dispatch(urlSearchParams);
        return res;
    }
    async getSourceCode(address) {
        const urlSearchParams = new URLSearchParams([
            ['module', this.module],
            ['action', 'getsourcecode'],
            ['address', address]
        ]);
        const res = await this.dispatch(urlSearchParams);
        return res;
    }
    async getContractCreation(addresses) {
        const urlSearchParams = new URLSearchParams([
            ['module', this.module],
            ['action', 'getcontractcreation'],
            ['contractaddresses', addresses.join(',')]
        ]);
        const res = await this.dispatch(urlSearchParams);
        return res;
    }
}
exports.Contracts = Contracts;
