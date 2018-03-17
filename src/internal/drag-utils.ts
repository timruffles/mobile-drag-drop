import { ALLOWED_EFFECTS, DROP_EFFECT, DROP_EFFECTS, EFFECT_ALLOWED } from "./constants";
import { DataTransfer, DragDataStore, DragDataStoreMode } from "./drag-data-store";

/**
 * Search for a possible draggable item upon an event that can initialize a drag operation.
 * Can be overridden in polyfill config.
 */
export function tryFindDraggableTarget( event:TouchEvent ):HTMLElement | undefined {

    //1. Determine what is being dragged, as follows:

    // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
    // If the drag operation was invoked on a selection, then it is the selection that is being dragged.
    //if( (<Element>event.target).nodeType === 3 ) {
    //
    //    config.log( "drag on text" );
    //    return <Element>event.target;
    //}
    //Otherwise, if the drag operation was invoked on a Document, it is the first element, going up the ancestor chain, starting at the node that the
    // user tried to drag, that has the IDL attribute draggable set to true.
    //else {

    let el = <HTMLElement>event.target;

    do {
        if( el.draggable === false ) {
            continue;
        }
        if( el.draggable === true ) {
            return el;
        }
        if( el.getAttribute
            && el.getAttribute( "draggable" ) === "true" ) {
            return el;
        }
    } while( (el = <HTMLElement>el.parentNode) && el !== document.body );
}

/**
 * Implements "6." in the processing steps defined for a dnd event
 * https://html.spec.whatwg.org/multipage/interaction.html#dragevent
 */
export function determineDropEffect( effectAllowed:string, sourceNode:Element ) {

    // uninitialized
    if( !effectAllowed ) {

        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
        //if( sourceNode.nodeType === 1 ) {
        //
        //return "move";
        //}

        // link
        if( sourceNode.nodeType === 3 && (<HTMLElement>sourceNode).tagName === "A" ) {
            return DROP_EFFECTS[ DROP_EFFECT.LINK ];
        }

        // copy
        return DROP_EFFECTS[ DROP_EFFECT.COPY ];
    }

    // none
    if( effectAllowed === ALLOWED_EFFECTS[ EFFECT_ALLOWED.NONE ] ) {
        return DROP_EFFECTS[ DROP_EFFECT.NONE ];
    }
    // copy or all
    if( effectAllowed.indexOf( ALLOWED_EFFECTS[ EFFECT_ALLOWED.COPY ] ) === 0 || effectAllowed === ALLOWED_EFFECTS[ EFFECT_ALLOWED.ALL ] ) {
        return DROP_EFFECTS[ DROP_EFFECT.COPY ];
    }
    // link
    if( effectAllowed.indexOf( ALLOWED_EFFECTS[ EFFECT_ALLOWED.LINK ] ) === 0 ) {
        return DROP_EFFECTS[ DROP_EFFECT.LINK ];
    }
    // move
    if( effectAllowed === ALLOWED_EFFECTS[ EFFECT_ALLOWED.MOVE ] ) {
        return DROP_EFFECTS[ DROP_EFFECT.MOVE ];
    }

    // copy
    return DROP_EFFECTS[ DROP_EFFECT.COPY ];
}

function createDragEventFromTouch( targetElement:Element,
                                   e:TouchEvent,
                                   type:string,
                                   cancelable:boolean,
                                   window:Window,
                                   dataTransfer:DataTransfer,
                                   relatedTarget:Element = null ) {

    const touch:Touch = e.changedTouches[ 0 ];

    const dndEvent:DragEvent = new Event( type, {
        bubbles: true,
        cancelable: cancelable
    } ) as DragEvent;

    // cast our polyfill
    (dndEvent as any).dataTransfer = dataTransfer as any;
    (dndEvent as any).relatedTarget = relatedTarget;

    // set the coordinates
    (dndEvent as any).screenX = touch.screenX;
    (dndEvent as any).screenY = touch.screenY;
    (dndEvent as any).clientX = touch.clientX;
    (dndEvent as any).clientY = touch.clientY;
    (dndEvent as any).pageX = touch.pageX;
    (dndEvent as any).pageY = touch.pageY;

    const targetRect = targetElement.getBoundingClientRect();
    (dndEvent as any).offsetX = dndEvent.clientX - targetRect.left;
    (dndEvent as any).offsetY = dndEvent.clientY - targetRect.top;

    return dndEvent;
}

/**
 * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
 */
export function dispatchDragEvent( dragEvent:string,
                                   targetElement:Element,
                                   touchEvent:TouchEvent,
                                   dataStore:DragDataStore,
                                   dataTransfer:DataTransfer,
                                   cancelable:boolean = true,
                                   relatedTarget:Element | null = null ):boolean {

    console.log( "dnd-poly: dispatching " + dragEvent );

    // if( DEBUG ) {
    //     const debug_class = CLASS_PREFIX + "debug",
    //         debug_class_event_target = CLASS_PREFIX + "event-target",
    //         debug_class_event_related_target = CLASS_PREFIX + "event-related-target";
    //     targetElement.classList.add( debug_class );
    //     targetElement.classList.add( debug_class_event_target );
    //     if( relatedTarget ) {
    //         relatedTarget.classList.add( debug_class );
    //         relatedTarget.classList.add( debug_class_event_related_target );
    //     }
    // }

    const leaveEvt = createDragEventFromTouch( targetElement, touchEvent, dragEvent, cancelable, document.defaultView, dataTransfer, relatedTarget );
    const cancelled = !targetElement.dispatchEvent( leaveEvt );

    dataStore.mode = DragDataStoreMode._DISCONNECTED;

    // if( DEBUG ) {
    //     const debug_class_event_target = CLASS_PREFIX + "event-target",
    //         debug_class_event_related_target = CLASS_PREFIX + "event-related-target";
    //     targetElement.classList.remove( debug_class_event_target );
    //     if( relatedTarget ) {
    //         relatedTarget.classList.remove( debug_class_event_related_target );
    //     }
    // }

    return cancelled;
}

/**
 * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
 */
export function determineDragOperation( effectAllowed:string, dropEffect:string ):string {

    // unitialized or all
    if( !effectAllowed || effectAllowed === ALLOWED_EFFECTS[ 7 ] ) {
        return dropEffect;
    }

    if( dropEffect === DROP_EFFECTS[ DROP_EFFECT.COPY ] ) {
        if( effectAllowed.indexOf( DROP_EFFECTS[ DROP_EFFECT.COPY ] ) === 0 ) {
            return DROP_EFFECTS[ DROP_EFFECT.COPY ];
        }
    }
    else if( dropEffect === DROP_EFFECTS[ DROP_EFFECT.LINK ] ) {
        if( effectAllowed.indexOf( DROP_EFFECTS[ DROP_EFFECT.LINK ] ) === 0 || effectAllowed.indexOf( "Link" ) > -1 ) {
            return DROP_EFFECTS[ DROP_EFFECT.LINK ];
        }
    }
    else if( dropEffect === DROP_EFFECTS[ DROP_EFFECT.MOVE ] ) {
        if( effectAllowed.indexOf( DROP_EFFECTS[ DROP_EFFECT.MOVE ] ) === 0 || effectAllowed.indexOf( "Move" ) > -1 ) {
            return DROP_EFFECTS[ DROP_EFFECT.MOVE ];
        }
    }

    return DROP_EFFECTS[ DROP_EFFECT.NONE ];
}
