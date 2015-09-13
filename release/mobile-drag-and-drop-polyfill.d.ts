declare var DEBUG: boolean;
declare module MobileDragAndDropPolyfill {
    interface Config {
        iterationInterval?: number;
        scrollThreshold?: number;
        scrollVelocity?: number;
    }
    function Initialize(override?: Config): void;
}
