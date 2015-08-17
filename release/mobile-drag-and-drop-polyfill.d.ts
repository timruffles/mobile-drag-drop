declare module MobileDragAndDropPolyfill {
    interface Config {
        dragImageClass?: string;
        scrollThreshold?: number;
        scrollVelocity?: number;
        debug?: boolean;
    }
    var Initialize: (config?: Config) => void;
}
