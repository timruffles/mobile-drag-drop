declare let DEBUG: boolean;
interface WhatWGEventListenerArgs {
    capture?: boolean;
}
interface WhatWGAddEventListenerArgs extends WhatWGEventListenerArgs {
    passive?: boolean;
    once?: boolean;
}
declare type WhatWGAddEventListener = (type: string, listener: (event: Event) => void, options?: WhatWGAddEventListenerArgs) => void;
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
