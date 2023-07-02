"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class Client {
    constructor(apiKey) {
        this.baseUrl = new URL('https://api.etherscan.io/api');
        this.apiKey = apiKey;
    }
    parseEtherscanResponse(response) {
        if (response.status !== '1')
            throw new Error(`Client::parseEtherscanResponse\nstatus: ${response.status}\nmessage: ${response.message}\nresult: ${response.result}`);
        return response.result;
    }
    async dispatch(params) {
        const urlSearchParams = new URLSearchParams([...params.entries(), ['apikey', this.apiKey]]);
        const res = await (0, node_fetch_1.default)(`${this.baseUrl}?${urlSearchParams}`);
        const data = await res.json();
        return this.parseEtherscanResponse(data);
    }
}
exports.Client = Client;
