"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DecrementingCounter {
    constructor(decrementRate = 1) {
        this.incrementTimes = [];
        if (decrementRate <= 0)
            throw new Error('`decrementRate` must be greater than 0');
        this.decrementRate = decrementRate;
    }
    inc(count = 1) {
        const time = this.getTime();
        this.incrementTimes.push(...Array.from({ length: count }, () => time));
    }
    getCount() {
        this.incrementTimes = this.incrementTimes.filter(time => {
            if (this.getTimeSince(time) < 1000 / this.decrementRate)
                return true;
            else
                return false;
        });
        return this.incrementTimes.length;
    }
    getTime() {
        return new Date().getTime();
    }
    getTimeSince(time) {
        return new Date().getTime() - time;
    }
}
exports.default = DecrementingCounter;
