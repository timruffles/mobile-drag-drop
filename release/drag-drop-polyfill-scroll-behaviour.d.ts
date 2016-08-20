declare module DragDropPolyfill {
    interface ScrollOptions {
        threshold?: number;
        velocityFn: (velocity: number, threshold: number) => number;
    }
    function SetOptions(options: ScrollOptions): void;
    const HandleDragImageTranslateOverride: DragImageTranslateOverrideFn;
}
