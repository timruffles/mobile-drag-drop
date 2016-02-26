declare module MobileDragAndDropPolyfill {
    interface ScrollOptions {
        threshold?: number;
        velocityFn: (velocity: number) => number;
    }
    function SetOptions(options: ScrollOptions): void;
    function HandleDragImageTranslateOverride(event: TouchEvent, currentCoordinates: Point, hoveredElement: HTMLElement, translateDragImageFn: (scrollDiffX: number, scrollDiffY: number) => void): boolean;
}
