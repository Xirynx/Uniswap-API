"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoPlus = void 0;
const ethers_1 = require("ethers");
const node_fetch_1 = __importDefault(require("node-fetch"));
const DecrementingCounter_1 = __importDefault(require("./DecrementingCounter"));
const RequestCodes_1 = require("../types/RequestCodes");
class GoPlus {
    constructor() {
        this.rateLimitManager = new DecrementingCounter_1.default(0.5);
    }
    async getTokenSecurity(address) {
        await this.waitForRateLimit();
        const res = await (0, node_fetch_1.default)(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${(0, ethers_1.getAddress)(address)}`);
        const json = await res.json();
        if (json.code !== RequestCodes_1.RequestCodes.SUCCESS && json.code !== RequestCodes_1.RequestCodes.PARTIAL_DATA)
            throw new Error('Request error!');
        if (!json.result)
            throw new Error('No result found!');
        return json.result;
    }
    async checkMaliciousAddress(address) {
        await this.waitForRateLimit();
        const res = await (0, node_fetch_1.default)(`https://api.gopluslabs.io/api/v1/address_security/${(0, ethers_1.getAddress)(address)}?chain_id=1`);
        const json = await res.json();
        if (json.code !== RequestCodes_1.RequestCodes.SUCCESS && json.code !== RequestCodes_1.RequestCodes.PARTIAL_DATA)
            throw new Error('Request error!');
        if (!json.result)
            throw new Error('No result found!');
        return json.result;
    }
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async waitForRateLimit() {
        while (this.rateLimitManager.getCount() >= 30) {
            await this.wait(100);
        }
        return;
    }
}
exports.GoPlus = GoPlus;
const goplus = new GoPlus();
goplus.checkMaliciousAddress('0x9C7FaD868F477aFce0E54Febb8d8632CF91F6a88').then(console.log);
