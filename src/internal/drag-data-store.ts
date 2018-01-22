import { ALLOWED_EFFECTS, DROP_EFFECT, DROP_EFFECTS } from "./constants";

/**
 * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#drag-data-store-mode
 */
export const enum DragDataStoreMode {
    _DISCONNECTED, // adding an extra mode here because we need a special state to disconnect the data store from dataTransfer instance
    READONLY,
    READWRITE,
    PROTECTED
}

/**
 * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#the-drag-data-store
 */
export interface DragDataStore {
    _mode:DragDataStoreMode;
    _data:{ [type:string]:any };
    _types:Array<string>;
    _effectAllowed:string;
}

/**
 * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#datatransfer
 */
export class DataTransfer {

    private _dropEffect:string = DROP_EFFECTS[ DROP_EFFECT.NONE ];

    public get dropEffect() {
        return this._dropEffect;
    }

    //public get files():FileList {
    //    return undefined;
    //}
    //
    //public get items():DataTransferItemList {
    //    return undefined;
    //}

    public set dropEffect( value ) {
        if( this._dataStore._mode !== DragDataStoreMode._DISCONNECTED
            && ALLOWED_EFFECTS.indexOf( value ) > -1 ) {
            this._dropEffect = value;
        }
    }

    public get types():ReadonlyArray<string> {
        if( this._dataStore._mode !== DragDataStoreMode._DISCONNECTED ) {
            return Object.freeze( this._dataStore._types );
        }
    }

    public get effectAllowed() {
        return this._dataStore._effectAllowed;
    }

    public set effectAllowed( value ) {
        if( this._dataStore._mode === DragDataStoreMode.READWRITE
            && ALLOWED_EFFECTS.indexOf( value ) > -1 ) {
            this._dataStore._effectAllowed = value;
        }
    }

    constructor( private _dataStore:DragDataStore,
                 private _setDragImageHandler:( image:Element, x:number, y:number ) => void ) {
    }

    public setData( type:string, data:string ):void {
        if( this._dataStore._mode === DragDataStoreMode.READWRITE ) {

            if( type.indexOf( " " ) > -1 ) {
                throw new Error( "illegal arg: type contains space" );
            }

            this._dataStore._data[ type ] = data;

            if( this._dataStore._types.indexOf( type ) === -1 ) {
                this._dataStore._types.push( type );
            }
        }
    }

    public getData( type:string ):string {
        if( this._dataStore._mode === DragDataStoreMode.READONLY
            || this._dataStore._mode === DragDataStoreMode.READWRITE ) {
            return this._dataStore._data[ type ] || "";
        }
    }

    public clearData( format?:string ):void {
        if( this._dataStore._mode === DragDataStoreMode.READWRITE ) {
            // delete data for format
            if( format && this._dataStore._data[ format ] ) {
                delete this._dataStore._data[ format ];
                var index = this._dataStore._types.indexOf( format );
                if( index > -1 ) {
                    this._dataStore._types.splice( index, 1 );
                }
                return;
            }
            // delete all data
            this._dataStore._data = {};
            this._dataStore._types = [];
        }
    }

    public setDragImage( image:Element, x:number, y:number ):void {
        if( this._dataStore._mode === DragDataStoreMode.READWRITE ) {
            this._setDragImageHandler( image, x, y );
        }
    }
}
