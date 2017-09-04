// debug mode, which will highlight drop target, immediate user selection and events fired as you interact.
const DEBUG = false;

//<editor-fold desc="feature detection">

interface DetectedFeatures {
    draggable:boolean;
    dragEvents:boolean;
    touchEvents:boolean;
    userAgentSupportingNativeDnD:boolean;
}

function detectFeatures():DetectedFeatures {

    let features:DetectedFeatures = {
        dragEvents: ("ondragstart" in document.documentElement),
        draggable: ("draggable" in document.documentElement),
        touchEvents: ("ontouchstart" in document.documentElement),
        userAgentSupportingNativeDnD: undefined
    };

    const isBlinkEngine = !!((<any>window).chrome) || /chrome/i.test(navigator.userAgent);

    features.userAgentSupportingNativeDnD = !(
        // if is mobile safari or android browser -> no native dnd
        (/iPad|iPhone|iPod|Android/.test(navigator.userAgent))
        || // OR
        //if is blink(chrome/opera) with touch events enabled -> no native dnd
        (isBlinkEngine && features.touchEvents)
    );

    if (DEBUG) {
        Object.keys(features).forEach(function (key) {
            console.log("dnd-poly: detected feature '" + key + " = " + features[key] + "'");
        });
    }

    return features;
}

let supportsPassive:boolean;

function supportsPassiveEventListener():boolean {

    let supportsPassiveEventListeners = false;

    // reference https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md
    try {
        let opts = Object.defineProperty({}, "passive", {
            get: function () {
                supportsPassiveEventListeners = true;
            }
        });
        window.addEventListener("test", null, opts);
    }
        // tslint:disable-next-line:no-empty
    catch (e) {
    }

    return supportsPassiveEventListeners;
}

//</editor-fold>

//<editor-fold desc="public api">

// function signature for the dragImageTranslateOverride hook
export type DragImageTranslateOverrideFn = (// corresponding touchmove event
    event:TouchEvent,
    // the processed touch event viewport coordinates
    hoverCoordinates:Point,
    // the element under the calculated touch coordinates
    hoveredElement:HTMLElement,
    // callback for updating the drag image offset
    translateDragImageFn:(offsetX:number, offsetY:number) => void) => void;

export interface Config {
    // flag to force the polyfill being applied and not rely on internal feature detection
    forceApply?:boolean;
    // useful for when you want the default drag image but still want to apply
    // some static offset from touch coordinates to drag image coordinates
    // defaults to (0,0)
    dragImageOffset?:Point;
    // if the dragImage shall be centered on the touch coordinates
    // defaults to false
    dragImageCenterOnTouch?:boolean;
    // the drag and drop operation involves some processing. here you can specify in what interval this processing takes place.
    // defaults to 150ms
    iterationInterval?:number;
    // hook for custom logic that decides if a drag operation should start
    dragStartConditionOverride?:(event:TouchEvent) => boolean;
    // hook for custom logic that can manipulate the drag image translate offset
    dragImageTranslateOverride?:DragImageTranslateOverrideFn;
    // hook for custom logic that can override the default action based on the original touch event when the drag never started
    // be sure to call event.preventDefault() if handling the default action in the override to prevent the browser default.
    defaultActionOverride?: (event: TouchEvent) => void;
    // Drag action delay on touch devices ("hold to drag" functionality, useful for scrolling draggable items). Defaults to no delay.
    holdToDrag?: number;
}

// default config
const config:Config = {
    iterationInterval: 150,
};

export function polyfill(override?:Config):boolean {

    if (override) {
        // overwrite default config with user config
        Object.keys(override).forEach(function (key) {
            config[key] = override[key];
        });
    }

    // only do feature detection when config does not force apply the polyfill
    if (!config.forceApply) {

        // feature/browser detection
        const detectedFeatures = detectFeatures();

        // check if native drag and drop support is there
        if (detectedFeatures.userAgentSupportingNativeDnD
            && detectedFeatures.draggable
            && detectedFeatures.dragEvents) {
            // no polyfilling required
            return false;
        }
    }

    console.log("dnd-poly: Applying mobile drag and drop polyfill.");

    supportsPassive = supportsPassiveEventListener();

    // add listeners suitable for detecting a potential drag operation
    if (config.holdToDrag) {
        addDocumentListener("touchstart", onDelayTouchstart, false);
    } else {
        addDocumentListener("touchstart", onTouchstart, false);
    }

    return true;
}

//</editor-fold>

//<editor-fold desc="drag operation start/end">

// reference the currently active drag operation
let activeDragOperation:DragOperationController;

/**
 * event handler listening for initial events that possibly start a drag and drop operation.
 */
function onTouchstart(e:TouchEvent) {

    console.log("dnd-poly: global touchstart");

    // From the moment that the user agent is to initiate the drag-and-drop operation,
    // until the end of the drag-and-drop operation, device input events (e.g. mouse and keyboard events) must be suppressed.

    // only allow one drag operation at a time
    if (activeDragOperation) {
        console.log("dnd-poly: drag operation already active");
        return;
    }

    let dragTarget = tryFindDraggableTarget(e);

    // If there is no such element, then nothing is being dragged; abort these
    // steps, the drag-and-drop operation is never started.
    if (!dragTarget) {
        return;
    }

    try {
        activeDragOperation = new DragOperationController(e, config, <HTMLElement>dragTarget, dragOperationEnded);
    }
    catch (err) {
        dragOperationEnded(config, e, DragOperationState.CANCELLED);
        // rethrow exception after cleanup
        throw err;
    }
}

/**
 * Search for a possible draggable item upon an event that can initialize a drag operation.
 */
function tryFindDraggableTarget(event:TouchEvent):Element {

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
        if (el.draggable === false) {
            continue;
        }
        if (el.getAttribute && el.getAttribute("draggable") === "true") {
            return el;
        }
    } while ((el = <HTMLElement>el.parentNode) && el !== document.body);
}

/**
 * Implements callback invoked when a drag operation has ended or crashed.
 */
function dragOperationEnded(_config:Config, event:TouchEvent, state:DragOperationState) {

    // we need to make the default action happen only when no drag operation took place
    if (state === DragOperationState.POTENTIAL) {

        console.log("dnd-poly: Drag never started. Last event was " + event.type);

        // when lifecycle hook is present
        if (_config.defaultActionOverride) {

            try {

                _config.defaultActionOverride(event);

                if (event.defaultPrevented) {

                    console.log("dnd-poly: defaultActionOverride has taken care of triggering the default action. preventing default on original event");
                }

            }
            catch (e) {

                console.log("dnd-poly: error in defaultActionOverride: " + e);
            }
        }
    }

    // reset drag operation container
    activeDragOperation = null;
}

//</editor-fold>

//<editor-fold desc="drag operation">

/**
 * For tracking the different states of a drag operation.
 */
