/* eslint-disable @typescript-eslint/no-explicit-any */
export class PrefixLogger {
    _debugMode = false;
    args: any[] = [];
    prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
        this.args = [];
    }

    debug(message: string, ...args: any[]) {
        if (this._debugMode) {
            console.debug(`${this.prefix}: ${message}`, ...this.args, ...args);
        }
    }

    error(message: string, ...args: any[]) {
        console.error(`${this.prefix}: ${message}`, ...this.args, ...args);
    }

    info(message: string, ...args: any[]) {
        console.log(`${this.prefix}: ${message}`, ...this.args, ...args);
    }

    injectArgs(...args: any[]) {
        this.args = args;
        return this;
    }
}
