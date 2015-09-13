// debug mode, which will highlight drop target, immediate user selection and events fired as you interact.
declare var DEBUG:boolean;

module MobileDragAndDropPolyfill {

    //<editor-fold desc="feature detection">

    var detectedFeatures:DetectedFeatures;

    interface DetectedFeatures {
        draggable:boolean;
        dragEvents:boolean;
        touchEvents:boolean;
        //mouseEventConstructor:boolean;
        //dragEventConstructor:boolean;
        //customEventConstructor:boolean;
        userAgentNotSupportingNativeDnD:boolean;
        isBlinkEngine:boolean;
        transitionEnd:string;
    }

    function detectFeatures():DetectedFeatures {

        var detectedFeatures:DetectedFeatures = {
            draggable: ('draggable' in document.documentElement),
            dragEvents: ('ondragstart' in document.documentElement),
            touchEvents: ('ontouchstart' in document.documentElement),
            //mouseEventConstructor: ('MouseEvent' in window),
            //dragEventConstructor: ('DragEvent' in window),
            //customEventConstructor: ('CustomEvent' in window),
            isBlinkEngine: !!((<any>window).chrome) || /chrome/i.test( navigator.userAgent ),
            userAgentNotSupportingNativeDnD: false,
            transitionEnd: ('WebkitTransition' in document.documentElement.style) ? 'webkitTransitionEnd' : 'transitionend'
        };

        detectedFeatures.userAgentNotSupportingNativeDnD = (
            // if is mobile safari or android browser
            /iPad|iPhone|iPod|Android/.test( navigator.userAgent )
            || // OR
            //if is blink(chrome/opera) with touch events enabled -> no native dnd
            detectedFeatures.touchEvents && (detectedFeatures.isBlinkEngine)
        );

        if( DEBUG ) {
            Object.keys( detectedFeatures ).forEach( function( key ) {
                console.log( "dnd-poly: detected feature '" + key + " = " + detectedFeatures[ key ] + "'" );
            } );
        }

        return detectedFeatures;
    }

    //</editor-fold>

    //<editor-fold desc="public api">

    export interface Config {
        iterationInterval?:number;
        scrollThreshold?:number;         // threshold in px. when distance between viewport edge and touch position is smaller start programmatic scroll.
        scrollVelocity?:number;          // how much px will be scrolled per animation frame iteration
    }

    // default config
    const config:Config = {
        iterationInterval: 150,
        scrollThreshold: 50,
        scrollVelocity: 10
    };

    export function Initialize( override?:Config ) {

        // feature/browser detection
        detectedFeatures = detectFeatures();

        // check if native drag and drop support is there
        if( detectedFeatures.userAgentNotSupportingNativeDnD === false
            && detectedFeatures.draggable
            && detectedFeatures.dragEvents ) {
            // no polyfilling required
            return;
        }

        if( override ) {
            // overwrite default config with user config
            Object.keys( override ).forEach( function( key ) {
                config[ key ] = config[ key ];
            } );
        }

        console.log( "dnd-poly: Applying mobile drag and drop polyfill." );

        // add listeners suitable for detecting a potential drag operation
        document.addEventListener( "touchstart", onTouchstart );
    }

    //</editor-fold>

    //<editor-fold desc="drag operation start/end">

    // reference the currently active drag operation
    var activeDragOperation:DragOperationController;

    /**
     * event handler listening for initial events that possibly start a drag and drop operation.
     */
    function onTouchstart( e:TouchEvent ) {

        console.log( "dnd-poly: global touchstart" );

        // From the moment that the user agent is to initiate the drag-and-drop operation,
        // until the end of the drag-and-drop operation, device input events (e.g. mouse and keyboard events) must be suppressed.

        // only allow one drag operation at a time
        if( activeDragOperation ) {
            console.log( "dnd-poly: drag operation already active" );
            return;
        }

        var dragTarget = tryFindDraggableTarget( e );

        // If there is no such element, then nothing is being dragged; abort these
        // steps, the drag-and-drop operation is never started.
        if( !dragTarget ) {
            return;
        }

        e.preventDefault();

        try {
            activeDragOperation = new DragOperationController( config, <HTMLElement>dragTarget, e, dragOperationEnded );
        }
        catch( err ) {
            dragOperationEnded( e, DragOperationState.CANCELLED );
            // rethrow exception after cleanup
            throw err;
        }
    }

    /**
     * Search for a possible draggable item upon an event that can initialize a drag operation.
     */
    function tryFindDraggableTarget( event:TouchEvent ):Element {

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

        var el = <HTMLElement>event.target;

        do {
            if( el.draggable === false ) {
                continue;
            }
            if( el.getAttribute && el.getAttribute( "draggable" ) === "true" ) {
                return el;
            }
        } while( (el = <HTMLElement>el.parentNode) && el !== document.body );
    }

