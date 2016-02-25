module MobileDragAndDropPolyfill {

    var _options:ScrollOptions = {
        threshold: 50,
        velocity: 10
    };

    var _scrollIntention:Point = {
        x: 0,
        y: 0
    };

    var _scrollAnimationFrameId:any;

    //<editor-fold desc="public api">

    export interface ScrollOptions {
        // threshold in px. when distance between viewport edge and touch position is smaller start programmatic scroll.
        // defaults to 50px
        threshold?:number;
        // how much px will be scrolled per animation frame iteration
        // defaults to 10px
        velocity?:number;
    }

    export function SetOptions( options:ScrollOptions ):void {

        // overwrite defaults with input options
        Object.keys( options ).forEach( function( key ) {
            _options[ key ] = options[ key ];
        } );
    }

    export function HandleDragImageTranslateOverride( currentCoordinates:Point,
                                                      hoveredElement:HTMLElement,
                                                      translateDragImageFn:( scrollDiffX:number, scrollDiffY:number ) => void ):boolean {

        // update scroll intention and check if we should scroll at all
        var performScrollAnimation = updateScrollIntention( currentCoordinates, _options.threshold, _scrollIntention );

        // no animation in progress but scroll is intended
        if( performScrollAnimation ) {

            // setup scroll animation frame
            scheduleScrollAnimation( currentCoordinates, hoveredElement, translateDragImageFn );
        }
        else if( !!_scrollAnimationFrameId ) {

            window.cancelAnimationFrame( _scrollAnimationFrameId );
            _scrollAnimationFrameId = undefined;
        }

        return performScrollAnimation;
    }

    //</editor-fold>

    //<editor-fold desc="programmatic scroll animation frame handler">

    function scheduleScrollAnimation( currentCoordinates:Point, hoveredElement:HTMLElement, translateDragImageFn:( scrollDiffX:number, scrollDiffY:number ) => void ) {

        // prevent scheduling when already scheduled
        if( !!_scrollAnimationFrameId ) {

            return;
        }

        _scrollAnimationFrameId = window.requestAnimationFrame( () => {

            scrollAnimation( currentCoordinates, hoveredElement, translateDragImageFn );
        } );
    }

    function scrollAnimation( currentCoordinates:Point, hoveredElement:HTMLElement, translateDragImageFn:( scrollDiffX:number, scrollDiffY:number ) => void ) {

        var scrollDiffX = 0,
            scrollDiffY = 0;

        if( _scrollIntention.x ) {
            scrollDiffX = _scrollIntention.x * _options.velocity;
            getSetScroll( ScrollAxis.HORIZONTAL, scrollDiffX );
            currentCoordinates.x += scrollDiffX;
        }

        if( _scrollIntention.y ) {
            scrollDiffY = _scrollIntention.y * _options.velocity;
            getSetScroll( ScrollAxis.VERTICAL, scrollDiffY );
            currentCoordinates.y += scrollDiffY;
        }

        translateDragImageFn( scrollDiffX, scrollDiffY );

        // unschedule
        _scrollAnimationFrameId = undefined;

        // check if we should continue scrolling
        if( updateScrollIntention( currentCoordinates, _options.threshold, _scrollIntention ) ) {

            // re-schedule animation frame callback
            scheduleScrollAnimation( currentCoordinates, hoveredElement, translateDragImageFn );
        }
    }

    //</editor-fold>

    //<editor-fold desc="scroll checks">

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

    function updateScrollIntention( currentCoordinates:Point, threshold:number, scrollIntention:Point ):boolean {

        if( !currentCoordinates ) {

            // when coordinates become undefined drag operation stopped. stop scrolling also.
            return false;
        }

        scrollIntention.x = determineScrollIntention( currentCoordinates.x, window.innerWidth, threshold );
        scrollIntention.y = determineScrollIntention( currentCoordinates.y, window.innerHeight, threshold );

        if( scrollIntention.x && isScrollEndReached( ScrollAxis.HORIZONTAL, scrollIntention.x ) ) {

            // if scroll end is reached, reset to 0
            scrollIntention.x = 0;
        }

        if( scrollIntention.y && isScrollEndReached( ScrollAxis.VERTICAL, scrollIntention.y ) ) {

            // if scroll end is reached, reset to 0
            scrollIntention.y = 0;
        }

        return !!(scrollIntention.x || scrollIntention.y);
    }

    function isScrollEndReached( axis:ScrollAxis, scrollIntention:number ) {
        var scrollSizeProp = "scrollHeight",
            clientSizeProp = "innerHeight",
            scroll         = getSetScroll( axis );

        if( axis === ScrollAxis.HORIZONTAL ) {
            scrollSizeProp = "scrollWidth";
            clientSizeProp = "innerWidth";
        }

        // wants to scroll to the right/bottom
        if( scrollIntention > 0 ) {

            // abstracting away compatibility issues on scroll properties of document/body
            var scrollSize = document.body[ scrollSizeProp ] || document.documentElement[ scrollSizeProp ];

            var clientSize = window[ clientSizeProp ];

            // is already at the right/bottom edge
            return (scroll + clientSize) >= (scrollSize);
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

    //<editor-fold desc="scroll utils">

    const enum ScrollAxis {
        HORIZONTAL,
        VERTICAL
    }

    function getSetScroll( axis:ScrollAxis, scroll?:number ) {
        var prop = (axis === ScrollAxis.HORIZONTAL) ? "scrollLeft" : "scrollTop";

        // abstracting away compatibility issues on scroll properties of document/body

        if( arguments.length === 1 ) {
            return document.body[ prop ] || document.documentElement[ prop ];
        }

        document.documentElement[ prop ] += scroll;
        document.body[ prop ] += scroll;
    }

    //</editor-fold>
}
