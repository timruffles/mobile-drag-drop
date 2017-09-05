export declare type DragImageTranslateOverrideFn = (event: TouchEvent, hoverCoordinates: Point, hoveredElement: HTMLElement, translateDragImageFn: (offsetX: number, offsetY: number) => void) => void;
export interface Config {
    forceApply?: boolean;
    dragImageOffset?: Point;
    dragImageCenterOnTouch?: boolean;
    iterationInterval?: number;
    dragStartConditionOverride?: (event: TouchEvent) => boolean;
    dragImageTranslateOverride?: DragImageTranslateOverrideFn;
    defaultActionOverride?: (event: TouchEvent) => void;
    holdToDrag?: number;
}
export declare function polyfill(override?: Config): boolean;
export interface Point {
    x: number;
    y: number;
}
export as namespace MobileDragDrop;