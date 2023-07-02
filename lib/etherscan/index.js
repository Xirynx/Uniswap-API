"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Etherscan = void 0;
const Accounts_1 = require("./classes/Accounts");
const Contracts_1 = require("./classes/Contracts");
class Etherscan {
    constructor(apiKey) {
        this.accounts = new Accounts_1.Accounts(apiKey);
        this.contracts = new Contracts_1.Contracts(apiKey);
    }
}
exports.Etherscan = Etherscan;
