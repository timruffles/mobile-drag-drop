declare var DEBUG: boolean;
declare module MobileDragAndDropPolyfill {
    interface Config {
        dragImageOffset?: Point;
        dragImageCenterOnTouch?: boolean;
        iterationInterval?: number;
        dragStartConditionOverride?: (event: TouchEvent) => boolean;
        dragImageTranslateOverride?: (event: TouchEvent, hoverCoordinates: Point, hoveredElement: HTMLElement, translateDragImageFn: (scrollDiffX: number, scrollDiffY: number) => void) => boolean;
        defaultActionOverride?: (event: TouchEvent) => boolean;
    }
    function Initialize(override?: Config): void;
    interface Point {
        x: number;
        y: number;
    }
}
