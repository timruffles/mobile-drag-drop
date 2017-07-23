import { DragImageTranslateOverrideFn } from "./index";
export interface ScrollOptions {
    threshold?: number;
    velocityFn: (velocity: number, threshold: number) => number;
}
export declare const scrollBehaviourDragImageTranslateOverride: DragImageTranslateOverrideFn;
export as namespace MobileDragDrop;