const enum DragOperationState {
    // initial state of a controller, if no movement is detected the operation ends with this state
    POTENTIAL,
        // after movement is detected the drag operation starts and keeps this state until it ends
    STARTED,
        // when the drag operation ended normally
    ENDED,
        // when the drag operation ended with a cancelled input event
    CANCELLED
}

// contains all possible values of the effectAllowed property
const enum EFFECT_ALLOWED {
    NONE = 0,
    COPY = 1,
    COPY_LINK = 2,
    COPY_MOVE = 3,
    LINK = 4,
    LINK_MOVE = 5,
    MOVE = 6,
    ALL = 7
}

const ALLOWED_EFFECTS = ["none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all"];

// contains all possible values of the dropEffect property
const enum DROP_EFFECT {
    NONE = 0,
    COPY = 1,
    MOVE = 2,
    LINK = 3,
}

const DROP_EFFECTS = ["none", "copy", "move", "link"];

// cross-browser css transform property prefixes
const TRANSFORM_CSS_VENDOR_PREFIXES = ["", "-webkit-"];
// css classes
const CLASS_PREFIX = "dnd-poly-";
const CLASS_DRAG_IMAGE = CLASS_PREFIX + "drag-image";
const CLASS_DRAG_IMAGE_SNAPBACK = CLASS_PREFIX + "snapback";
const CLASS_DRAG_OPERATION_ICON = CLASS_PREFIX + "icon";

/**
 * Aims to implement the HTML5 d'n'd spec (https://html.spec.whatwg.org/multipage/interaction.html#dnd) as close as it can get.
 * Note that all props that are private should start with an underscore to enable better minification.
 *
 * TODO remove lengthy spec comments in favor of short references to the spec
 */
class DragOperationController {

    private _dragOperationState:DragOperationState = DragOperationState.POTENTIAL;

    private _dragImage:HTMLElement;
    private _dragImageTransforms:string[];
    private _dragImagePageCoordinates:Point; // the current page coordinates of the dragImage
    private _dragImageOffset:Point; // offset of the drag image relative to the coordinates

    private _currentHotspotCoordinates:Point;    // the point relative to viewport for determining the immediate user selection

    private _immediateUserSelection:HTMLElement = null;  // the element the user currently hovers while dragging
    private _currentDropTarget:HTMLElement = null;   // the element that was selected as a valid drop target by the d'n'd operation

    private _dragDataStore:DragDataStore;
    private _dataTransfer:DataTransfer;

    private _currentDragOperation:string;    // the current drag operation set according to the d'n'd processing model

    private _initialTouch:Touch;  // the identifier for the touch that initiated the drag operation
    private _touchMoveHandler:EventListener;
    private _touchEndOrCancelHandler:EventListener;
    private _lastTouchEvent:TouchEvent;

    private _iterationLock:boolean;
    private _iterationIntervalId:number;

    constructor(private _initialEvent:TouchEvent,
                private _config:Config,
                private _sourceNode:HTMLElement,
                private _dragOperationEndedCb:(config:Config, event:TouchEvent, state:DragOperationState) => void) {

        console.log("dnd-poly: setting up potential drag operation..");

        this._lastTouchEvent = _initialEvent;
        this._initialTouch = _initialEvent.changedTouches[0];

        // create bound event listeners
        this._touchMoveHandler = this._onTouchMove.bind(this);
        this._touchEndOrCancelHandler = this._onTouchEndOrCancel.bind(this);
        addDocumentListener("touchmove", this._touchMoveHandler, false);
        addDocumentListener("touchend", this._touchEndOrCancelHandler, false);
        addDocumentListener("touchcancel", this._touchEndOrCancelHandler, false);

        // the only thing we do is setup the touch listeners. if drag will really start is decided in touch move handler.

        //<spec>

        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
        // 3. Establish which DOM node is the source node, as follows:
        // If it is a selection that is being dragged, then the source node is the text node that the user started the drag on (typically the text node
        // that the user originally clicked). If the user did not specify a particular node, for example if the user just told the user agent to begin
        // a drag of "the selection", then the source node is the first text node containing a part of the selection.  Otherwise, if it is an element
        // that is being dragged, then the source node is the element that is being dragged.  Otherwise, the source node is part of another document or
        // application. When this specification requires that an event be dispatched at the source node in this case, the user agent must instead
        // follow the platform-specific conventions relevant to that situation.

        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
        // 4. Determine the list of dragged nodes, as follows:

        //    If it is a selection that is being dragged, then the list of dragged nodes contains, in tree order, every node that is partially or
        // completely included in the selection (including all their ancestors).

        //    Otherwise, the list of dragged nodes contains only the source node, if any.

        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
        // 5. If it is a selection that is being dragged, then add an item to the drag data store item list, with its properties set as follows:

        //The drag data item type string
        //"text/plain"
        //The drag data item kind
        //Plain Unicode string
        //The actual data
        //The text of the selection
        //Otherwise, if any files are being dragged, then add one item per file to the drag data store item list, with their properties set as follows:
        //
        //The drag data item type string
        //The MIME type of the file, if known, or "application/octet-stream" otherwise.
        //    The drag data item kind
        //File
        //The actual data
        //The file's contents and name.
        //Dragging files can currently only happen from outside a browsing context, for example from a file system manager application.
        //
        //    If the drag initiated outside of the application, the user agent must add items to the drag data store item list as appropriate for the data
        // being dragged, honoring platform conventions where appropriate; however, if the platform conventions do not use MIME types to label dragged
        // data, the user agent must make a best-effort attempt to map the types to MIME types, and, in any case, all the drag data item type strings must
        // be converted to ASCII lowercase.  Perform drag-and-drop initialization steps defined in any other applicable specifications.

        //</spec>
    }

    //<editor-fold desc="setup/teardown">

