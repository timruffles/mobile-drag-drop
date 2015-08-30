declare module MobileDragAndDropPolyfill {
    interface Config {
        dragImageClass?: string;
        scrollThreshold?: number;
        scrollVelocity?: number;
        debug?: boolean;
    }
    function Initialize(override?: Config): void;
}
