export interface DetectedFeatures {
    draggable: boolean;
    dragEvents: boolean;
    userAgentSupportingNativeDnD: boolean;
}
export declare function detectFeatures(): DetectedFeatures;
export declare function supportsPassiveEventListener(): boolean;
