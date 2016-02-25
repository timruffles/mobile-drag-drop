declare module MobileDragAndDropPolyfill {
    interface ScrollOptions {
        threshold?: number;
        velocity?: number;
    }
    function SetOptions(options: ScrollOptions): void;
    function HandleDragImageTranslateOverride(currentCoordinates: Point, hoveredElement: HTMLElement, translateDragImageFn: (scrollDiffX: number, scrollDiffY: number) => void): boolean;
}
