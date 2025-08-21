export function computed(fn: any, options: any): Computed;
export function effect(fn: any, options: any): () => void;
export function batch(fn: any): any;
export function untracked(fn: any): any;
export function signal(value: any, options: any): Signal;
declare function Computed(fn: any, options: any): void;
declare class Computed {
    constructor(fn: any, options: any);
    _fn: any;
    _sources: any;
    _globalVersion: number;
    _flags: number;
    _watched: any;
    _unwatched: any;
    name: any;
    _refresh(): boolean;
    _value: any;
    _subscribe(node: any): void;
    _unsubscribe(node: any): void;
    _notify(): void;
    get value(): any;
}
declare function Signal(value: any, options: any): void;
declare class Signal {
    constructor(value: any, options: any);
    _value: any;
    _version: number;
    _node: any;
    _targets: any;
    _watched: any;
    _unwatched: any;
    name: any;
    brand: typeof BRAND_SYMBOL;
    _refresh(): boolean;
    _subscribe(node: any): void;
    _unsubscribe(node: any): void;
    subscribe(fn: any): () => void;
    valueOf(): any;
    toString(): string;
    toJSON(): any;
    peek(): any;
    set value(arg: any);
    get value(): any;
}
declare const BRAND_SYMBOL: unique symbol;
export {};
