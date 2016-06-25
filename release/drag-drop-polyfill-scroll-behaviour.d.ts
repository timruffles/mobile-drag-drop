declare module DragDropPolyfill {
    interface ScrollOptions {
        threshold?: number;
        velocityFn: (velocity: number, threshold: number) => number;
    }
    function SetOptions(options: ScrollOptions): void;
    function HandleDragImageTranslateOverride(event: TouchEvent, currentCoordinates: Point, hoveredElement: HTMLElement, translateDragImageFn: (scrollDiffX: number, scrollDiffY: number) => void): boolean;
}