    /**
     * Implements callback invoked when a drag operation has ended or crashed.
     */
    function dragOperationEnded( event:TouchEvent, state:DragOperationState ) {

        activeDragOperation = null;

        //TODO do we need support/detection for single-click, double-click, right-click?
        // this means the drag operation was not started so the "default action" of the original event should be applied
        if( state === DragOperationState.POTENTIAL ) {

            //TODO different target elements need different default actions
            var target = (<HTMLElement>event.target);
            var targetTagName = target.tagName;

            var mouseEventType:string;
            //TODO test which event is needed on what element, input elements so far are a bit ugly because focus is needed on fields that need keyboard
            switch( targetTagName ) {
                case "SELECT":
                    mouseEventType = "mousedown";
                    break;
                case "INPUT":
                case "TEXTAREA":
                    target.focus();
                default:
                    mouseEventType = "click";
            }

            console.log( "dnd-poly: No movement on draggable. Dispatching " + mouseEventType + " on " + targetTagName + " .." );

            var defaultEvent = createMouseEventFromTouch( target, event, mouseEventType );
            target.dispatchEvent( defaultEvent );
        }
    }

    //</editor-fold>

    //<editor-fold desc="drag operation">

    /**
     * For tracking the different states of a drag operation.
     */
    const enum DragOperationState {
        POTENTIAL,  // initial state of a controller, if no movement is detected the operation ends with this state
        STARTED,    // after movement is detected the drag operation starts and keeps this state until it ends
        ENDED,      // when the drag operation ended normally
        CANCELLED   // when the drag operation ended with a cancelled input event
    }

    // contains all possible values of the effectAllowed property
    const enum EFFECT_ALLOWED {
        NONE      = 0,
        COPY      = 1,
        COPY_LINK = 2,
        COPY_MOVE = 3,
        LINK      = 4,
        LINK_MOVE = 5,
        MOVE      = 6,
        ALL       = 7
    }
    const ALLOWED_EFFECTS = [ "none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all" ];
    // contains all possible values of the dropEffect property
    const enum DROP_EFFECT {
        NONE = 0,
        COPY = 1,
        MOVE = 2,
        LINK = 3,
    }
    const DROP_EFFECTS = [ "none", "copy", "move", "link" ];

    // cross-browser css transform property prefixes
    const TRANSFORM_CSS_VENDOR_PREFIXES = [ "", "-webkit-" ];
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
        private _dragImagePageCoordinates:Point; // the current page coordinates of the dragImage

        private _currentHotspotCoordinates:Point;    // the point relative to viewport for determining the immediate user selection

        private _immediateUserSelection:HTMLElement = null;  // the element the user currently hovers while dragging
        private _currentDropTarget:HTMLElement = null;   // the element that was selected as a valid drop target by the d'n'd operation

        private _dragDataStore:DragDataStore;
        private _dataTransfer:DataTransfer;

        private _currentDragOperation:string;    // the current drag operation set according to the d'n'd processing model

        private _initialTouchId:number;  // the identifier for the touch that initiated the drag operation
        private _touchMoveHandler:EventListener;
        private _touchEndOrCancelHandler:EventListener;
        private _lastTouchEvent:TouchEvent;

        private _scrollIntention:Point;
        private _scrollAnimationFrameHandler:FrameRequestCallback;
        private _scrollAnimationId:number;

        private _iterationLock:boolean;
        private _iterationIntervalId:number;