    /**
     * Setup dragImage, input listeners and the drag
     * and drop process model iteration interval.
     */
    private _setup():boolean {
        console.log("dnd-poly: starting drag and drop operation");

        this._dragOperationState = DragOperationState.STARTED;

        this._currentDragOperation = DROP_EFFECTS[DROP_EFFECT.NONE];

        this._dragDataStore = {
            _data: {},
            _effectAllowed: undefined,
            _mode: DragDataStoreMode.PROTECTED,
            _types: [],
        };

        this._currentHotspotCoordinates = {
            x: null,
            y: null
        };

        this._dragImagePageCoordinates = {
            x: null,
            y: null
        };

        let dragImageSrc:HTMLElement = this._sourceNode;

        this._dataTransfer = new DataTransfer(this._dragDataStore, (element:HTMLElement, x:number, y:number) => {

            dragImageSrc = element;

            if (typeof x === "number" || typeof y === "number") {
                this._dragImageOffset = {
                    x: x || 0,
                    y: y || 0
                };
            }
        });

        // 9. Fire a DND event named dragstart at the source node.
        this._dragDataStore._mode = DragDataStoreMode.READWRITE;
        this._dataTransfer.dropEffect = DROP_EFFECTS[DROP_EFFECT.NONE];
        if (dispatchDragEvent("dragstart", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer)) {
            console.log("dnd-poly: dragstart cancelled");
            // dragstart has been prevented -> cancel d'n'd
            this._dragOperationState = DragOperationState.CANCELLED;
            this._cleanup();
            return false;
        }

        updateCentroidCoordinatesOfTouchesIn("page", this._lastTouchEvent, this._dragImagePageCoordinates);
        this._dragImage = createDragImage(dragImageSrc);
        this._dragImageTransforms = extractTransformStyles(this._dragImage);

        if (!this._dragImageOffset) {

            // apply specific offset
            if (this._config.dragImageOffset) {

                this._dragImageOffset = {
                    x: this._config.dragImageOffset.x,
                    y: this._config.dragImageOffset.y
                };
            }
            // center drag image on touch coordinates
            else if (this._config.dragImageCenterOnTouch) {

                const cs = getComputedStyle(dragImageSrc);
                this._dragImageOffset = {
                    x: 0 - parseInt(cs.marginLeft, 10),
                    y: 0 - parseInt(cs.marginTop, 10)
                };
            }
            // by default initialize drag image offset the same as desktop
            else {

                const targetRect = dragImageSrc.getBoundingClientRect();
                const cs = getComputedStyle(dragImageSrc);
                this._dragImageOffset = {
                    x: targetRect.left - this._initialTouch.clientX - parseInt(cs.marginLeft, 10) + targetRect.width / 2,
                    y: targetRect.top - this._initialTouch.clientY - parseInt(cs.marginTop, 10) + targetRect.height / 2
                };
            }
        }

        translateDragImage(this._dragImage, this._dragImagePageCoordinates, this._dragImageTransforms, this._dragImageOffset, this._config.dragImageCenterOnTouch);
        document.body.appendChild(this._dragImage);

        // 10. Initiate the drag-and-drop operation in a manner consistent with platform conventions, and as described below.
        this._iterationIntervalId = setInterval(() => {

            // If the user agent is still performing the previous iteration of the sequence (if any) when the next iteration becomes due,
            // abort these steps for this iteration (effectively "skipping missed frames" of the drag-and-drop operation).
            if (this._iterationLock) {
                console.log("dnd-poly: iteration skipped because previous iteration hast not yet finished.");
                return;
            }
            this._iterationLock = true;

            this._dragAndDropProcessModelIteration();

            this._iterationLock = false;
        }, this._config.iterationInterval);

        return true;
    }

    private _cleanup() {

        console.log("dnd-poly: cleanup");

        if (this._iterationIntervalId) {
            clearInterval(this._iterationIntervalId);
            this._iterationIntervalId = null;
        }

        removeDocumentListener("touchmove", this._touchMoveHandler);
        removeDocumentListener("touchend", this._touchEndOrCancelHandler);
        removeDocumentListener("touchcancel", this._touchEndOrCancelHandler);

        if (this._dragImage) {
            this._dragImage.parentNode.removeChild(this._dragImage);
            this._dragImage = null;
        }

        this._dragOperationEndedCb(this._config, this._lastTouchEvent, this._dragOperationState);
    }

    //</editor-fold>

    //<editor-fold desc="touch handlers">

    private _onTouchMove(event:TouchEvent) {

        // filter unrelated touches
        if (isTouchIdentifierContainedInTouchEvent(event, this._initialTouch.identifier) === false) {
            return;
        }

        // update the reference to the last received touch event
        this._lastTouchEvent = event;

        // drag operation did not start yet but on movement it should start
        if (this._dragOperationState === DragOperationState.POTENTIAL) {

            let startDrag:boolean;

            // is a lifecycle hook present?
            if (this._config.dragStartConditionOverride) {

                try {
                    startDrag = this._config.dragStartConditionOverride(event);
                }
                catch (e) {
                    console.error("dnd-poly: error in dragStartConditionOverride hook: " + e);
                    startDrag = false;
                }
            }
            else {

                // by default only allow a single moving finger to initiate a drag operation
                startDrag = (event.touches.length === 1);
            }

            if (!startDrag) {

                this._cleanup();
                return;
            }

            // setup will return true when drag operation starts
            if (this._setup() === true) {

                // prevent scrolling when drag operation starts
                this._initialEvent.preventDefault();
                event.preventDefault();
            }

            return;
        }

        console.log("dnd-poly: moving draggable..");

        // we emulate d'n'd so we dont want any defaults to apply
        event.preventDefault();

        // populate shared coordinates from touch event
        updateCentroidCoordinatesOfTouchesIn("client", event, this._currentHotspotCoordinates);
        updateCentroidCoordinatesOfTouchesIn("page", event, this._dragImagePageCoordinates);

        if (this._config.dragImageTranslateOverride) {

            try {

                let handledDragImageTranslate = false;

                this._config.dragImageTranslateOverride(
                    event,
                    {
                        x: this._currentHotspotCoordinates.x,
                        y: this._currentHotspotCoordinates.y
                    },
                    this._immediateUserSelection,
                    (offsetX:number, offsetY:number) => {

                        // preventing translation of drag image when there was a drag operation cleanup meanwhile
                        if (!this._dragImage) {
                            return;
                        }

                        handledDragImageTranslate = true;

                        this._currentHotspotCoordinates.x += offsetX;
                        this._currentHotspotCoordinates.y += offsetY;
                        this._dragImagePageCoordinates.x += offsetX;
                        this._dragImagePageCoordinates.y += offsetY;

                        translateDragImage(
                            this._dragImage,
                            this._dragImagePageCoordinates,
                            this._dragImageTransforms,
                            this._dragImageOffset,
                            this._config.dragImageCenterOnTouch
                        );
                    }
                );

                if (handledDragImageTranslate) {
                    return;
                }
            }
            catch (e) {
                console.log("dnd-poly: error in dragImageTranslateOverride hook: " + e);
            }
        }

        translateDragImage(this._dragImage, this._dragImagePageCoordinates, this._dragImageTransforms, this._dragImageOffset, this._config.dragImageCenterOnTouch);
    }

    private _onTouchEndOrCancel(event:TouchEvent) {

        // filter unrelated touches
        if (isTouchIdentifierContainedInTouchEvent(event, this._initialTouch.identifier) === false) {
            return;
        }

        // let the dragImageTranslateOverride know that its over
        if (this._config.dragImageTranslateOverride) {
            try {
                /* tslint:disable */
                this._config.dragImageTranslateOverride(undefined, undefined, undefined, function () {
                });
            }
            catch (e) {
                console.log("dnd-poly: error in dragImageTranslateOverride hook: " + e);
            }
        }

        // drag operation did not even start
        if (this._dragOperationState === DragOperationState.POTENTIAL) {
            this._cleanup();
            return;
        }

        // we emulate d'n'd so we dont want any defaults to apply
        event.preventDefault();

        this._dragOperationState = (event.type === "touchcancel") ? DragOperationState.CANCELLED : DragOperationState.ENDED;
    }

