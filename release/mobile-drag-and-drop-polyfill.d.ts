declare module MobileDragAndDropPolyfill {
    interface Config {
        log?: (...args: any[]) => void;
        dragImageClass?: string;
        scrollThreshold?: number;
        scrollVelocity?: number;
    }
    var Initialize: (config?: Config) => void;
}
