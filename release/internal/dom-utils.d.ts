export interface Point {
    x: number;
    y: number;
}
export declare function isDOMElement(object: Element): string;
export declare function addDocumentListener(ev: string, handler: EventListener, passive?: boolean): void;
export declare function removeDocumentListener(ev: string, handler: EventListener): void;
export declare function onEvt(el: EventTarget, event: string, handler: EventListener, capture?: boolean): {
    off(): void;
};
export declare function createDragImage(sourceNode: HTMLElement): HTMLElement;
export declare function isTouchIdentifierContainedInTouchEvent(touchEvent: TouchEvent, touchIdentifier: number): boolean;
export declare function updateCentroidCoordinatesOfTouchesIn(coordinateProp: "page" | "client", event: TouchEvent, outPoint: Point): void;
export declare function extractTransformStyles(sourceNode: HTMLElement): string[];
export declare function translateElementToPoint(element: HTMLElement, pnt: Point, originalTransforms: string[], offset?: Point, centerOnCoordinates?: boolean): void;
export declare function applyDragImageSnapback(sourceEl: HTMLElement, dragImage: HTMLElement, dragImageTransforms: string[], transitionEndCb: Function): void;
