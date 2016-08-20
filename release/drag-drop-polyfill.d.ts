declare let DEBUG: boolean;
declare module DragDropPolyfill {
    type DragImageTranslateOverrideFn = (event: TouchEvent, hoverCoordinates: Point, hoveredElement: HTMLElement, translateDragImageFn: (offsetX: number, offsetY: number) => void) => void;
    interface Config {
        forceApply?: boolean;
        dragImageOffset?: Point;
        dragImageCenterOnTouch?: boolean;
        iterationInterval?: number;
        dragStartConditionOverride?: (event: TouchEvent) => boolean;
        dragImageTranslateOverride?: DragImageTranslateOverrideFn;
        defaultActionOverride?: (event: TouchEvent) => void;
    }
    function Initialize(override?: Config): void;
    interface Point {
        x: number;
        y: number;
    }
}