        constructor( private _config:Config, private _sourceNode:HTMLElement, _initialEvent:TouchEvent, private _dragOperationEndedCb:( event:TouchEvent, state:DragOperationState )=>void ) {

            console.log( "dnd-poly: setting up potential drag operation.." );

            this._lastTouchEvent = _initialEvent;
            this._initialTouchId = _initialEvent.changedTouches[ 0 ].identifier;

            // create bound event listeners
            this._touchMoveHandler = this._onTouchMove.bind( this );
            this._touchEndOrCancelHandler = this._onTouchEndOrCancel.bind( this );
            document.addEventListener( "touchmove", this._touchMoveHandler );
            document.addEventListener( "touchend", this._touchEndOrCancelHandler );
            document.addEventListener( "touchcancel", this._touchEndOrCancelHandler );

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
        private _setup() {
            console.log( "dnd-poly: starting drag and drop operation" );

            this._dragOperationState = DragOperationState.STARTED;

            this._currentDragOperation = DROP_EFFECTS[ DROP_EFFECT.NONE ];

            this._dragDataStore = new DragDataStore();
            this._dataTransfer = new DataTransfer( this._dragDataStore );

            this._currentHotspotCoordinates = {
                x: null,
                y: null
            };

            // 8. Update the drag data store default feedback as appropriate for the user agent
            // (if the user is dragging the selection, then the selection would likely be the basis for this feedback;
            // if the user is dragging an element, then that element's rendering would be used; if the drag began outside the user agent,
            // then the platform conventions for determining the drag feedback should be used).
            this._dragImagePageCoordinates = {
                x: null,
                y: null
            };
            updateCentroidCoordinatesOfTouchesIn( "page", this._lastTouchEvent, this._dragImagePageCoordinates );
            this._dragImage = createDragImage( this._sourceNode );
            translateDragImage( this._dragImage, this._dragImagePageCoordinates );
            document.body.appendChild( this._dragImage );

            // 9. Fire a DND event named dragstart at the source node.
            this._dragDataStore._mode = DragDataStoreMode.READWRITE;
            this._dataTransfer.dropEffect = DROP_EFFECTS[ DROP_EFFECT.NONE ];
            if( dispatchDragEvent( "dragstart", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer ) ) {
                console.log( "dnd-poly: dragstart cancelled" );
                // dragstart has been prevented -> cancel d'n'd
                this._dragOperationState = DragOperationState.CANCELLED;
                this._cleanup();
                return;
            }

            this._scrollIntention = {
                x: null,
                y: null
            };
            this._scrollAnimationFrameHandler = this._scrollAnimation.bind( this );

            // 10. Initiate the drag-and-drop operation in a manner consistent with platform conventions, and as described below.
            this._iterationIntervalId = setInterval( ()=> {

                // If the user agent is still performing the previous iteration of the sequence (if any) when the next iteration becomes due,
                // abort these steps for this iteration (effectively "skipping missed frames" of the drag-and-drop operation).
                if( this._iterationLock ) {
                    console.log( "dnd-poly: iteration skipped because previous iteration hast not yet finished." );
                    return;
                }
                this._iterationLock = true;

                this._dragAndDropProcessModelIteration();

                this._iterationLock = false;
            }, this._config.iterationInterval );
        }

        private _cleanup() {
            console.log( "dnd-poly: cleanup" );

            if( this._iterationIntervalId ) {
                clearInterval( this._iterationIntervalId );
                this._iterationIntervalId = null;
            }

            document.removeEventListener( "touchmove", this._touchMoveHandler );
            document.removeEventListener( "touchend", this._touchEndOrCancelHandler );
            document.removeEventListener( "touchcancel", this._touchEndOrCancelHandler );

            if( this._dragImage ) {
                this._dragImage.parentNode.removeChild( this._dragImage );
                this._dragImage = null;
            }

            this._dragOperationEndedCb( this._lastTouchEvent, this._dragOperationState );
        }

        //</editor-fold>

        //<editor-fold desc="touch handlers">

        private _onTouchMove( event:TouchEvent ) {

            // filter unrelated touches
            if( isTouchIdentifierContainedInTouchEvent( event, this._initialTouchId ) === false ) {
                return;
            }

            // drag operation did not start yet but on movement it should start
            if( this._dragOperationState === DragOperationState.POTENTIAL ) {
                this._setup();
                return;
            }

            // we emulate d'n'd so we dont want any defaults to apply
            event.preventDefault();
            event.stopImmediatePropagation();

            this._lastTouchEvent = event;

            // populate shared coordinates from touch event
            updateCentroidCoordinatesOfTouchesIn( "client", event, this._currentHotspotCoordinates );
            updateCentroidCoordinatesOfTouchesIn( "page", event, this._dragImagePageCoordinates );

            this._scrollIntention.x = determineScrollIntention( this._currentHotspotCoordinates.x, document.documentElement.clientWidth, this._config.scrollThreshold );
            this._scrollIntention.y = determineScrollIntention( this._currentHotspotCoordinates.y, document.documentElement.clientHeight, this._config.scrollThreshold );

            // check whether the current scroll has reached a limit
            var horizontalScrollEndReached = scrollEndReached( ScrollAxis.HORIZONTAL, this._scrollIntention.x );
            var verticalScrollEndReached = scrollEndReached( ScrollAxis.VERTICAL, this._scrollIntention.y );

            // scrolling is possible
            if( !horizontalScrollEndReached || !verticalScrollEndReached ) {

                // start programmatic scroll when not already started
                if( !this._scrollAnimationId ) {

                    this._scrollAnimationId = window.requestAnimationFrame( this._scrollAnimationFrameHandler );
                }
            }
            else {

                translateDragImage( this._dragImage, this._dragImagePageCoordinates );
            }
        }

        private _onTouchEndOrCancel( event:TouchEvent ) {

            // filter unrelated touches
            if( isTouchIdentifierContainedInTouchEvent( event, this._initialTouchId ) === false ) {
                return;
            }

            // will cancel eventual programmatic scrolling
            this._scrollIntention.x = this._scrollIntention.y = 0;

            // drag operation did not even start
            if( this._dragOperationState === DragOperationState.POTENTIAL ) {
                this._cleanup();
                return;
            }

            // we emulate d'n'd so we dont want any defaults to apply
            event.preventDefault();
            event.stopImmediatePropagation();

            this._lastTouchEvent = event;

            this._dragOperationState = (event.type === "touchcancel") ? DragOperationState.CANCELLED : DragOperationState.ENDED;
        }

        //</editor-fold>

        //<editor-fold desc="programmatic scroll">

        private _scrollAnimation() {

            // check whether the current scroll has reached a limit
            var horizontalScrollEndReached = scrollEndReached( ScrollAxis.HORIZONTAL, this._scrollIntention.x );
            var verticalScrollEndReached = scrollEndReached( ScrollAxis.VERTICAL, this._scrollIntention.y );

            // both scroll limits reached -> stop scroll
            if( horizontalScrollEndReached && verticalScrollEndReached ) {
                console.log( "dnd-poly: scroll end reached" );
                this._scrollAnimationId = null;
                return;
            }

            // update dragImage position according to scroll direction
            if( !horizontalScrollEndReached ) {
                var horizontalScroll = this._scrollIntention.x * this._config.scrollVelocity;
                getSetScroll( ScrollAxis.HORIZONTAL, horizontalScroll );
                this._dragImagePageCoordinates.x += horizontalScroll;
            }
            if( !verticalScrollEndReached ) {
                var verticalScroll = this._scrollIntention.y * this._config.scrollVelocity;
                getSetScroll( ScrollAxis.VERTICAL, verticalScroll );
                this._dragImagePageCoordinates.y += verticalScroll;
            }
            translateDragImage( this._dragImage, this._dragImagePageCoordinates );

            // re-schedule animation frame callback
            this._scrollAnimationId = window.requestAnimationFrame( this._scrollAnimationFrameHandler );
        }

        //</editor-fold>

        //<editor-fold desc="dnd spec logic">

        /**
         * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
         */
        private _dragAndDropProcessModelIteration():void {

            if( DEBUG ) {
                var debug_class                = CLASS_PREFIX + "debug",
                    debug_class_user_selection = CLASS_PREFIX + "immediate-user-selection",
                    debug_class_drop_target    = CLASS_PREFIX + "current-drop-target";
            }

            // Fire a DND event named drag event at the source node.
            this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
            this._dataTransfer.dropEffect = DROP_EFFECTS[ DROP_EFFECT.NONE ];
            var dragCancelled = dispatchDragEvent( "drag", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer );
            if( dragCancelled ) {
                console.log( "dnd-poly: drag event cancelled." );
                // If this event is canceled, the user agent must set the current drag operation to "none" (no drag operation).
                this._currentDragOperation = DROP_EFFECTS[ DROP_EFFECT.NONE ];
            }

            // Otherwise, if the user ended the drag-and-drop operation (e.g. by releasing the mouse button in a mouse-driven drag-and-drop interface),
            // or if the drag event was canceled, then this will be the last iteration.
            if( dragCancelled || this._dragOperationState === DragOperationState.ENDED || this._dragOperationState === DragOperationState.CANCELLED ) {

                var dragFailed = this._dragOperationEnded( this._dragOperationState );

                // if drag failed transition snap back
                if( dragFailed ) {

                    var sourceNodeComputedStyle = window.getComputedStyle( this._sourceNode, null );
                    var visiblity = sourceNodeComputedStyle.getPropertyValue( "visibility" );
                    var display = sourceNodeComputedStyle.getPropertyValue( "display" );

                    if( visiblity === "hidden" || display === "none" ) {
                        console.log( "dnd-poly: source node is not visible. skipping snapback transition." );
                        // shortcut to end the drag operation
                        this._finishDragOperation();
                    }
                    else {

                        triggerDragImageSnapback( detectedFeatures.transitionEnd, this._sourceNode, this._dragImage, ()=> {
                            this._finishDragOperation();
                        } );
                    }

                    return;
                }

                // Otherwise immediately
                // Fire a DND event named dragend at the source node.
                this._finishDragOperation();

                return;
            }

            // If the drag event was not canceled and the user has not ended the drag-and-drop operation,
            // check the state of the drag-and-drop operation, as follows:
            var newUserSelection:HTMLElement = <HTMLElement>document.elementFromPoint( this._currentHotspotCoordinates.x, this._currentHotspotCoordinates.y );

            console.log( "dnd-poly: new immediate user selection is: " + newUserSelection );

            var previousTargetElement = this._currentDropTarget;

            // If the user is indicating a different immediate user selection than during the last iteration (or if this is the first iteration),
            // and if this immediate user selection is not the same as the current target element,
            // then fire a DND event named dragexit at the current target element,
            // and then update the current target element as follows:
            if( newUserSelection !== this._immediateUserSelection && newUserSelection !== this._currentDropTarget ) {

                if( DEBUG ) {

                    if( this._immediateUserSelection ) {
                        this._immediateUserSelection.classList.remove( debug_class_user_selection );
                    }

                    if( newUserSelection ) {
                        newUserSelection.classList.add( debug_class );
                        newUserSelection.classList.add( debug_class_user_selection );
                    }
                }

                this._immediateUserSelection = newUserSelection;

                if( this._currentDropTarget !== null ) {
                    this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
                    this._dataTransfer.dropEffect = DROP_EFFECTS[ DROP_EFFECT.NONE ];
                    dispatchDragEvent( "dragexit", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false );
                }

                // If the new immediate user selection is null
                if( this._immediateUserSelection === null ) {
                    //Set the current target element to null also.
                    this._currentDropTarget = this._immediateUserSelection;

                    console.log( "dnd-poly: current drop target changed to null" );
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
                    this._dataTransfer.dropEffect = determineDropEffect( this._dragDataStore._effectAllowed, this._sourceNode );
                    if( dispatchDragEvent( "dragenter", this._immediateUserSelection, this._lastTouchEvent, this._dragDataStore, this._dataTransfer ) ) {
                        console.log( "dnd-poly: dragenter default prevented" );
                        // If the event is canceled, then set the current target element to the immediate user selection.
                        this._currentDropTarget = this._immediateUserSelection;
                        this._currentDragOperation = determineDragOperation( this._dataTransfer.effectAllowed, this._dataTransfer.dropEffect );
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
                        if( this._immediateUserSelection !== document.body ) {
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
            if( previousTargetElement !== this._currentDropTarget && (isDOMElement( previousTargetElement ) ) ) {

                if( DEBUG ) {
                    previousTargetElement.classList.remove( debug_class_drop_target );
                }

                console.log( "dnd-poly: current drop target changed." );

                this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
                this._dataTransfer.dropEffect = DROP_EFFECTS[ DROP_EFFECT.NONE ];
                dispatchDragEvent( "dragleave", previousTargetElement, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false, this._currentDropTarget );
            }

            // If the current target element is a DOM element, then fire a DND event named dragover at this current target element.
            if( isDOMElement( this._currentDropTarget ) ) {

                if( DEBUG ) {
                    this._currentDropTarget.classList.add( debug_class );
                    this._currentDropTarget.classList.add( debug_class_drop_target );
                }

                // If the dragover event is not canceled, run the appropriate step from the following list:
                this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
                this._dataTransfer.dropEffect = determineDropEffect( this._dragDataStore._effectAllowed, this._sourceNode );
                if( dispatchDragEvent( "dragover", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer ) === false ) {

                    console.log( "dnd-poly: dragover not prevented on possible drop-target." );
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
                    this._currentDragOperation = DROP_EFFECTS[ DROP_EFFECT.NONE ];
                }
                // Otherwise (if the dragover event is canceled), set the current drag operation based on the values of the effectAllowed and
                // dropEffect attributes of the DragEvent object's dataTransfer object as they stood after the event dispatch finished
                else {

                    console.log( "dnd-poly: dragover prevented." );

                    this._currentDragOperation = determineDragOperation( this._dataTransfer.effectAllowed, this._dataTransfer.dropEffect );
                }
            }

            console.log( "dnd-poly: d'n'd iteration ended. current drag operation: " + this._currentDragOperation );

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

            for( var i:number = 0; i < DROP_EFFECTS.length; i++ ) {
                this._dragImage.classList.remove( CLASS_PREFIX + DROP_EFFECTS[ i ] );
            }

            this._dragImage.classList.add( CLASS_PREFIX + this._currentDragOperation );
        }

        /**
         * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
         */
        private _dragOperationEnded( state:DragOperationState ):boolean {

            console.log( "dnd-poly: drag operation end detected with " + this._currentDragOperation );

            if( DEBUG ) {

                var debug_class_user_selection = CLASS_PREFIX + "immediate-user-selection",
                    debug_class_drop_target    = CLASS_PREFIX + "current-drop-target";

                if( this._currentDropTarget ) {
                    this._currentDropTarget.classList.remove( debug_class_drop_target );

                }
                if( this._immediateUserSelection ) {
                    this._immediateUserSelection.classList.remove( debug_class_user_selection );
                }
            }

            //var dropped:boolean = undefined;

            // Run the following steps, then stop the drag-and-drop operation:

            // If the current drag operation is "none" (no drag operation), or,
            // if the user ended the drag-and-drop operation by canceling it (e.g. by hitting the Escape key), or
            // if the current target element is null, then the drag operation failed.
            var dragFailed = (this._currentDragOperation === DROP_EFFECTS[ DROP_EFFECT.NONE ]
                              || this._currentDropTarget === null
                              || state === DragOperationState.CANCELLED);
            if( dragFailed ) {

                // Run these substeps:

                // Let dropped be false.
                //dropped = false;

                // If the current target element is a DOM element, fire a DND event named dragleave at it;
                if( isDOMElement( this._currentDropTarget ) ) {
                    this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
                    this._dataTransfer.dropEffect = DROP_EFFECTS[ DROP_EFFECT.NONE ];
                    dispatchDragEvent( "dragleave", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false );
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
                if( isDOMElement( this._currentDropTarget ) ) {

                    // If the event is canceled, set the current drag operation to the value of the dropEffect attribute of the
                    // DragEvent object's dataTransfer object as it stood after the event dispatch finished.

                    this._dragDataStore._mode = DragDataStoreMode.READONLY;
                    this._dataTransfer.dropEffect = this._currentDragOperation;
                    if( dispatchDragEvent( "drop", this._currentDropTarget, this._lastTouchEvent, this._dragDataStore, this._dataTransfer ) ===
                        true ) {

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
                        this._currentDragOperation = DROP_EFFECTS[ DROP_EFFECT.NONE ];
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
            console.log( "dnd-poly: dragimage snap back transition ended" );

            // Fire a DND event named dragend at the source node.
            this._dragDataStore._mode = DragDataStoreMode.PROTECTED;
            this._dataTransfer.dropEffect = this._currentDragOperation;
            dispatchDragEvent( "dragend", this._sourceNode, this._lastTouchEvent, this._dragDataStore, this._dataTransfer, false );

            // drag operation over and out
            this._dragOperationState = DragOperationState.ENDED;
            this._cleanup();
        }

        //</editor-fold>
    }

    //</editor-fold>

    //<editor-fold desc="DataTransfer/DragDataStore">

    /**
     * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#datatransfer
     */
    class DataTransfer {

        private _dropEffect:string = DROP_EFFECTS[ DROP_EFFECT.NONE ];

        constructor( private _dataStore:DragDataStore ) {
        }

        public get files():FileList {
            return null;
        }

        //TODO support items property in DataTransfer polyfill
        public get items():DataTransferItemList {
            return null;
        }

        public get types():Array<string> {
            if( this._dataStore._mode === DragDataStoreMode._DISCONNECTED ) {
                return null;
            }

            return Object.freeze( this._dataStore._types );
        }

        public setData( type:string, data:string ):void {
            if( this._dataStore._mode !== DragDataStoreMode.READWRITE ) {
                return;
            }

            if( type.indexOf( " " ) > -1 ) {
                throw new Error( "illegal arg: type contains space" );
            }

            this._dataStore._data[ type ] = data;
            if( this._dataStore._types.indexOf( type ) === -1 ) {
                this._dataStore._types.push( type );
            }
        }

        public getData( type:string ):string {
            if( this._dataStore._mode === DragDataStoreMode._DISCONNECTED
                || this._dataStore._mode === DragDataStoreMode.PROTECTED ) {
                return null;
            }

            return this._dataStore._data[ type ] || "";
        }

        public clearData( format?:string ):void {
            if( this._dataStore._mode !== DragDataStoreMode.READWRITE ) {
                return;
            }
            // delete data for format
            if( format && this._dataStore._data[ format ] ) {
                delete this._dataStore._data[ format ];
                var index = this._dataStore._types.indexOf( format );
                if( index > -1 ) {
                    this._dataStore._types.splice( index, 1 );
                }
                return;
            }
            // delete all data
            this._dataStore._data = {};
            this._dataStore._types = [];
        }

        public setDragImage( image:Element, x:number, y:number ):void {
            if( this._dataStore._mode === DragDataStoreMode._DISCONNECTED ) {
                return;
            }

            //TODO setdragimage support for setting dragimage to some custom element
        }

        public get effectAllowed() {

            return this._dataStore._effectAllowed;
        }

        //TODO effectAllowed can be set only on dragstart?
        public set effectAllowed( value ) {
            if( this._dataStore._mode === DragDataStoreMode._DISCONNECTED
                || ALLOWED_EFFECTS.indexOf( value ) === -1 ) {
                return;
            }

            this._dataStore._effectAllowed = value;
        }

        public get dropEffect() {

            return this._dropEffect;
        }

        public set dropEffect( value ) {
            if( this._dataStore._mode === DragDataStoreMode._DISCONNECTED
                || ALLOWED_EFFECTS.indexOf( value ) === -1 ) {
                return;
            }

            this._dropEffect = value;
        }
    }

    /**
     * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#drag-data-store-mode
     */
    const enum DragDataStoreMode {
        _DISCONNECTED, // adding an extra mode here because we need a special state to disconnet the data store from dataTransfer instance
        READONLY,
        READWRITE,
        PROTECTED
    }

    /**
     * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#the-drag-data-store
     */
    class DragDataStore {
        public _mode:DragDataStoreMode = DragDataStoreMode.PROTECTED;
        public _data = {};
        public _types:Array<string> = [];
        public _effectAllowed:string;
    }

    //</editor-fold>

    //<editor-fold desc="util">

    interface Point {
        x:number;
        y:number;
    }

    function average( array:Array<number> ) {
        if( array.length === 0 ) {
            return 0;
        }
        return array.reduce( (function( s, v ) {
                return v + s;
            }), 0 ) / array.length;
    }

    function isDOMElement( object:any ) {
        return object && object.tagName;
    }

    function once( el:HTMLElement, eventType:string, callback:EventListener ) {
        el.addEventListener( eventType, function( e ) {
            e.target.removeEventListener( e.type, <EventListener>arguments.callee );
            return callback( e );
        } );
    }

    function isTouchIdentifierContainedInTouchEvent( newTouch:TouchEvent, touchIdentifier:number ) {
        for( var i:number = 0; i < newTouch.changedTouches.length; i++ ) {
            var touch = newTouch.changedTouches[ i ];
            if( touch.identifier === touchIdentifier ) {
                return true;
            }
        }
        return false;
    }

    //TODO initMouseEvent is deprecated, replace by MouseEvent constructor?
    //TODO integrate feature detection to switch to MouseEvent constructor
    function createMouseEventFromTouch( targetElement:Element, e:TouchEvent, typeArg:string, cancelable:boolean = true, window:Window = document.defaultView, relatedTarget:Element = null ) {
        var mouseEvent = document.createEvent( "MouseEvents" );
        var touch:Touch = e.changedTouches[ 0 ];

        mouseEvent.initMouseEvent( typeArg, true, cancelable, window, 1,
            touch.screenX, touch.screenY, touch.clientX, touch.clientY,
            e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, relatedTarget );

        var targetRect = targetElement.getBoundingClientRect();
        //TODO is this working or are mouse event instances immutable?
        mouseEvent.offsetX = mouseEvent.clientX - targetRect.left;
        mouseEvent.offsetY = mouseEvent.clientY - targetRect.top;

        return mouseEvent;
    }

    //TODO integrate feature detection to switch to MouseEvent/DragEvent constructor if makes sense for simulating drag events and event constructors work
    // at all for our usecase
    function createDragEventFromTouch( targetElement:Element, e:TouchEvent, typeArg:string, cancelable:boolean, window:Window, dataTransfer:DataTransfer, relatedTarget:Element = null ) {

        var touch:Touch = e.changedTouches[ 0 ];

        var dndEvent:DragEvent = <any>document.createEvent( "Event" );
        dndEvent.initEvent( typeArg, true, cancelable );
        // cast our polyfill
        dndEvent.dataTransfer = <any>dataTransfer;
        dndEvent.relatedTarget = relatedTarget;
        // set the coordinates
        dndEvent.screenX = touch.screenX;
        dndEvent.screenY = touch.screenY;
        dndEvent.clientX = touch.clientX;
        dndEvent.clientY = touch.clientY;

        //var dndEvent:DragEvent = <any>document.createEvent( "MouseEvents" );
        //dndEvent.initMouseEvent( typeArg, true, cancelable,window, 1,
        //    touch.screenX, touch.screenY, touch.clientX, touch.clientY,
        //    false, false, false, false, 0, relatedTarget );
        //dndEvent.dataTransfer = <any>dataTransfer;

        //var dndEvent:DragEvent = <any>document.createEvent( "DragEvents" );
        //dndEvent.initDragEvent( typeArg, true, cancelable, window, 1,
        //    touch.screenX, touch.screenY, touch.clientX, touch.clientY,
        //    false, false, false, false, 0, relatedTarget, <any>dataTransfer );

        var targetRect = targetElement.getBoundingClientRect();
        dndEvent.offsetX = dndEvent.clientX - targetRect.left;
        dndEvent.offsetY = dndEvent.clientY - targetRect.top;

        return dndEvent;
    }

    /**
     * Calc center of polygon spanned by multiple touches in page (full page size, with hidden scrollable area) coordinates
     * or in viewport (screen coordinates) coordinates.
     */
    function updateCentroidCoordinatesOfTouchesIn( coordinateProp:string, event:TouchEvent, outPoint:Point ):void {
        var pageXs:Array<number> = [], pageYs:Array<number> = [];
        for( var i:number = 0; i < event.touches.length; i++ ) {
            var touch = event.touches[ i ];
            pageXs.push( touch[ coordinateProp + "X" ] );
            pageYs.push( touch[ coordinateProp + "Y" ] );
        }
        outPoint.x = average( pageXs );
        outPoint.y = average( pageYs )
    }

    function prepareNodeCopyAsDragImage( srcNode:HTMLElement, dstNode:HTMLElement ) {
        // Is this node an element?
        if( srcNode.nodeType === 1 ) {

            // Clone the style
            var cs = window.getComputedStyle( srcNode );
            for( var i = 0; i < cs.length; i++ ) {
                var csName = cs[ i ];
                dstNode.style.setProperty( csName, cs.getPropertyValue( csName ), cs.getPropertyPriority( csName ) );
            }

            // no interaction with the drag image, pls! this is also important to make the drag image transparent for hit-testing
            // hit testing is done in the drag and drop iteration to find the element the user currently is hovering over while dragging
            // if pointer-events is not none or a browser does behave in an unexpected way than the hit test will break
            dstNode.style[ "pointer-events" ] = "none";

            // Remove any potential conflict attributes
            dstNode.removeAttribute( "id" );
            dstNode.removeAttribute( "class" );
            dstNode.removeAttribute( "draggable" );
        }

        // Do the same for the children
        if( srcNode.hasChildNodes() ) {
            for( var i = 0; i < srcNode.childNodes.length; i++ ) {
                prepareNodeCopyAsDragImage( <HTMLElement>srcNode.childNodes[ i ], <HTMLElement>dstNode.childNodes[ i ] );
            }
        }
    }

    function createDragImage( sourceNode:HTMLElement ) {

        var dragImage = <HTMLElement>sourceNode.cloneNode( true );

        // this removes any id's and stuff that could interfere with drag and drop
        prepareNodeCopyAsDragImage( sourceNode, dragImage );

        // set layout styles for freely moving it around
        dragImage.style[ "position" ] = "absolute";
        dragImage.style[ "left" ] = "0px";
        dragImage.style[ "top" ] = "0px";
        // on top of all
        dragImage.style[ "z-index" ] = "999999";

        // add polyfill class for default styling
        dragImage.classList.add( CLASS_DRAG_IMAGE );
        dragImage.classList.add( CLASS_DRAG_OPERATION_ICON );

        return dragImage;
    }

    function translateDragImage( dragImage:HTMLElement, pnt:Point, centerOnCoordinates:boolean = true ):void {

        var x = pnt.x, y = pnt.y;

        if( centerOnCoordinates ) {
            x -= (parseInt( <any>dragImage.offsetWidth, 10 ) / 2);
            y -= (parseInt( <any>dragImage.offsetHeight, 10 ) / 2);
        }

        // using translate3d for best performance
        var translate = "translate3d(" + x + "px," + y + "px, 0)";

        for( var i:number = 0; i < TRANSFORM_CSS_VENDOR_PREFIXES.length; i++ ) {
            var transformProp = TRANSFORM_CSS_VENDOR_PREFIXES[ i ] + "transform";
            dragImage.style[ transformProp ] = translate;
        }
    }

    function triggerDragImageSnapback( transitionEndEvent:string, sourceEl:HTMLElement, dragImage:HTMLElement, transitionEndCb:EventListener ):void {

        console.log( "dnd-poly: starting dragimage snap back" );

        // calc source node position
        var rect = sourceEl.getBoundingClientRect();
        var pnt:Point = {
            x: rect.left,
            y: rect.top
        };
        var scrollLeft = getSetScroll( ScrollAxis.HORIZONTAL );
        var scrollTop = getSetScroll( ScrollAxis.VERTICAL );
        pnt.x += scrollLeft;
        pnt.y += scrollTop;

        //TODO seems to break in the demo page when dragging flex-box, find out when this is really needed
        var cs = window.getComputedStyle( sourceEl, null );
        var leftPadding = parseInt( cs.getPropertyValue( "padding-left" ), 10 );
        var topPadding = parseInt( cs.getPropertyValue( "padding-top" ), 10 );
        pnt.x -= leftPadding;
        pnt.y -= topPadding;

        // setup one-time transitionend listener
        once( dragImage, transitionEndEvent, transitionEndCb );

        // add class containing transition rules
        dragImage.classList.add( CLASS_DRAG_IMAGE_SNAPBACK );

        // apply the translate
        translateDragImage( dragImage, pnt, false );
    }

    function determineScrollIntention( currentCoordinate:number, clientSize:number, threshold:number ):number {
        // LEFT / TOP
        if( currentCoordinate < threshold ) {
            return -1;
        }
        // RIGHT / BOTTOM
        else if( clientSize - currentCoordinate < threshold ) {
            return 1;
        }
        // NONE
        return 0;
    }

    const enum ScrollAxis {
        HORIZONTAL,
        VERTICAL
    }

    function getSetScroll( axis:ScrollAxis, scroll?:number ) {
        var prop = (axis === ScrollAxis.HORIZONTAL) ? "scrollLeft" : "scrollTop";

        // abstracting away compatibility issues on scroll properties of document/body

        if( arguments.length === 1 ) {
            return document.documentElement[ prop ] || document.body[ prop ];
        }

        document.documentElement[ prop ] += scroll;
        document.body[ prop ] += scroll;
    }

    function scrollEndReached( axis:ScrollAxis, scrollIntention:number ) {
        var scrollSizeProp = "scrollHeight",
            clientSizeProp = "clientHeight",
            scroll         = getSetScroll( axis );

        if( axis === ScrollAxis.HORIZONTAL ) {
            scrollSizeProp = "scrollWidth";
            clientSizeProp = "clientWidth";
        }

        // wants to scroll to the right/bottom
        if( scrollIntention > 0 ) {

            // abstracting away compatibility issues on scroll properties of document/body
            var scrollSize = document.documentElement[ scrollSizeProp ] || document.body[ scrollSizeProp ];

            // is already at the right/bottom edge
            return (scroll + document.documentElement[ clientSizeProp ]) >= (scrollSize);
        }
        // wants to scroll to the left/top
        else if( scrollIntention < 0 ) {

            // is already at left/top edge
            return (scroll <= 0);
        }
        // no scroll
        return true;
    }

    //</editor-fold>

    //<editor-fold desc="dnd spec util">

    /**
     * Implements "6." in the processing steps defined for a dnd event
     * https://html.spec.whatwg.org/multipage/interaction.html#dragevent
     */
    function determineDropEffect( effectAllowed:string, sourceNode:Element ) {

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

    /**
     * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
     */
    function dispatchDragEvent( dragEvent:string, targetElement:Element, touchEvent:TouchEvent, dataStore:DragDataStore, dataTransfer:DataTransfer, cancelable:boolean = true, relatedTarget:Element = null ):boolean {
        console.log( "dnd-poly: dispatching " + dragEvent );

        if( DEBUG ) {
            var debug_class                      = CLASS_PREFIX + "debug",
                debug_class_event_target         = CLASS_PREFIX + "event-target",
                debug_class_event_related_target = CLASS_PREFIX + "event-related-target";
            targetElement.classList.add( debug_class );
            targetElement.classList.add( debug_class_event_target );
            if( relatedTarget ) {
                relatedTarget.classList.add( debug_class );
                relatedTarget.classList.add( debug_class_event_related_target );
            }
        }

        var leaveEvt = createDragEventFromTouch( targetElement, touchEvent, dragEvent, cancelable, document.defaultView, dataTransfer, relatedTarget );
        var cancelled = !targetElement.dispatchEvent( leaveEvt );

        dataStore._mode = DragDataStoreMode._DISCONNECTED;

        if( DEBUG ) {
            targetElement.classList.remove( debug_class_event_target );
            if( relatedTarget ) {
                relatedTarget.classList.remove( debug_class_event_related_target );
            }
        }

        return cancelled;
    }

    /**
     * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
     */
    function determineDragOperation( effectAllowed:string, dropEffect:string ):string {

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
}