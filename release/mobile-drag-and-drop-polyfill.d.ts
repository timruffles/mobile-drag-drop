declare module MobileDragAndDropPolyfill {
    interface Config {
        log?: (...args: any[]) => void;
        dragImageClass?: string;
    }
    var Initialize: (config?: Config) => void;
}
