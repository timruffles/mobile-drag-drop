import { DataTransfer, DragDataStore } from "./drag-data-store";
export declare function tryFindDraggableTarget(event: TouchEvent): HTMLElement | undefined;
export declare function determineDropEffect(effectAllowed: string, sourceNode: Element): string;
export declare function dispatchDragEvent(dragEvent: string, targetElement: Element, touchEvent: TouchEvent, dataStore: DragDataStore, dataTransfer: DataTransfer, cancelable?: boolean, relatedTarget?: Element | null): boolean;
export declare function determineDragOperation(effectAllowed: string, dropEffect: string): string;