    //</editor-fold>

    //<editor-fold desc="dnd spec logic">

    /**
     * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
     */
    private _dragAndDropProcessModelIteration():void {

        if (DEBUG) {
            var debug_class = CLASS_PREFIX + "debug",
                debug_class_user_selection = CLASS_PREFIX + "immediate-user-selection",
                debug_class_drop_target = CLASS_PREFIX + "current-drop-target";
        }

        const previousDragOperation = this._currentDragOperation;

        // Fire a DND event named drag event at the source node.
        this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
        this._dataTransfer.dropEffect = DROP_EFFECTS[DROP_EFFECT.NONE];
        const dragCancelled = dispatchDragEvent("drag", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer);
        if (dragCancelled) {
            console.log("dnd-poly: drag event cancelled.");
            // If this event is canceled, the user agent must set the current drag operation to "none" (no drag operation).
            this._currentDragOperation = DROP_EFFECTS[DROP_EFFECT.NONE];
        }

        // Otherwise, if the user ended the drag-and-drop operation (e.g. by releasing the mouse button in a mouse-driven drag-and-drop interface),
        // or if the drag event was canceled, then this will be the last iteration.
        if (dragCancelled || this._dragOperationState === DragOperationState.ENDED || this._dragOperationState === DragOperationState.CANCELLED) {

            const dragFailed = this._dragOperationEnded(this._dragOperationState);

            // if drag failed transition snap back
            if (dragFailed) {

                applyDragImageSnapback(this._sourceNode, this._dragImage, this._dragImageTransforms, () => {
                    this._finishDragOperation();
                });
                return;
            }

            // Otherwise immediately
            // Fire a DND event named dragend at the source node.
            this._finishDragOperation();
            return;
        }

        // If the drag event was not canceled and the user has not ended the drag-and-drop operation,
        // check the state of the drag-and-drop operation, as follows:
        const newUserSelection:HTMLElement = <HTMLElement>document.elementFromPoint(this._currentHotspotCoordinates.x, this._currentHotspotCoordinates.y);

        console.log("dnd-poly: new immediate user selection is: " + newUserSelection);

        const previousTargetElement = this._currentDropTarget;

        // If the user is indicating a different immediate user selection than during the last iteration (or if this is the first iteration),
        // and if this immediate user selection is not the same as the current target element,
        // then fire a DND event named dragexit at the current target element,
        // and then update the current target element as follows:
        if (newUserSelection !== this._immediateUserSelection && newUserSelection !== this._currentDropTarget) {

            if (DEBUG) {

                if (this._immediateUserSelection) {
                    this._immediateUserSelection.classList.remove(debug_class_user_selection);
                }

                if (newUserSelection) {
                    newUserSelection.classList.add(debug_class);
                    newUserSelection.classList.add(debug_class_user_selection);
                }
            }

            this._immediateUserSelection = newUserSelection;

            if (this._currentDropTarget !== null) {
                this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
                this._dataTransfer.dropEffect = DROP_EFFECTS[DROP_EFFECT.NONE];
                dispatchDragEvent("dragexit", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
            }

            // If the new immediate user selection is null
            if (this._immediateUserSelection === null) {
                //Set the current target element to null also.
                this._currentDropTarget = this._immediateUserSelection;

                console.log("dnd-poly: current drop target changed to null");
            }
            // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
            // If the new immediate user selection is in a non-DOM document or application
            // else if() {
            //      Set the current target element to the immediate user selection.
            //      this.currentDropTarget = this.immediateUserSelection;
            //      return;
            // }
            // Otherwise
            else {
                // Fire a DND event named dragenter at the immediate user selection.
                //the polyfill cannot determine if a handler even exists as browsers do to silently
                // allow drop when no listener existed, so this event MUST be handled by the client
                this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
                this._dataTransfer.dropEffect = determineDropEffect(this._dragDataStore._effectAllowed, this._sourceNode);
                if (dispatchDragEvent("dragenter", this._immediateUserSelection, this._lastTouchEvent, this._dragDataStore, this._dataTransfer)) {
                    console.log("dnd-poly: dragenter default prevented");
                    // If the event is canceled, then set the current target element to the immediate user selection.
                    this._currentDropTarget = this._immediateUserSelection;
                    this._currentDragOperation = determineDragOperation(this._dataTransfer.effectAllowed, this._dataTransfer.dropEffect);
                }
                // Otherwise, run the appropriate step from the following list:
                else {

                    // NO DROPZONE SUPPORT SINCE NATIVE IMPLEMENTATIONS IN BROWSERS ALSO DO NOT
                    //console.log( "dnd-poly: dragenter not prevented, searching for dropzone.." );
                    //var newTarget = DragOperationController.FindDropzoneElement( this.immediateUserSelection );

                    // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
                    // If the current target element is a text field (e.g. textarea, or an input element whose type attribute is in the Text state) or an
                    // editable element, and the drag data store item list has an item with the drag data item type string "text/plain" and the drag data
                    // item kind Plain Unicode string
                    //if( ElementIsTextDropzone( this.immediateUserSelection, this.dragDataStore ) ) {
                    //Set the current target element to the immediate user selection anyway.
                    //this.currentDropTarget = this.immediateUserSelection;
                    //}
                    //else
                    // If the current target element is an element with a dropzone attribute that matches the drag data store
                    //if( newTarget === this.immediateUserSelection &&
                    //    DragOperationController.GetOperationForMatchingDropzone( this.immediateUserSelection, this.dragDataStore ) !== "none" ) {
                    // Set the current target element to the immediate user selection anyway.
                    //    this.currentDropTarget = this.immediateUserSelection;
                    //}
                    // If the immediate user selection is an element that itself has an ancestor element
                    // with a dropzone attribute that matches the drag data store
                    // NO DROPZONE SUPPORT SINCE NATIVE IMPLEMENTATIONS IN BROWSERS ALSO DO NOT
                    //else if( newTarget !== null && DragOperationController.GetOperationForMatchingDropzone( newTarget, this.dragDataStore ) ) {

                    // If the immediate user selection is new target, then leave the current target element unchanged.

                    // Otherwise, fire a DND event named dragenter at new target, with the current target element
                    // as the specific related target. Then, set the current target element to new target,
                    // regardless of whether that event was canceled or not.
                    //this.dragenter( newTarget, this.currentDropTarget );
                    //this.currentDropTarget = newTarget;
                    //}
                    // If the current target element is not the body element
                    //else
                    if (this._immediateUserSelection !== document.body) {
                        // Fire a DND event named dragenter at the body element, and set the current target element to the body element, regardless of
                        // whether that event was canceled or not.
                        // Note: If the body element is null, then the event will be fired at the Document object (as
                        // required by the definition of the body element), but the current target element would be set to null, not the Document object.

                        // We do not listen to what the spec says here because this results in doubled events on the body/document because if the first one
                        // was not cancelled it will have bubbled up to the body already ;)
                        //  this.dragenter( window.document.body );
                        this._currentDropTarget = document.body;
                    }
                    // Otherwise
                    //else {
                    // leave the current drop target unchanged
                    //}
                }
            }
        }

        // If the previous step caused the current target element to change,
        // and if the previous target element was not null or a part of a non-DOM document,
        // then fire a DND event named dragleave at the previous target element.
        if (previousTargetElement !== this._currentDropTarget && (isDOMElement(previousTargetElement) )) {

            if (DEBUG) {
                previousTargetElement.classList.remove(debug_class_drop_target);
            }

            console.log("dnd-poly: current drop target changed.");

            this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
            this._dataTransfer.dropEffect = DROP_EFFECTS[DROP_EFFECT.NONE];
            dispatchDragEvent("dragleave", previousTargetElement, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false, this._currentDropTarget);
        }

        // If the current target element is a DOM element, then fire a DND event named dragover at this current target element.
        if (isDOMElement(this._currentDropTarget)) {

            if (DEBUG) {
                this._currentDropTarget.classList.add(debug_class);
                this._currentDropTarget.classList.add(debug_class_drop_target);
            }

            // If the dragover event is not canceled, run the appropriate step from the following list:
            this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
            this._dataTransfer.dropEffect = determineDropEffect(this._dragDataStore._effectAllowed, this._sourceNode);
            if (dispatchDragEvent("dragover", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer) === false) {

                console.log("dnd-poly: dragover not prevented on possible drop-target.");
                // NO DROPZONE SUPPORT SINCE NATIVE IMPLEMENTATIONS IN BROWSERS ALSO DO NOT

                // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
                // If the current target element is a text field (e.g. textarea, or an input element whose type attribute is in the Text state) or
                // an editable element, and the drag data store item list has an item with the drag data item type string "text/plain" and the drag
                // data item kind Plain Unicode string
                //if( ElementIsTextDropzone( this.currentDropTarget, this.dragDataStore ) ) {
                // Set the current drag operation to either "copy" or "move", as appropriate given the platform conventions.
                //this.currentDragOperation = "copy"; //or move. spec says its platform specific behaviour.
                //}
                //else {
                // If the current target element is an element with a dropzone attribute that matches the drag data store
                //this.currentDragOperation = DragOperationController.GetOperationForMatchingDropzone( this.currentDropTarget, this.dragDataStore );
                //}
                // when dragover is not prevented and no dropzones are there, no drag operation
                this._currentDragOperation = DROP_EFFECTS[DROP_EFFECT.NONE];
            }
            // Otherwise (if the dragover event is canceled), set the current drag operation based on the values of the effectAllowed and
            // dropEffect attributes of the DragEvent object's dataTransfer object as they stood after the event dispatch finished
            else {

                console.log("dnd-poly: dragover prevented.");

                this._currentDragOperation = determineDragOperation(this._dataTransfer.effectAllowed, this._dataTransfer.dropEffect);
            }
        }

        console.log("dnd-poly: d'n'd iteration ended. current drag operation: " + this._currentDragOperation);

        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
        // Otherwise, if the current target element is not a DOM element, use platform-specific mechanisms to determine what drag operation is
        // being performed (none, copy, link, or move), and set the current drag operation accordingly.

        //Update the drag feedback (e.g. the mouse cursor) to match the current drag operation, as follows:
        // ---------------------------------------------------------------------------------------------------------
        // Drag operation   |	Feedback
        // "copy"	        |  Data will be copied if dropped here.
        // "link"	        |  Data will be linked if dropped here.
        // "move"	        |  Data will be moved if dropped here.
        // "none"	        |  No operation allowed, dropping here will cancel the drag-and-drop operation.
        // ---------------------------------------------------------------------------------------------------------

        if (previousDragOperation !== this._currentDragOperation) {
            this._dragImage.classList.remove(CLASS_PREFIX + previousDragOperation);
        }

        const currentDragOperationClass = CLASS_PREFIX + this._currentDragOperation;

        if (this._dragImage.classList.contains(currentDragOperationClass) === false) {
            this._dragImage.classList.add(currentDragOperationClass);
        }
    }

    /**
     * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
     */
    private _dragOperationEnded(state:DragOperationState):boolean {

        console.log("dnd-poly: drag operation end detected with " + this._currentDragOperation);

        if (DEBUG) {

            var debug_class_user_selection = CLASS_PREFIX + "immediate-user-selection",
                debug_class_drop_target = CLASS_PREFIX + "current-drop-target";

            if (this._currentDropTarget) {
                this._currentDropTarget.classList.remove(debug_class_drop_target);

            }
            if (this._immediateUserSelection) {
                this._immediateUserSelection.classList.remove(debug_class_user_selection);
            }
        }

        //var dropped:boolean = undefined;

        // Run the following steps, then stop the drag-and-drop operation:

        // If the current drag operation is "none" (no drag operation), or,
        // if the user ended the drag-and-drop operation by canceling it (e.g. by hitting the Escape key), or
        // if the current target element is null, then the drag operation failed.
        const dragFailed = (this._currentDragOperation === DROP_EFFECTS[DROP_EFFECT.NONE]
            || this._currentDropTarget === null
            || state === DragOperationState.CANCELLED);
        if (dragFailed) {

            // Run these substeps:

            // Let dropped be false.
            //dropped = false;

            // If the current target element is a DOM element, fire a DND event named dragleave at it;
            if (isDOMElement(this._currentDropTarget)) {
                this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
                this._dataTransfer.dropEffect = DROP_EFFECTS[DROP_EFFECT.NONE];
                dispatchDragEvent("dragleave", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);
            }

            // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
            // otherwise, if it is not null, use platform-specific conventions for drag cancellation.
            //else if( this.currentDropTarget !== null ) {
            //}
        }
        // Otherwise, the drag operation was as success; run these substeps:
        else {

            // Let dropped be true.
            //dropped = true;

            // If the current target element is a DOM element, fire a DND event named drop at it;
            if (isDOMElement(this._currentDropTarget)) {

                // If the event is canceled, set the current drag operation to the value of the dropEffect attribute of the
                // DragEvent object's dataTransfer object as it stood after the event dispatch finished.

                this._dragDataStore._mode = DragDataStoreMode.READONLY;
                this._dataTransfer.dropEffect = this._currentDragOperation;
                if (dispatchDragEvent("drop", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer) ===
                    true) {

                    this._currentDragOperation = this._dataTransfer.dropEffect;
                }
                // Otherwise, the event is not canceled; perform the event's default action, which depends on the exact target as follows:
                else {

                    // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
                    // If the current target element is a text field (e.g. textarea, or an input element whose type attribute is in the Text state)
                    // or an editable element,
                    // and the drag data store item list has an item with the drag data item type string "text/plain"
                    // and the drag data item kind Plain Unicode string
                    //if( ElementIsTextDropzone( this.currentDropTarget, this.dragDataStore ) ) {
                    // Insert the actual data of the first item in the drag data store item list to have a drag data item type string of
                    // "text/plain" and a drag data item kind that is Plain Unicode string into the text field or editable element in a manner
                    // consistent with platform-specific conventions (e.g. inserting it at the current mouse cursor position, or inserting it at
                    // the end of the field).
                    //}
                    // Otherwise
                    //else {
                    // Reset the current drag operation to "none".
                    this._currentDragOperation = DROP_EFFECTS[DROP_EFFECT.NONE];
                    //}
                }
            }
            // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
            // otherwise, use platform-specific conventions for indicating a drop.
            //else {
            //}
        }

        return dragFailed;

        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
        //if( this.dragend( this.sourceNode ) ) {
        //    return;
        //}

        // Run the appropriate steps from the following list as the default action of the dragend event:

        //if( !dropped ) {
        //    return;
        //}
        // dropped is true

        //if( this.currentDragOperation !== "move" ) {
        //    return;
        //}
        //// drag operation is move
        //
        //if( ElementIsTextDropzone( this.currentDropTarget ) === false ) {
        //    return;
        //}
        //// element is textfield
        //
        //// and the source of the drag-and-drop operation is a selection in the DOM
        //if( this.sourceNode.nodeType === 1 ) {
        //    // The user agent should delete the range representing the dragged selection from the DOM.
        //}
        //// and the source of the drag-and-drop operation is a selection in a text field
        //else if( this.sourceNode.nodeType === 3 ) {
        //    // The user agent should delete the dragged selection from the relevant text field.
        //}
        //// Otherwise, The event has no default action.
    }

    // dispatch dragend event and cleanup drag operation
    private _finishDragOperation():void {
        console.log("dnd-poly: dragimage snap back transition ended");

        // Fire a DND event named dragend at the source node.
        this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
        this._dataTransfer.dropEffect = this._currentDragOperation;
        dispatchDragEvent("dragend", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false);

        // drag operation over and out
        this._dragOperationState = DragOperationState.ENDED;
        this._cleanup();
    }

    //</editor-fold>
}

//</editor-fold>

//<editor-fold desc="DataTransfer/DragDataStore">

/**
 * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#drag-data-store-mode
 */
const enum DragDataStoreMode {
    _DISCONNECTED, // adding an extra mode here because we need a special state to disconnect the data store from dataTransfer instance
    READONLY,
    READWRITE,
    PROTECTED
}

/**
 * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#the-drag-data-store
 */
interface DragDataStore {
    _mode:DragDataStoreMode;
    _data:{ [type:string]:any };
    _types:Array<string>;
    _effectAllowed:string;
}

/**
 * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#datatransfer
 * TODO fail with errors when somebody uses it wrong so they know they are doing it wrong?
 */
class DataTransfer {

