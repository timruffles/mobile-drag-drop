/**
 * Created by stefansteinhart on 05.08.15.
 */
module MobileDragAndDropPolyfill {

    //<editor-fold desc="public api">

    /**
     * polyfill config
     */
    export interface Config {
        log?:( ...args:any[] ) => void;
        dragImageClass?:string;
    }

    /**
     * The polyfill must be actively initialized.
     * At this point you have the ability to pass a config.
     * @param config
     * @constructor
     */
    export var Initialize = function( config?:Config ) {
        DragAndDropInitializer.Initialize( config );
    };

    //</editor-fold>

    /**
     * Interface for collecting information
     * about the current user agent.
     */
    interface FeatureDetection {
        draggable:boolean;
        dragEvents:boolean;
        touchEvents:boolean;
        eventConstructor:boolean;
        mouseEventConstructor:boolean;
        dragEventConstructor:boolean;
        customEventConstructor:boolean;
        userAgentNotSupportingNativeDnD:boolean;
        isBlinkEngine:boolean;
        isGeckoEngine:boolean;
    }

    /**
     * Config that is used throughout a drag and drop operation.
     * adds stuff that is not available for the polyfill
     * user but internally needed.
     */
    interface InternalConfig extends Config {
        /**
         * d'n'd api specifies to run an algorithm
         * in a fixed interval which evaluates the current
         * state of the d'n'd operation including
         * the dispatching of the drag events.
         *
         * interval in ms.
         */
        iterationInterval:number;
    }

    //<editor-fold desc="polyfill initializer">

    /**
     * Does feature-detection and applies global
     * listener for initiating a drag and drop operation.
     */
    class DragAndDropInitializer {

        /**
         * flag for allowing only one drag operation at a time.
         * @type {boolean}
         */
        private static dragOperationActive:boolean = false;

        /**
         * internally used drag operation config
         */
        private static config:InternalConfig = {
            log: function() {
            },
            dragImageClass: null,
            iterationInterval: 150
        };

        /**
         * Polyfill initialization where user config is applied,
         * browser/feature detection is running and the listeners
         * for doing drag and drop are setup if polyfilling is needed.
         *
         * @param config
         * @constructor
         */
        public static Initialize( config?:Config ) {

            // overwrite default config with user config
            Util.Merge( DragAndDropInitializer.config, config );

            var featureDetection:FeatureDetection = <any>{};
            // feature/browser detection
            if( DragAndDropInitializer.IsDragAndDropSupportedNatively( featureDetection ) ) {
                return;
            }

            DragAndDropInitializer.config.log( "Applying mobile drag and drop polyfill." );

            // add listeners suitable for detecting a potential drag operation
            window.document.addEventListener( "touchstart", DragAndDropInitializer.OnTouchstart );
        }

        /**
         * Checking if environment supports drag and drop or we have to apply polyfill.
         * Also used to detect features to device on which implementations we can use.
         */
        private static IsDragAndDropSupportedNatively( featureDetection:FeatureDetection ):boolean {

            featureDetection.draggable = 'draggable' in window.document.documentElement;
            featureDetection.dragEvents = ('ondragstart' in window.document.documentElement);
            featureDetection.touchEvents = ('ontouchstart' in window.document.documentElement);
            featureDetection.mouseEventConstructor = ('MouseEvent' in window);
            featureDetection.dragEventConstructor = ('DragEvent' in window);
            featureDetection.customEventConstructor = ('CustomEvent' in window);
            featureDetection.isBlinkEngine = !!((<any>window).chrome) || /chrome/i.test( navigator.userAgent );
            featureDetection.isGeckoEngine = /firefox/i.test( navigator.userAgent );

            featureDetection.userAgentNotSupportingNativeDnD =
                (
                    // if is mobile safari or android browser
                    /iPad|iPhone|iPod|Android/.test( navigator.userAgent )
                    || // OR
                    //if is gecko(firefox) with touch events enabled no native dnd
                    //if is blink(chrome/opera) with touch events enabled no native dnd
                    featureDetection.touchEvents && (featureDetection.isBlinkEngine)
                );

            Util.ForIn( featureDetection, function( value, key ) {
                DragAndDropInitializer.config.log( "feature '" + key + "' is '" + value + "'" );
            } );

            return (featureDetection.userAgentNotSupportingNativeDnD === false
                    && featureDetection.draggable
                    && featureDetection.dragEvents);
        }

        /**
         * Event handler listening for initial events that possibly
         * start a drag and drop operation.
         *
         * @param e
         * @constructor
         */
        private static OnTouchstart( e:TouchEvent ) {

            DragAndDropInitializer.config.log( "global touchstart" );

            // only allow one drag operation at a time
            // From the moment that the user agent is to initiate the drag-and-drop operation,
            // until the end of the drag-and-drop operation, device input events (e.g. mouse and keyboard events) must be suppressed.
            if( DragAndDropInitializer.dragOperationActive ) {
                DragAndDropInitializer.config.log( "drag operation already active" );
                return;
            }

            var dragTarget = DragAndDropInitializer.TargetIsDraggable( e, DragAndDropInitializer.config );
            // If there is no such element, then nothing is being dragged; abort these
            // steps, the drag-and-drop operation is never started.
            if( !dragTarget ) {
                return;
            }

            e.preventDefault();

            DragAndDropInitializer.dragOperationActive = true;

            try {
                new DragOperationController( DragAndDropInitializer.config, dragTarget, e, DragAndDropInitializer.DragOperationEnded );
            }
            catch( err ) {
                DragAndDropInitializer.config.log( err );
                DragAndDropInitializer.DragOperationEnded( dragTarget, e, DragOperationState.CANCELLED );
            }
        }

        // NO drag operation because not enough movement was applied?
        public static TargetIsDraggable( event:TouchEvent, config:InternalConfig ):Element {

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

                if( el.getAttribute( "draggable" ) === "true" ) {
                    return el;
                }

            } while( (el = <HTMLElement>el.parentNode) && el !== window.document.body );
            //}
        }


