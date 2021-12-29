export interface DetectedFeatures {
    draggable:boolean;
    dragEvents:boolean;
    userAgentSupportingNativeDnD:boolean;
}

export function detectFeatures():DetectedFeatures {

    const isBlinkEngine = !!((<any>window).chrome) || /chrome/i.test( navigator.userAgent );

    return {
        dragEvents: ("ondragstart" in document.documentElement),
        draggable: ("draggable" in document.documentElement),
        userAgentSupportingNativeDnD: !(
            // if is mobile safari or android browser -> no native dnd
            (/iPad|iPhone|iPod|Android/.test(navigator.userAgent))
            || // OR
            //if is blink(chrome/opera) with touch events enabled -> no native dnd
            (isBlinkEngine && ("ontouchstart" in document.documentElement))
        )
    };
}

export function supportsPassiveEventListener():boolean {

    let supportsPassiveEventListeners = false;

    // reference https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md
    try {
        let opts = Object.defineProperty( {}, "passive", {
            get: function() {
                supportsPassiveEventListeners = true;
            }
        } );
        window.addEventListener( "test", null, opts );
    }
        // tslint:disable-next-line:no-empty
    catch( e ) {
    }

    return supportsPassiveEventListeners;
}
