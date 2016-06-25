declare let DEBUG: boolean;
declare module DragDropPolyfill {
    interface Config {
        forceApply?: boolean;
        dragImageOffset?: Point;
        dragImageCenterOnTouch?: boolean;
        iterationInterval?: number;
        dragStartConditionOverride?: (event: TouchEvent) => boolean;
        dragImageTranslateOverride?: (event: TouchEvent, hoverCoordinates: Point, hoveredElement: HTMLElement, translateDragImageFn: (offsetX: number, offsetY: number) => void) => boolean;
        defaultActionOverride?: (event: TouchEvent) => boolean;
    }
    function Initialize(override?: Config): void;
    interface Point {
        x: number;
        y: number;
    }
}