    private _dropEffect:string = DROP_EFFECTS[DROP_EFFECT.NONE];

    constructor(private _dataStore:DragDataStore,
                private _setDragImageHandler:(image:Element, x:number, y:number) => void) {
    }

    //public get files():FileList {
    //    return undefined;
    //}
    //
    //public get items():DataTransferItemList {
    //    return undefined;
    //}

    public get types():ReadonlyArray<string> {
        if (this._dataStore._mode !== DragDataStoreMode._DISCONNECTED) {
            return Object.freeze(this._dataStore._types);
        }
    }

    public setData(type:string, data:string):void {
        if (this._dataStore._mode === DragDataStoreMode.READWRITE) {

            if (type.indexOf(" ") > -1) {
                throw new Error("illegal arg: type contains space");
            }

            this._dataStore._data[type] = data;

            if (this._dataStore._types.indexOf(type) === -1) {
                this._dataStore._types.push(type);
            }
        }
    }

    public getData(type:string):string {
        if (this._dataStore._mode === DragDataStoreMode.READONLY
            || this._dataStore._mode === DragDataStoreMode.READWRITE) {
            return this._dataStore._data[type] || "";
        }
    }

    public clearData(format?:string):void {
        if (this._dataStore._mode === DragDataStoreMode.READWRITE) {
            // delete data for format
            if (format && this._dataStore._data[format]) {
                delete this._dataStore._data[format];
                var index = this._dataStore._types.indexOf(format);
                if (index > -1) {
                    this._dataStore._types.splice(index, 1);
                }
                return;
            }
            // delete all data
            this._dataStore._data = {};
            this._dataStore._types = [];
        }
    }