        /**
         * Implements callback invoked when a drag operation has ended or crashed.
         * Do global cleanup logic for a single drag operation here.
         */
        private static DragOperationEnded( sourceNode:Element, event:TouchEvent, state:DragOperationState ) {

            DragAndDropInitializer.dragOperationActive = false;

            if( state === DragOperationState.POTENTIAL ) {
                DragAndDropInitializer.config.log( "No movement on draggable. Dispatching click.." );
                //TODO do we need support/detection for single-click, double-click, right-click?
                var clickEvt = Util.CreateMouseEventFromTouch( event, "click" );
                sourceNode.dispatchEvent( clickEvt );
            }
        }
    }

    //</editor-fold>

    //<editor-fold desc="drag operation">

    /**
     * Enum for tracking the different states a drag and drop controller
     * can be in.
     */
    enum DragOperationState {
        POTENTIAL, // initial state of a controller, if no movement is detected the operation ends with this state
        STARTED, // after movement is detected the drag operation starts and keeps this state until it ends
        ENDED, // when the drag operation ended normally
        CANCELLED // when the drag operation ended with a cancelled input event
    }

    /**
     * Contains logic for a single drag operation.
     * Aims to implement the HTML5 d'n'd spec (https://html.spec.whatwg.org/multipage/interaction.html#dnd) as close as it can get.
     * The goal is to be able to work with any code that relies on the HTML5 d'n'd behaviour like it is
     * implemented in desktop browsers that support the spec.
     *
     * The implementations contain the spec as comments to be able to reference the spec in the code.
     * Any deviation should be marked with a comment that explains why it is either not needed or not possible to follow the spec.
     */
    class DragOperationController {

        // convenience reference to the DOM document
        private doc:Document = window.document;

        // reference to the element that is used as drag image
        private dragImage:HTMLElement = null;
        // container for the cross-browser transform style properties
        private transformStyleMixins = {};
        // bound callback for transitionend on drag image "snapback" transition.
        private snapbackEndedCb:EventListener;

        // the element the user currently hovers while dragging
        private immediateUserSelection:HTMLElement = null;
        // the element that was selected as a valid drop target by the d'n'd operation
        private currentDropTarget:HTMLElement = null;

        // the drag data store for this drag operation
        private dragDataStore:DragDataStore = null;
        // the data transfer object used on the drag events
        private dataTransfer:DataTransfer = null;
        // the current drag operation set according to the d'n'd processing model
        private currentDragOperation:string = "none";

        // helper flag for preventing the d'n'd iteration to run when the previous iteration did not yet finish
        private iterationLock:boolean = false;
        // reference obtained from setInterval() for being able to stop the d'n'd iteration
        private intervalId:number = null;

        // bound callback for `touchmove`
        private touchMoveHandler:EventListener;
        // bound callback for `touchend touchcancel`
        private touchEndOrCancelHandler:EventListener;
        // the last touch event that contained the original touch that started the drag operation
        private lastTouchEvent:TouchEvent = null;

        // the identifier for the touch that initiated the drag operation
        private initialDragTouchIdentifier:number = null;

        // the state of the drag operation
        private dragOperationState:DragOperationState = DragOperationState.POTENTIAL;

        constructor( private config:InternalConfig, private sourceNode:Element, initialEvent:TouchEvent, private dragOperationEndedCb:( sourceNode:Element, event:TouchEvent, state:DragOperationState )=>void ) {
            config.log( "setting up potential drag operation.." );

            // create bound event listeners
            this.touchMoveHandler = this.onTouchMove.bind( this );
            this.touchEndOrCancelHandler = this.onTouchEndOrCancel.bind( this );

            this.lastTouchEvent = initialEvent;
            this.initialDragTouchIdentifier = this.lastTouchEvent.changedTouches[ 0 ].identifier;

            document.addEventListener( "touchmove", this.touchMoveHandler );
            document.addEventListener( "touchend", this.touchEndOrCancelHandler );
            document.addEventListener( "touchcancel", this.touchEndOrCancelHandler );

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
        }

        //<editor-fold desc="setup/teardown">

        /**
         * Setup dragImage, input listeners and the drag
         * and drop process model iteration interval.
         */
        private setupDragAndDropOperation() {
            this.config.log( "starting drag and drop operation" );

            this.dragOperationState = DragOperationState.STARTED;

            this.dragDataStore = new DragDataStore();
            this.dataTransfer = new DataTransfer( this.dragDataStore );

            // 8. Update the drag data store default feedback as appropriate for the user agent
            // (if the user is dragging the selection, then the selection would likely be the basis for this feedback;
            // if the user is dragging an element, then that element's rendering would be used; if the drag began outside the user agent,
            // then the platform conventions for determining the drag feedback should be used).
            this.createDragImage( this.lastTouchEvent );

            // 9. Fire a DND event named dragstart at the source node.
            if( this.dragstart( this.sourceNode ) ) {
                this.config.log( "dragstart cancelled" );
                // dragstart has been prevented -> cancel d'n'd
                this.dragOperationState = DragOperationState.CANCELLED;
                this.cleanup();
                return;
            }

            this.snapbackEndedCb = this.snapbackTransitionEnded.bind( this );

            // 10. Initiate the drag-and-drop operation in a manner consistent with platform conventions, and as described below.
            this.intervalId = setInterval( ()=> {

                // If the user agent is still performing the previous iteration of the sequence (if any) when the next iteration becomes due,
                // abort these steps for this iteration (effectively "skipping missed frames" of the drag-and-drop operation).
                if( this.iterationLock ) {
                    this.config.log( 'iteration skipped because previous iteration hast not yet finished.' );
                    return;
                }
                this.iterationLock = true;

                this.dragAndDropProcessModelIteration();

                this.iterationLock = false;
            }, this.config.iterationInterval );
        }

        /**
         * Clean intervals, remove DOM elements,
         * remove listeners, delete references.
         * Goal is no memory leaks, obviously.
         *
         * Tell the global drag and drop initializer that this operation finished, which enables enforcing only one drag operation at a time.
         */
        private cleanup() {
            this.config.log( "cleanup" );

            if( this.intervalId ) {
                clearInterval( this.intervalId );
                this.intervalId = null;
            }

            document.removeEventListener( "touchmove", this.touchMoveHandler );
            document.removeEventListener( "touchend", this.touchEndOrCancelHandler );
            document.removeEventListener( "touchcancel", this.touchEndOrCancelHandler );

            if( this.dragImage != null ) {
                this.dragImage.parentNode.removeChild( this.dragImage );
                this.dragImage = null;
            }

            this.dataTransfer = null;
            this.dragDataStore = null;
            this.immediateUserSelection = null;
            this.currentDropTarget = null;

            this.touchEndOrCancelHandler = null;
            this.touchMoveHandler = null;
            this.snapbackEndedCb = null;

            this.dragOperationEndedCb( this.sourceNode, this.lastTouchEvent, this.dragOperationState );

            this.lastTouchEvent = null;
        }

        //</editor-fold>

        //<editor-fold desc="touch handlers>

        private onTouchMove( event:TouchEvent ) {

            if( Util.IsTouchIdentifierContainedInTouchEvent( event, this.initialDragTouchIdentifier ) === false ) {
                return;
            }

            // drag operation did not start yet but on movement it should start
            if( this.dragOperationState === DragOperationState.POTENTIAL ) {
                //TODO check for some kind of threshold to overcome before starting a drag operation?
                this.setupDragAndDropOperation();
                return;
            }

            // we emulate d'n'd so we dont want any defaults to apply
            event.preventDefault();
            event.stopImmediatePropagation();

            this.lastTouchEvent = event;

            //TODO refactor, improve and put in method because it is used in another place when initializing drag image position
            var pageXs = [], pageYs = [];
            [].forEach.call( event.changedTouches, function( touch, index ) {
                pageXs.push( touch.pageX );
                pageYs.push( touch.pageY );
            } );

            var x = Util.Average( pageXs ) - (parseInt( <any>this.dragImage.offsetWidth, 10 ) / 2);
            var y = Util.Average( pageYs ) - (parseInt( <any>this.dragImage.offsetHeight, 10 ) / 2);

            this.translateDragImage( x, y );
        }

        private onTouchEndOrCancel( event:TouchEvent ) {

            if( Util.IsTouchIdentifierContainedInTouchEvent( event, this.initialDragTouchIdentifier ) === false ) {
                return;
            }

            // drag operation did not even start
            if( this.dragOperationState === DragOperationState.POTENTIAL ) {
                this.cleanup();
                return;
            }

            // we emulate d'n'd so we dont want any defaults to apply
            event.preventDefault();
            event.stopImmediatePropagation();

            this.config.log( "touch cancelled or ended" );
            this.lastTouchEvent = event;

            this.dragOperationState = (event.type === "touchcancel") ? DragOperationState.CANCELLED : DragOperationState.ENDED;
        }

        //</editor-fold>

        //<editor-fold desc="view feedback">

        /**
         * duplicateStyle expects dstNode to be a clone of srcNode
         * @param srcNode
         * @param dstNode
         * @constructor
         */
        public static PrepareNodeCopyAsDragImage( srcNode, dstNode ) {
            // Is this node an element?
            if( srcNode.nodeType === 1 ) {
                // Remove any potential conflict attributes
                dstNode.removeAttribute( "id" );
                dstNode.removeAttribute( "draggable" );
            }

            // Do the same for the children
            if( srcNode.hasChildNodes() ) {
                for( var i = 0; i < srcNode.childNodes.length; i++ ) {
                    DragOperationController.PrepareNodeCopyAsDragImage( srcNode.childNodes[ i ], dstNode.childNodes[ i ] );
                }
            }
        }

        // css related stuff for applying a cross-browser working transform property to the drag image.
        private static transform_css_vendor_prefixes = [ "", "-webkit-" ];
        private static transform_css_regex = /translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g;

        /**
         * Create a copy of the source node to be used as drag image.
         *
         * @param event
         */
        private createDragImage( event:TouchEvent ) {

            this.dragImage = <HTMLElement>this.sourceNode.cloneNode( true );

            // this removes any id's and stuff that could interfere with drag and drop
            DragOperationController.PrepareNodeCopyAsDragImage( this.sourceNode, this.dragImage );

            // set layout styles for freely moving it around
            this.dragImage.style[ "position" ] = "absolute";
            this.dragImage.style[ "left" ] = "0px";
            this.dragImage.style[ "top" ] = "0px";
            // on top of all
            this.dragImage.style[ "z-index" ] = "999999";
            // no interaction with the drag image, pls! this is also important to make the drag image transparent for hit-testing
            // hit testing is done in the drag and drop iteration to find the element the user currently is hovering over while dragging
            // if pointer-events is not none or a browser does behave in an unexpected way than the hit test will break
            this.dragImage.style[ "pointer-events" ] = "none";

            // extract transform css
            DragOperationController.transform_css_vendor_prefixes.forEach( ( vendor )=> {
                var prefixedCssProperty = vendor + "transform";
                var transform = this.dragImage.style[ prefixedCssProperty ];
                if( typeof transform !== "undefined" ) {
                    if( transform !== "none" ) {
                        this.transformStyleMixins[ prefixedCssProperty ] = transform.replace( DragOperationController.transform_css_regex, '' );
                    }
                    else {
                        this.transformStyleMixins[ prefixedCssProperty ] = "";
                    }
                }
            } );

            // add polyfill class for default styling
            this.dragImage.classList.add( "mobile-dnd-poly-drag-image" );
            // add user config class
            if( this.config.dragImageClass ) {
                this.dragImage.classList.add( this.config.dragImageClass );
            }

            // calc position by looking at all involved touches
            var pageXs = [], pageYs = [];
            [].forEach.call( event.changedTouches, function( touch, index ) {
                pageXs.push( touch.pageX );
                pageYs.push( touch.pageY );
            } );
            var x = Util.Average( pageXs ) - (parseInt( <any>(<HTMLElement>this.sourceNode).offsetWidth, 10 ) / 2);
            var y = Util.Average( pageYs ) - (parseInt( <any>(<HTMLElement>this.sourceNode).offsetHeight, 10 ) / 2);

            // apply the translate
            this.translateDragImage( x, y );

            // append the dragImage as sibling to the source node, this enables to leave styling to existing css classes
            this.sourceNode.parentNode.insertBefore( this.dragImage, this.sourceNode.nextSibling );
            //this.doc.body.appendChild( this.dragImage ); //fallback to above
        }

        private translateDragImage( x:number, y:number ) {
            // using translate3d for best performance
            var translate = " translate3d(" + x + "px," + y + "px, 0)";

            // apply css property
            Util.ForIn( this.transformStyleMixins, ( value, key )=> {
                this.dragImage.style[ key ] = value + translate;
            } );
        }

        /**
         * Create snapback effect by applying css with transition
         * and cleanup after transition has ended.
         */
        private snapbackDragImage() {
            this.config.log( "starting dragimage snap back" );

            // setup transitionend listeners
            this.dragImage.addEventListener( "transitionend", this.snapbackEndedCb );
            this.dragImage.addEventListener( "webkitTransitionEnd", this.snapbackEndedCb );

            // add class containing transition rules
            this.dragImage.classList.add( "snapback" );

            // calc source node position
            //TODO refactor, test layout with different css source node styling, put in method?
            var rect = (<HTMLElement>this.sourceNode).getBoundingClientRect();
            var elementLeft, elementTop; //x and y
            var scrollTop = document.documentElement.scrollTop ?
                document.documentElement.scrollTop : document.body.scrollTop;
            var scrollLeft = document.documentElement.scrollLeft ?
                document.documentElement.scrollLeft : document.body.scrollLeft;
            elementTop = rect.top + scrollTop;
            elementLeft = rect.left + scrollLeft;
            var cs = window.getComputedStyle( this.sourceNode, null );
            var leftPadding = parseInt( cs.getPropertyValue( "padding-left" ), 10 );
            var topPadding = parseInt( cs.getPropertyValue( "padding-top" ), 10 );
            elementLeft -= leftPadding;
            elementTop -= topPadding;

            // apply the translate
            this.translateDragImage( elementLeft, elementTop );
        }

        /**
         * logic for snapback transition end, does finish the drag operation
         */
        private snapbackTransitionEnded() {
            this.config.log( "dragimage snap back transition ended" );

            // remove the previously applied listeners
            this.dragImage.removeEventListener( "transitionend", this.snapbackEndedCb );
            this.dragImage.removeEventListener( "webkitTransitionEnd", this.snapbackEndedCb );

            // remove the class // basically not needed because the element will be removed anyway
            //this.dragImage.classList.remove( "snapback" );

            // Fire a DND event named dragend at the source node.
            this.dragend( this.sourceNode );
            this.dragOperationState = DragOperationState.ENDED;
            // drag operation over and out
            this.cleanup();
        }

        //</editor-fold>

        //<editor-fold desc="dnd logic">

        /**
         * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
         *
         * //TODO check if the current processing model is the same as the newly referenced whatwg
         */
        private dragAndDropProcessModelIteration():void {

            // Fire a DND event named drag event at the source node.
            var dragCancelled = this.drag( this.sourceNode );
            if( dragCancelled ) {
                this.config.log( "drag event cancelled." );
                // If this event is canceled, the user agent must set the current drag operation to "none" (no drag operation).
                this.currentDragOperation = "none";
            }

            // Otherwise, if the user ended the drag-and-drop operation (e.g. by releasing the mouse button in a mouse-driven drag-and-drop interface),
            // or if the drag event was canceled, then this will be the last iteration.
            if( dragCancelled || this.dragOperationState === DragOperationState.ENDED || this.dragOperationState === DragOperationState.CANCELLED ) {

                var dragFailed = this.DragOperationEnded( this.dragOperationState );

                // if drag failed transition snap back
                if( dragFailed ) {
                    this.snapbackDragImage();
                    return;
                }

                // Otherwise immediately
                // Fire a DND event named dragend at the source node.
                this.dragend( this.sourceNode );
                this.dragOperationState = DragOperationState.ENDED;
                this.cleanup();
                return;
            }

            // If the drag event was not canceled and the user has not ended the drag-and-drop operation,
            // check the state of the drag-and-drop operation, as follows:

            var touch:Touch = Util.GetTouchContainedInTouchEventByIdentifier( this.lastTouchEvent, this.initialDragTouchIdentifier );
            if( !touch ) {
                this.config.log( "touch event that did not contain initial drag operation touch slipped through" );
                return;
            }
            var newUserSelection:HTMLElement = <HTMLElement>Util.ElementFromTouch( this.doc, touch );

            var previousTargetElement = this.currentDropTarget;

            // If the user is indicating a different immediate user selection than during the last iteration (or if this is the first iteration),
            // and if this immediate user selection is not the same as the current target element,
            // then fire a DND event named dragexit at the current target element,
            // and then update the current target element as follows:
            if( newUserSelection !== this.immediateUserSelection && newUserSelection !== this.currentDropTarget ) {

                this.immediateUserSelection = newUserSelection;

                if( this.currentDropTarget !== null ) {
                    this.dragexit( this.currentDropTarget );
                }

                // If the new immediate user selection is null
                if( this.immediateUserSelection === null ) {
                    //Set the current target element to null also.
                    this.currentDropTarget = this.immediateUserSelection;
                    this.config.log( "current drop target changed to null" );
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
                    if( this.dragenter( this.immediateUserSelection ) ) {
                        this.config.log( "dragenter default prevented" );
                        // If the event is canceled, then set the current target element to the immediate user selection.
                        this.currentDropTarget = this.immediateUserSelection;
                        this.currentDragOperation = DragOperationController.DetermineDragOperation( this.dataTransfer );
                    }
                    // Otherwise, run the appropriate step from the following list:
                    else {

                        this.config.log( "dragenter not prevented, searching for dropzone.." );

                        var newTarget = DragOperationController.FindDropzoneElement( this.immediateUserSelection );

                        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
                        // If the current target element is a text field (e.g. textarea, or an input element whose type attribute is in the Text state) or an
                        // editable element, and the drag data store item list has an item with the drag data item type string "text/plain" and the drag data
                        // item kind Plain Unicode string
                        //if( Util.ElementIsTextDropzone( this.immediateUserSelection, this.dragDataStore ) ) {
                        //Set the current target element to the immediate user selection anyway.
                        //this.currentDropTarget = this.immediateUserSelection;
                        //}
                        //else
                        // If the current target element is an element with a dropzone attribute that matches the drag data store
                        if( newTarget === this.immediateUserSelection &&
                            DragOperationController.GetOperationForMatchingDropzone( this.immediateUserSelection, this.dragDataStore ) !== "none" ) {
                            // Set the current target element to the immediate user selection anyway.
                            this.currentDropTarget = this.immediateUserSelection;
                        }
                        // If the immediate user selection is an element that itself has an ancestor element
                        // with a dropzone attribute that matches the drag data store
                        else if( newTarget !== null && DragOperationController.GetOperationForMatchingDropzone( newTarget, this.dragDataStore ) ) {

                            // If the immediate user selection is new target, then leave the current target element unchanged.

                            // Otherwise, fire a DND event named dragenter at new target, with the current current target element
                            // as the specific related target. Then, set the current target element to new target,
                            // regardless of whether that event was canceled or not.
                            this.dragenter( newTarget, this.currentDropTarget );
                            this.currentDropTarget = newTarget;
                        }
                        // If the current target element is the body element
                        else if( this.immediateUserSelection === this.doc.body ) {
                            // Leave the current target element unchanged.
                        }
                        // Otherwise
                        else {
                            // Fire a DND event named dragenter at the body element, and set the current target element to the body element, regardless of
                            // whether that event was canceled or not.
                            // Note: If the body element is null, then the event will be fired at the Document object (as
                            // required by the definition of the body element), but the current target element would be set to null, not the Document object.

                            // We do not listen to what the spec says here because this results in doubled events on the body/document because if the first one
                            // was not cancelled it will have bubbled up to the body already ;)
                            //  this.dragenter( this.doc.body );

                            this.currentDropTarget = this.doc.body;
                        }
                    }
                }
            }

            // If the previous step caused the current target element to change,
            // and if the previous target element was not null or a part of a non-DOM document,
            // then fire a DND event named dragleave at the previous target element.
            if( previousTargetElement !== this.currentDropTarget && (Util.IsDOMElement( previousTargetElement ) ) ) {

                this.config.log( "current drop target changed." );
                this.dragleave( previousTargetElement, this.currentDropTarget );
            }

            // If the current target element is a DOM element, then fire a DND event named dragover at this current target element.
            if( Util.IsDOMElement( this.currentDropTarget ) ) {

                // If the dragover event is not canceled, run the appropriate step from the following list:
                if( this.dragover( this.currentDropTarget ) === false ) {

                    this.config.log( "dragover not prevented. checking for dom element with dropzone-attr" );

                    // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
                    // If the current target element is a text field (e.g. textarea, or an input element whose type attribute is in the Text state) or
                    // an editable element, and the drag data store item list has an item with the drag data item type string "text/plain" and the drag
                    // data item kind Plain Unicode string
                    //if( Util.ElementIsTextDropzone( this.currentDropTarget, this.dragDataStore ) ) {
                    // Set the current drag operation to either "copy" or "move", as appropriate given the platform conventions.
                    //this.currentDragOperation = "copy"; //or move. spec says its platform specific behaviour.
                    //}
                    //else {
                    // If the current target element is an element with a dropzone attribute that matches the drag data store
                    this.currentDragOperation = DragOperationController.GetOperationForMatchingDropzone( this.currentDropTarget, this.dragDataStore );
                    //}
                }
                // Otherwise (if the dragover event is canceled), set the current drag operation based on the values of the effectAllowed and
                // dropEffect attributes of the DragEvent object's dataTransfer object as they stood after the event dispatch finished
                else {

                    this.config.log( "dragover prevented -> valid drop target?" );

                    this.currentDragOperation = DragOperationController.DetermineDragOperation( this.dataTransfer );

                    this.config.log( "current drag operation after dragover: " + this.currentDragOperation );
                }
            }

            this.config.log( "d'n'd iteration ended. current drag operation: " + this.currentDragOperation );

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

            this.dragImage.classList.remove( "copy" );
            this.dragImage.classList.remove( "link" );
            this.dragImage.classList.remove( "move" );
            this.dragImage.classList.remove( "none" );

            this.dragImage.classList.add( this.currentDragOperation );
        }

        /**
         * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
         */
        private DragOperationEnded( state:DragOperationState ):boolean {

            this.config.log( "drag operation end detected. state: " + DragOperationState[ state ] );

            //var dropped:boolean = undefined;

            // Run the following steps, then stop the drag-and-drop operation:

            // If the current drag operation is "none" (no drag operation), or,
            // if the user ended the drag-and-drop operation by canceling it (e.g. by hitting the Escape key), or
            // if the current target element is null, then the drag operation failed.
            var dragFailed = (this.currentDragOperation === "none"
                              || this.currentDropTarget === null
                              || state === DragOperationState.CANCELLED);
            if( dragFailed ) {

                // Run these substeps:

                // Let dropped be false.
                //dropped = false;

                // If the current target element is a DOM element, fire a DND event named dragleave at it;
                if( Util.IsDOMElement( this.currentDropTarget ) ) {
                    this.dragleave( this.currentDropTarget );
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
                if( Util.IsDOMElement( this.currentDropTarget ) ) {

                    // If the event is canceled, set the current drag operation to the value of the dropEffect attribute of the
                    // DragEvent object's dataTransfer object as it stood after the event dispatch finished.
                    if( this.drop( this.currentDropTarget ) === true ) {

                        this.currentDragOperation = this.dataTransfer.dropEffect;
                    }
                    // Otherwise, the event is not canceled; perform the event's default action, which depends on the exact target as follows:
                    else {

                        // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
                        // If the current target element is a text field (e.g. textarea, or an input element whose type attribute is in the Text state)
                        // or an editable element,
                        // and the drag data store item list has an item with the drag data item type string "text/plain"
                        // and the drag data item kind Plain Unicode string
                        //if( Util.ElementIsTextDropzone( this.currentDropTarget, this.dragDataStore ) ) {
                        // Insert the actual data of the first item in the drag data store item list to have a drag data item type string of
                        // "text/plain" and a drag data item kind that is Plain Unicode string into the text field or editable element in a manner
                        // consistent with platform-specific conventions (e.g. inserting it at the current mouse cursor position, or inserting it at
                        // the end of the field).
                        //}
                        // Otherwise
                        //else {
                        // Reset the current drag operation to "none".
                        this.currentDragOperation = "none";
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
            //if( Util.ElementIsTextDropzone( this.currentDropTarget ) === false ) {
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

        /**
         * according to https://html.spec.whatwg.org/multipage/interaction.html#drag-and-drop-processing-model
         *
         * as per the following table:
         * ---------------------------------------------------------------------------------------------------------
         * effectAllowed                                                    |   dropEffect  |   Drag operation
         * ---------------------------------------------------------------------------------------------------------
         * "uninitialized", "copy", "copyLink", "copyMove", or "all"        |   "copy"        |   "copy"
         * "uninitialized", "link", "copyLink", "linkMove", or "all"        |   "link"        |   "link"
         * "uninitialized", "move", "copyMove", "linkMove", or "all"        |   "move"        |   "move"
         * Any other case                                                                   |   "none"
         * ---------------------------------------------------------------------------------------------------------
         *
         * @param dataTransfer
         * @returns {any}
         * @constructor
         */
        public static DetermineDragOperation( dataTransfer:DataTransfer ):string {

            if( dataTransfer.effectAllowed === "uninitialized" || dataTransfer.effectAllowed === "all" ) {
                return dataTransfer.dropEffect;
            }

            if( dataTransfer.dropEffect === "copy" ) {
                if( dataTransfer.effectAllowed.indexOf( "copy" ) === 0 ) {
                    return "copy";
                }
            }
            else if( dataTransfer.dropEffect === "link" ) {
                if( dataTransfer.effectAllowed.indexOf( "link" ) === 0 || dataTransfer.effectAllowed.indexOf( "Link" ) > -1 ) {
                    return "link";
                }
            }
            else if( dataTransfer.dropEffect === "move" ) {
                if( dataTransfer.effectAllowed.indexOf( "move" ) === 0 || dataTransfer.effectAllowed.indexOf( "Move" ) > -1 ) {
                    return "link";
                }
            }

            return "none";
        }

        /**
         * Implements "6." in the processing steps defined for a dnd event
         * https://html.spec.whatwg.org/multipage/interaction.html#dragevent
         *
         * | effectAllowed                                                                      |    dropEffect
         * | ---------------------------------------------------------------------------------- | --------------
         * | "none"                                                                                |   "none"
         * | "copy"                                                                                |   "copy"
         * | "copyLink"                                                                            |   "copy", or, if appropriate, "link"
         * | "copyMove"                                                                            |   "copy", or, if appropriate, "move"
         * | "all"                                                                                |   "copy", or, if appropriate, either "link" or "move"
         * | "link"                                                                                |   "link"
         * | "linkMove"                                                                            |   "link", or, if appropriate, "move"
         * | "move"                                                                                |   "move"
         * | "uninitialized" when what is being dragged is a selection from a text field        |    "move", or, if appropriate, either "copy" or "link"
         * | "uninitialized" when what is being dragged is a selection                          |    "copy", or, if appropriate, either "link" or "move"
         * | "uninitialized" when what is being dragged is an a element with an href attribute    |   "link", or, if appropriate, either "copy" or "move"
         * | Any other case                                                                        |   "copy", or, if appropriate, either "link" or "move"
         *
         * @param effectAllowed
         * @param sourceNode
         * @returns {any}
         * @constructor
         */
        public static DetermineDropEffect( effectAllowed:string, sourceNode:Element ) {

            if( effectAllowed === "none" ) {
                return "none";
            }

            if( effectAllowed.indexOf( "copy" ) === 0 || effectAllowed === "all" ) {
                return "copy";
            }

            if( effectAllowed.indexOf( "link" ) === 0 ) {
                return "link";
            }

            if( effectAllowed === "move" ) {
                return "move";
            }

            if( effectAllowed === "uninitialized" ) {

                // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
                //if( sourceNode.nodeType === 1 ) {
                //
                //return "move";
                //}

                if( sourceNode.nodeType === 3 && (<HTMLElement>sourceNode).tagName === "A" ) {
                    return "link";
                }
            }

            return "copy";
        }

        /**
         * // THIS IS SKIPPED SINCE SUPPORT IS ONLY AVAILABLE FOR DOM ELEMENTS
         * @param element
         * @param dragDataStore
         * @returns {boolean}
         * @constructor
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

        private static FindDropzoneElement( element:HTMLElement ):HTMLElement {

            if( element.hasAttribute( "dropzone" ) ) {
                return element;
            }

            if( element === window.document.body ) {
                return null;
            }

            return DragOperationController.FindDropzoneElement( element.parentElement );
        }

        /**
         * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#the-dropzone-attribute
         * by implementing the dropzone processing steps.
         *
         * @param element
         * @param dragDataStore
         * @param recurseOnAncestors
         *
         * @returns {any}
         * @constructor
         */
        private static GetOperationForMatchingDropzone( element:HTMLElement, dragDataStore:DragDataStore ):string {

            // If the current target element is an element with a dropzone attribute that matches the drag data store and specifies an operation
            //      Set the current drag operation to the operation specified by the dropzone attribute of the current target element.
            // If the current target element is an element with a dropzone attribute that matches the drag data store and does not specify an operation
            //      Set the current drag operation to "copy".
            // Otherwise
            //      Reset the current drag operation to "none".
            var value = element.getAttribute( "dropzone" );
            if( !value ) {

                return "none";
            }

            var matched = false;
            var operation;
            var keywords = value.split( " " );

            for( var i:number = 0; i < keywords.length; i++ ) {
                var keyword = keywords[ i ];

                if( keyword === "copy" || keyword === "move" || keyword === "link" ) {
                    if( !operation ) {
                        operation = keyword;
                    }
                    continue;
                }

                if( keyword.length < 3 || keyword[ 1 ] !== ":" ) {
                    continue;
                }

                var splitKeyword = keyword.split( ":" );
                var kind = splitKeyword[ 0 ].toLowerCase();
                var type = splitKeyword[ 1 ].toLowerCase();

                if( dragDataStore.types.indexOf( type ) > -1 ) {
                    matched = true;
                }
            }

            if( !matched ) {
                return "none";
            }

            if( !operation ) {
                return "copy";
            }

            return operation;
        }

        //</editor-fold>

        //<editor-fold desc="dnd events">

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private dragstart( targetElement:Element ):boolean {
            this.config.log( "dragstart" );

            this.dragDataStore.mode = DragDataStoreMode.READWRITE;
            this.dataTransfer.dropEffect = "none";

            var evt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "dragstart", true, this.doc.defaultView, this.dataTransfer, null );
            var cancelled = !targetElement.dispatchEvent( evt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private drag( targetElement:Element ):boolean {
            this.config.log( "drag" );

            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = "none";

            var evt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "drag", true, this.doc.defaultView, this.dataTransfer, null );
            var cancelled = !targetElement.dispatchEvent( evt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private dragenter( targetElement:Element, relatedTarget:Element = null ):boolean {
            this.config.log( "dragenter" );

            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = DragOperationController.DetermineDropEffect( this.dragDataStore.effectAllowed, this.sourceNode );

            var enterEvt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "dragenter", true, this.doc.defaultView, this.dataTransfer, relatedTarget );
            var cancelled = !targetElement.dispatchEvent( enterEvt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private dragover( targetElement:Element ):boolean {
            this.config.log( "dragover" );

            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = DragOperationController.DetermineDropEffect( this.dragDataStore.effectAllowed, this.sourceNode );

            //TODO does a relatedTarget exist for this event?
            var overEvt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "dragover", true, this.doc.defaultView, this.dataTransfer, null );
            var cancelled = !targetElement.dispatchEvent( overEvt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private dragexit( targetElement:Element ):boolean {
            this.config.log( "dragexit" );

            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = "none";

            var leaveEvt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "dragexit", false, this.doc.defaultView, this.dataTransfer, null );
            var cancelled = !targetElement.dispatchEvent( leaveEvt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private dragleave( targetElement:Element, relatedTarget:Element = null ):boolean {
            this.config.log( "dragleave" );

            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = "none";

            var leaveEvt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "dragleave", false, this.doc.defaultView, this.dataTransfer, relatedTarget );
            var cancelled = !targetElement.dispatchEvent( leaveEvt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private dragend( targetElement:Element ):boolean {
            this.config.log( "dragend" );

            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = this.currentDragOperation;

            var endEvt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "dragend", false, this.doc.defaultView, this.dataTransfer, null );
            var cancelled = !targetElement.dispatchEvent( endEvt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        /**
         * Reference https://html.spec.whatwg.org/multipage/interaction.html#dndevents
         *
         * @param targetElement
         * @returns {boolean}
         */
        private drop( targetElement:Element ) {
            this.config.log( "drop" );

            this.dragDataStore.mode = DragDataStoreMode.READONLY;
            this.dataTransfer.dropEffect = this.currentDragOperation;

            var dropEvt = Util.CreateDragEventFromTouch( this.lastTouchEvent, "drop", false, this.doc.defaultView, this.dataTransfer, null );
            var cancelled = !targetElement.dispatchEvent( dropEvt );

            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;

            return cancelled;
        }

        //</editor-fold>
    }

    /**
     * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#datatransfer
     *
     * Does not implement it strictly because File types are not supported by this polyfill.
     *
     * Also is designed to not be recreated for each drag event but for using
     * one instance throughout a drag operation. This is done by using
     * an additional data store mode that is used to "disconnect"
     * the data store from the data transfer instance. By setting
     * the data store mode to _DISCONNECTED you can make the
     * data transfer object instance to be "invalid" when the event handler
     * has been called, because data transfer objects are only to be
     * interacted with in event handlers.
     */
    class DataTransfer {

        private static AllowedEffects = [ "none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all" ];
        private static DropEffects = [ "none", "copy", "move", "link" ];

        private _dropEffect:string = "none";

        constructor( private dataStore:DragDataStore ) {
        }

        public get files():FileList {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return null;
            }
            //throw new Error( 'mobile-drag-and-drop-polyfill does not support file drag and drop' );
            return null;
        }

        //TODO do we need support for items property in DataTransfer polyfill?
        public get items():DataTransferItemList {
            return null;
        }

        public get types():Array<string> {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return null;
            }

            return Object.freeze( this.dataStore.types );
        }

        public setData( type:string, data:string ):void {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return;
            }

            if( this.dataStore.mode !== DragDataStoreMode.READWRITE ) {
                return;
            }

            if( type.indexOf( " " ) > -1 ) {
                throw new Error( "Space character not allowed in drag data item type string" );
            }

            this.dataStore.data[ type ] = data;
            var index = this.dataStore.types.indexOf( type );
            if( index > -1 ) {
                this.dataStore.types.push( type );
            }
        }

        public getData( type:string ):string {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return null;
            }

            if( this.dataStore.mode === DragDataStoreMode.PROTECTED ) {
                return null;
            }

            return this.dataStore.data[ type ] || "";
        }

        public clearData( format?:string ):void {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return;
            }

            // delete data for format
            if( format && this.dataStore.data[ format ] ) {
                delete this.dataStore.data[ format ];
                var index = this.dataStore.types.indexOf( format );
                if( index > -1 ) {
                    this.dataStore.types.splice( index, 1 );
                }
                return;
            }
            // delete all data
            this.dataStore.data = {};
            this.dataStore.types = [];
        }

        public setDragImage( image:Element, x:number, y:number ):void {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return null;
            }

            //TODO setdragimage support for setting dragimage to some custom element
        }

        public get effectAllowed() {

            return this.dataStore.effectAllowed;
        }

        //TODO effectAllowed can be set only on dragstart
        public set effectAllowed( value ) {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return;
            }

            if( DataTransfer.AllowedEffects.indexOf( value ) === -1 ) {
                return;
            }

            this.dataStore.effectAllowed = value;
        }

        public get dropEffect() {

            return this._dropEffect;
        }

        public set dropEffect( value ) {
            if( this.dataStore.mode === DragDataStoreMode._DISCONNECTED ) {
                return;
            }

            if( DataTransfer.DropEffects.indexOf( value ) === -1 ) {
                return;
            }
            this._dropEffect = value;
        }
    }

    /**
     * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#drag-data-store-mode
     *
     * DataStore mode enum with an extra mode that acts as helper for
     * disconnecting the data store from a data transfer item.
     */
    enum DragDataStoreMode {
        // adding a disabled here because we need a special state in the data transfer when there is no event dispatched
        _DISCONNECTED,
        READONLY,
        READWRITE,
        PROTECTED
    }

    /**
     * Polyfills https://html.spec.whatwg.org/multipage/interaction.html#the-drag-data-store
     */
    class DragDataStore {
        public mode:DragDataStoreMode = DragDataStoreMode.PROTECTED;
        public data = {};
        public types = [];
        public effectAllowed = "uninitialized";
    }

    //</editor-fold>

    class Util {

        public static ForIn( obj:Object, cb:( value, key )=>void ) {
            for( var key in obj ) {
                if( obj.hasOwnProperty( key ) === false ) {
                    continue;
                }
                cb( obj[ key ], key );
            }
        }

        public static Merge( target:Object, obj:Object ) {
            if( !obj ) {
                return;
            }

            for( var key in obj ) {
                if( obj.hasOwnProperty( key ) === false ) {
                    continue;
                }
                target[ key ] = obj[ key ];
            }
        }

        public static Average( array:Array<number> ) {
            if( array.length === 0 ) {
                return 0;
            }
            return array.reduce( (function( s, v ) {
                    return v + s;
                }), 0 ) / array.length;
        }

        public static IsDOMElement( object:any ) {
            return object && object.tagName;
        }

        public static IsTouchIdentifierContainedInTouchEvent( newTouch:TouchEvent, touchIdentifier:number ) {
            for( var i:number = 0; i < newTouch.changedTouches.length; i++ ) {
                var touch = newTouch.changedTouches[ i ];
                if( touch.identifier === touchIdentifier ) {
                    return true;
                }
            }
            return false;
        }

        public static GetTouchContainedInTouchEventByIdentifier( newTouch:TouchEvent, touchIdentifier:number ) {
            for( var i:number = 0; i < newTouch.changedTouches.length; i++ ) {
                var touch = newTouch.changedTouches[ i ];
                if( touch.identifier === touchIdentifier ) {
                    return touch;
                }
            }
            return null;
        }

        //TODO initMouseEvent is deprecated, replace by MouseEvent constructor?
        //TODO integrate feature detection to switch to MouseEvent constructor
        public static CreateMouseEventFromTouch( e:TouchEvent, typeArg:string, cancelable:boolean = true, window:Window = document.defaultView, relatedTarget:Element = null ) {
            var clickEvt = document.createEvent( "MouseEvents" );
            var touch:Touch = e.changedTouches[ 0 ];

            //var x = touch[ this.config.coordinateSystemForElementFromPoint + 'X' ];
            //var y = touch[ this.config.coordinateSystemForElementFromPoint + 'Y' ];

            //dropEvt.offsetX = x - target.x;
            //dropEvt.offsetY = y - target.y;

            clickEvt.initMouseEvent( typeArg, true, cancelable, window, 1,
                touch.screenX, touch.screenY, touch.clientX, touch.clientY,
                e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, relatedTarget );
            return clickEvt;
        }

        //TODO integrate feature detection to switch to MouseEvent/DragEvent constructor if makes sense for simulating drag events and event constructors work
        // at all for our usecase TODO is offsetX offsetY a MUST for drag events?
        public static CreateDragEventFromTouch( e:TouchEvent, typeArg:string, cancelable:boolean, window:Window, dataTransfer:DataTransfer, relatedTarget:Element = null ) {

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

            //var x = touch[ this.config.coordinateSystemForElementFromPoint + 'X' ];
            //var y = touch[ this.config.coordinateSystemForElementFromPoint + 'Y' ];
            //dndEvent.offsetX = x - target.x;
            //dndEvent.offsetY = y - target.y;

            return dndEvent;
        }

        /**
         * Using elementFromPoint to detect the element under the users finger.
         *
         * @param doc
         * @param touch
         * @returns {Element}
         * @constructor
         */
        public static ElementFromTouch( doc:Document, touch:Touch ):Element {

            var target = doc.elementFromPoint(
                touch.clientX,
                touch.clientY
            );

            return target
        }
    }
}