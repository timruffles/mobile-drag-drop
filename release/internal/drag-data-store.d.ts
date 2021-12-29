export declare const enum DragDataStoreMode {
    _DISCONNECTED = 0,
    READONLY = 1,
    READWRITE = 2,
    PROTECTED = 3
}
export interface DragDataStore {
    mode: DragDataStoreMode;
    data: {
        [type: string]: any;
    };
    types: Array<string>;
    effectAllowed: string;
}
export declare class DataTransfer {
    private _dataStore;
    private _setDragImageHandler;
    private _dropEffect;
    get dropEffect(): string;
    set dropEffect(value: string);
    get types(): ReadonlyArray<string>;
    get effectAllowed(): string;
    set effectAllowed(value: string);
    constructor(_dataStore: DragDataStore, _setDragImageHandler: (image: Element, x: number, y: number) => void);
    setData(type: string, data: string): void;
    getData(type: string): string;
    clearData(format?: string): void;
    setDragImage(image: Element, x: number, y: number): void;
}