    public setDragImage(image:Element, x:number, y:number):void {
        if (this._dataStore._mode === DragDataStoreMode.READWRITE) {
            this._setDragImageHandler(image, x, y);
        }
    }

    public get effectAllowed() {
        return this._dataStore._effectAllowed;
    }

    public set effectAllowed(value) {
        if (this._dataStore._mode === DragDataStoreMode.READWRITE
            && ALLOWED_EFFECTS.indexOf(value) > -1) {
            this._dataStore._effectAllowed = value;
        }
    }

    public get dropEffect() {
        return this._dropEffect;
    }

    public set dropEffect(value) {
        if (this._dataStore._mode !== DragDataStoreMode._DISCONNECTED
            && ALLOWED_EFFECTS.indexOf(value) > -1) {
            this._dropEffect = value;
        }
    }
}

//</editor-fold>

//<editor-fold desc="util">

export interface Point {
    x:number;
    y:number;
}

function addDocumentListener(ev:string, handler:EventListener, passive:boolean = true) {

    (document as EventTarget).addEventListener(ev, handler, supportsPassive ? {passive: passive} : false);
}

function removeDocumentListener(ev:string, handler:EventListener) {
    document.removeEventListener(ev, handler);
}

function average(array:Array<number>) {
    if (array.length === 0) {
        return 0;
    }
    return array.reduce((function (s, v) {
        return v + s;
    }), 0) / array.length;
}

function isDOMElement(object:any) {
    return object && object.tagName;
}

function isTouchIdentifierContainedInTouchEvent(newTouch:TouchEvent, touchIdentifier:number) {
    for (let i = 0; i < newTouch.changedTouches.length; i++) {
        const touch = newTouch.changedTouches[i];
        if (touch.identifier === touchIdentifier) {
            return true;
        }
    }
    return false;
}

function createDragEventFromTouch(targetElement:Element,
                                  e:TouchEvent,
                                  type:string,
                                  cancelable:boolean,
                                  window:Window,
                                  dataTransfer:DataTransfer,
                                  relatedTarget:Element = null) {

    const touch:Touch = e.changedTouches[0];

    const dndEvent:DragEvent = <DragEvent>new Event(type, {
        bubbles: true,
        cancelable: cancelable
    });

    // cast our polyfill
    (dndEvent as any).dataTransfer = <any>dataTransfer;
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
 * Calc center of polygon spanned by multiple touches in page (full page size, with hidden scrollable area) coordinates
 * or in viewport (screen coordinates) coordinates.
 */
function updateCentroidCoordinatesOfTouchesIn(coordinateProp:string, event:TouchEvent, outPoint:Point):void {
    const pageXs:Array<number> = [], pageYs:Array<number> = [];
    for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        pageXs.push(touch[coordinateProp + "X"]);
        pageYs.push(touch[coordinateProp + "Y"]);
    }
    outPoint.x = average(pageXs);
    outPoint.y = average(pageYs);
}

function prepareNodeCopyAsDragImage(srcNode:HTMLElement, dstNode:HTMLElement) {
    // Is this node an element?
    if (srcNode.nodeType === 1) {

        // Clone the style
        const cs = getComputedStyle(srcNode);
        for (let i = 0; i < cs.length; i++) {
            const csName = cs[i];
            dstNode.style.setProperty(csName, cs.getPropertyValue(csName), cs.getPropertyPriority(csName));
        }

        // no interaction with the drag image, pls! this is also important to make the drag image transparent for hit-testing
        // hit testing is done in the drag and drop iteration to find the element the user currently is hovering over while dragging.
        // if pointer-events is not none or a browser does behave in an unexpected way than the hit test transparency on the drag image
        // will break
        dstNode.style.pointerEvents = "none";

        // Remove any potential conflict attributes
        dstNode.removeAttribute("id");
        dstNode.removeAttribute("class");
        dstNode.removeAttribute("draggable");
    }

    // Do the same for the children
    if (srcNode.hasChildNodes()) {
        for (let i = 0; i < srcNode.childNodes.length; i++) {
            prepareNodeCopyAsDragImage(<HTMLElement>srcNode.childNodes[i], <HTMLElement>dstNode.childNodes[i]);
        }
    }
}

function createDragImage(sourceNode:HTMLElement):HTMLElement {

    const dragImage = <HTMLElement>sourceNode.cloneNode(true);

    // this removes any id's and stuff that could interfere with drag and drop
    prepareNodeCopyAsDragImage(sourceNode, dragImage);

    // set layout styles for freely moving it around
    dragImage.style.position = "absolute";
    dragImage.style.left = "0px";
    dragImage.style.top = "0px";
    // on top of all
    dragImage.style.zIndex = "999999";

    // add polyfill class for default styling
    dragImage.classList.add(CLASS_DRAG_IMAGE);
    dragImage.classList.add(CLASS_DRAG_OPERATION_ICON);

    return dragImage;
}

function extractTransformStyles(sourceNode:HTMLElement):string[] {

    return TRANSFORM_CSS_VENDOR_PREFIXES.map(function (prefix) {

        let transform = sourceNode.style[prefix + "transform"];

        if (!transform || transform === "none") {
            return "";
        }

        // TODO what about translateX(x), translateY(x), translateZ(z), translate3d(x,y,z), matrix(*,*,*,*,x,y) ?

        // removes translate(x,y)
        return transform.replace(/translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g, "");
    });
}

function translateDragImage(dragImage:HTMLElement, pnt:Point, originalTransforms:string[], offset?:Point, centerOnCoordinates = true):void {

    let x = pnt.x, y = pnt.y;

    if (offset) {
        x += offset.x;
        y += offset.y;
    }

    if (centerOnCoordinates) {
        x -= (parseInt(<any>dragImage.offsetWidth, 10) / 2);
        y -= (parseInt(<any>dragImage.offsetHeight, 10) / 2);
    }

    // using translate3d for best performance
    const translate = "translate3d(" + x + "px," + y + "px, 0)";

    for (let i = 0; i < TRANSFORM_CSS_VENDOR_PREFIXES.length; i++) {
        const transformProp = TRANSFORM_CSS_VENDOR_PREFIXES[i] + "transform";
        dragImage.style[transformProp] = translate + " " + originalTransforms[i];
    }
}

/**
 * calculates the coordinates of the drag source and transitions the drag image to those coordinates.
 * the drag operation is finished after the transition has ended.
 */
function applyDragImageSnapback(sourceEl:HTMLElement, dragImage:HTMLElement, dragImageTransforms:string[], transitionEndCb:Function):void {

    const cs = getComputedStyle(sourceEl);

    if (cs.visibility === "hidden" || cs.display === "none") {
        console.log("dnd-poly: source node is not visible. skipping snapback transition.");
        // shortcut to end the drag operation
        transitionEndCb();
        return;
    }
    // add class containing transition rules
    dragImage.classList.add(CLASS_DRAG_IMAGE_SNAPBACK);

    const csDragImage = getComputedStyle(dragImage);
    const durationInS = parseFloat(csDragImage.transitionDuration);
    if (isNaN(durationInS) || durationInS === 0) {
        console.log("dnd-poly: no transition used - skipping snapback");
        transitionEndCb();
        return;
    }

    console.log("dnd-poly: starting dragimage snap back");

    // calc source node position
    const rect = sourceEl.getBoundingClientRect();

    const pnt:Point = {
        x: rect.left,
        y: rect.top
    };

    // add scroll offset of document
    pnt.x += (document.body.scrollLeft || document.documentElement.scrollLeft);
    pnt.y += (document.body.scrollTop || document.documentElement.scrollTop);

    //TODO this sometimes fails.. find out when exactly and how to detect
    pnt.x -= parseInt(cs.marginLeft, 10);
    pnt.y -= parseInt(cs.marginTop, 10);

    const delayInS = parseFloat(csDragImage.transitionDelay);
    const durationInMs = Math.round((durationInS + delayInS) * 1000);

    // apply the translate
    translateDragImage(dragImage, pnt, dragImageTransforms, undefined, false);

    setTimeout(transitionEndCb, durationInMs);
}

//</editor-fold>

//<editor-fold desc="dnd spec util">

/**
 * Implements "6." in the processing steps defined for a dnd event
 * https://html.spec.whatwg.org/multipage/interaction.html#dragevent
 */
function determineDropEffect(effectAllowed:string, sourceNode:Element) {

    // uninitialized
    if (!effectAllowed) {

        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
        //if( sourceNode.nodeType === 1 ) {
        //
        //return "move";
        //}

        // link
        if (sourceNode.nodeType === 3 && (<HTMLElement>sourceNode).tagName === "A") {
            return DROP_EFFECTS[DROP_EFFECT.LINK];
        }

        // copy
        return DROP_EFFECTS[DROP_EFFECT.COPY];
    }

    // none
    if (effectAllowed === ALLOWED_EFFECTS[EFFECT_ALLOWED.NONE]) {
        return DROP_EFFECTS[DROP_EFFECT.NONE];
    }
    // copy or all
    if (effectAllowed.indexOf(ALLOWED_EFFECTS[EFFECT_ALLOWED.COPY]) === 0 || effectAllowed === ALLOWED_EFFECTS[EFFECT_ALLOWED.ALL]) {
        return DROP_EFFECTS[DROP_EFFECT.COPY];
    }
    // link
    if (effectAllowed.indexOf(ALLOWED_EFFECTS[EFFECT_ALLOWED.LINK]) === 0) {
        return DROP_EFFECTS[DROP_EFFECT.LINK];
    }
    // move
    if (effectAllowed === ALLOWED_EFFECTS[EFFECT_ALLOWED.MOVE]) {
        return DROP_EFFECTS[DROP_EFFECT.MOVE];
    }

    // copy
    return DROP_EFFECTS[DROP_EFFECT.COPY];
}

/**
 * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
 */
function dispatchDragEvent(dragEvent:string,
                           targetElement:Element,
                           touchEvent:TouchEvent,
                           dataStore:DragDataStore,
                           dataTransfer:DataTransfer,
                           cancelable = true,
                           relatedTarget:Element = null):boolean {

    console.log("dnd-poly: dispatching " + dragEvent);

    if (DEBUG) {
        var debug_class = CLASS_PREFIX + "debug",
            debug_class_event_target = CLASS_PREFIX + "event-target",
            debug_class_event_related_target = CLASS_PREFIX + "event-related-target";
        targetElement.classList.add(debug_class);
        targetElement.classList.add(debug_class_event_target);
        if (relatedTarget) {
            relatedTarget.classList.add(debug_class);
            relatedTarget.classList.add(debug_class_event_related_target);
        }
    }

    const leaveEvt = createDragEventFromTouch(targetElement, touchEvent, dragEvent, cancelable, document.defaultView, dataTransfer, relatedTarget);
    const cancelled = !targetElement.dispatchEvent(leaveEvt);

    dataStore._mode = DragDataStoreMode._DISCONNECTED;

    if (DEBUG) {
        targetElement.classList.remove(debug_class_event_target);
        if (relatedTarget) {
            relatedTarget.classList.remove(debug_class_event_related_target);
        }
    }

    return cancelled;
}

/**
 * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
 */
function determineDragOperation(effectAllowed:string, dropEffect:string):string {

    // unitialized or all
    if (!effectAllowed || effectAllowed === ALLOWED_EFFECTS[7]) {
        return dropEffect;
    }

    if (dropEffect === DROP_EFFECTS[DROP_EFFECT.COPY]) {
        if (effectAllowed.indexOf(DROP_EFFECTS[DROP_EFFECT.COPY]) === 0) {
            return DROP_EFFECTS[DROP_EFFECT.COPY];
        }
    }
    else if (dropEffect === DROP_EFFECTS[DROP_EFFECT.LINK]) {
        if (effectAllowed.indexOf(DROP_EFFECTS[DROP_EFFECT.LINK]) === 0 || effectAllowed.indexOf("Link") > -1) {
            return DROP_EFFECTS[DROP_EFFECT.LINK];
        }
    }
    else if (dropEffect === DROP_EFFECTS[DROP_EFFECT.MOVE]) {
        if (effectAllowed.indexOf(DROP_EFFECTS[DROP_EFFECT.MOVE]) === 0 || effectAllowed.indexOf("Move") > -1) {
            return DROP_EFFECTS[DROP_EFFECT.MOVE];
        }
    }

    return DROP_EFFECTS[DROP_EFFECT.NONE];
}

function onDelayTouchstart(evt: TouchEvent) {
    const el = evt.target;

    const heldItem = () => {
        end.off();
        cancel.off();
        scroll.off();
        onTouchstart(evt);
    };

    const onReleasedItem = () => {
        end.off();
        cancel.off();
        scroll.off();
        clearTimeout(timer);
    };

    const timer = setTimeout(heldItem, config.holdToDrag);

    const end = onEvt(el, 'touchend', onReleasedItem, this);
    const cancel = onEvt(el, 'touchcancel', onReleasedItem, this);
    const scroll = onEvt(window, 'scroll', onReleasedItem, this);
}

function onEvt(el: EventTarget, event: string, handler: () => any, context: any) {
    if (context) {
        handler = handler.bind(context);
    }

    el.addEventListener(event, handler);

    return {
        off() {
            return el.removeEventListener(event, handler);
        }
    };
}

//</editor-fold>

//<editor-fold desc="dead dnd spec code">

/**
 * // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
 */
//public static ElementIsTextDropzone( element:HTMLElement, dragDataStore?:DragDataStore ) {
//
//    if( dragDataStore && !dragDataStore.data[ "text/plain" ] ) {
//        return false;
//    }
//
//    if( element.isContentEditable ) {
//        return true;
//    }
//
//    if( element.tagName === "TEXTAREA" ) {
//        return true;
//    }
//
//    if( element.tagName === "INPUT" ) {
//        if( element.getAttribute( "type" ) === "text" ) {
//            return true;
//        }
//    }
//
//    return false;
//}

/**
 * NO DROPZONE SUPPORT SINCE NATIVE IMPLEMENTATIONS IN BROWSERS ALSO DO NOT
 *
 * Helper method for recursively go from a nested element up the ancestor chain
 * to see if any element has a dropzone.
 */
//private static FindDropzoneElement( element:HTMLElement ):HTMLElement {
//
//    if( !element || !element.hasAttribute || typeof element.hasAttribute !== "function" ) {
//        return null;
//    }
//
//    if( element.hasAttribute( "dropzone" ) ) {
//        return element;
//    }
//
//    if( element === window.document.body ) {
//        return null;
//    }
//
//    return DragOperationController.FindDropzoneElement( element.parentElement );
//}

/**
 * NO DROPZONE SUPPORT SINCE NATIVE IMPLEMENTATIONS IN BROWSERS ALSO DO NOT
 *
 * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#the-dropzone-attribute
 * by implementing the dropzone processing steps.
 */
//private static GetOperationForMatchingDropzone( element:HTMLElement, dragDataStore:DragDataStore ):string {

// If the current target element is an element with a dropzone attribute that matches the drag data store and specifies an operation
//      Set the current drag operation to the operation specified by the dropzone attribute of the current target element.
// If the current target element is an element with a dropzone attribute that matches the drag data store and does not specify an operation
//      Set the current drag operation to "copy".
// Otherwise
//      Reset the current drag operation to "none".
//var value = element.getAttribute( "dropzone" );
//if( !value ) {
//
//    return "none";
//}
//
//var matched = false;
//var operation;
//var keywords = value.split( " " );
//
//for( var i:number = 0; i < keywords.length; i++ ) {
//    var keyword = keywords[ i ];
//
//    if( keyword === "copy" || keyword === "move" || keyword === "link" ) {
//        if( !operation ) {
//            operation = keyword;
//        }
//        continue;
//    }
//
//    if( keyword.length < 3 || keyword[ 1 ] !== ":" ) {
//        continue;
//    }
//
//    var splitKeyword = keyword.split( ":" );
//    var kind = splitKeyword[ 0 ].toLowerCase();
//    var type = splitKeyword[ 1 ].toLowerCase();
//
//    if( dragDataStore.types.indexOf( type ) > -1 ) {
//        matched = true;
//    }
//}
//
//if( !matched ) {
//    return "none";
//}
//
//if( !operation ) {
//    return "copy";
//}
//
//return operation;
//}

//</editor-fold>
