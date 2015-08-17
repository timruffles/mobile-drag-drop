var MobileDragAndDropPolyfill;
(function (MobileDragAndDropPolyfill) {
    MobileDragAndDropPolyfill.Initialize = function (config) {
        DragAndDropInitializer.Initialize(config);
    };
    var DragAndDropInitializer = (function () {
        function DragAndDropInitializer() {
        }
        DragAndDropInitializer.Initialize = function (config) {
            var detectedFeatures = DragAndDropInitializer.DetectFeatures();
            if (detectedFeatures.userAgentNotSupportingNativeDnD === false
                && detectedFeatures.draggable
                && detectedFeatures.dragEvents) {
                return;
            }
            if (config) {
                Object.keys(config).forEach(function (key) {
                    DragAndDropInitializer.config[key] = config[key];
                });
            }
            console.log("Applying mobile drag and drop polyfill.");
            window.document.addEventListener("touchstart", DragAndDropInitializer.OnTouchstart);
        };
        DragAndDropInitializer.DetectFeatures = function () {
            var featureDetection = {
                draggable: ('draggable' in window.document.documentElement),
                dragEvents: ('ondragstart' in window.document.documentElement),
                touchEvents: ('ontouchstart' in window.document.documentElement),
                isBlinkEngine: !!(window.chrome) || /chrome/i.test(navigator.userAgent),
                userAgentNotSupportingNativeDnD: false
            };
            featureDetection.userAgentNotSupportingNativeDnD = (/iPad|iPhone|iPod|Android/.test(navigator.userAgent)
                ||
                    featureDetection.touchEvents && (featureDetection.isBlinkEngine));
            return featureDetection;
        };
        DragAndDropInitializer.OnTouchstart = function (e) {
            console.log("global touchstart");
            if (DragAndDropInitializer.activeDragOperation) {
                console.log("drag operation already active");
                return;
            }
            var dragTarget = DragAndDropInitializer.TryFindDraggableTarget(e);
            if (!dragTarget) {
                return;
            }
            e.preventDefault();
            try {
                DragAndDropInitializer.activeDragOperation = new DragOperationController(DragAndDropInitializer.config, dragTarget, e, DragAndDropInitializer.DragOperationEnded);
            }
            catch (err) {
                DragAndDropInitializer.DragOperationEnded(e, 3);
                throw err;
            }
        };
        DragAndDropInitializer.TryFindDraggableTarget = function (event) {
            //<spec>
            //1. Determine what is being dragged, as follows:
            var el = event.target;
            do {
                if (el.draggable === false) {
                    continue;
                }
                if (el.getAttribute && el.getAttribute("draggable") === "true") {
                    return el;
                }
            } while ((el = el.parentNode) && el !== window.document.body);
        };
        DragAndDropInitializer.DragOperationEnded = function (event, state) {
            DragAndDropInitializer.activeDragOperation = null;
            if (state === 0) {
                var target = event.target;
                var targetTagName = target.tagName;
                var mouseEventType;
                switch (targetTagName) {
                    case "SELECT":
                        mouseEventType = "mousedown";
                        break;
                    case "INPUT":
                    case "TEXTAREA":
                        target.focus();
                    default:
                        mouseEventType = "click";
                }
                console.log("No movement on draggable. Dispatching " + mouseEventType + " on " + targetTagName + " ..");
                var defaultEvent = Util.CreateMouseEventFromTouch(target, event, mouseEventType);
                target.dispatchEvent(defaultEvent);
            }
        };
        DragAndDropInitializer.config = {
            dragImageClass: null,
            iterationInterval: 150,
            scrollThreshold: 50,
            scrollVelocity: 10,
            debug: false
        };
        return DragAndDropInitializer;
    })();
    var DragOperationController = (function () {
        function DragOperationController(config, sourceNode, initialEvent, dragOperationEndedCb) {
            this.config = config;
            this.sourceNode = sourceNode;
            this.dragOperationEndedCb = dragOperationEndedCb;
            this.immediateUserSelection = null;
            this.currentDropTarget = null;
            this.dragOperationState = 0;
            console.log("setting up potential drag operation..");
            if (this.config.debug) {
                DragOperationController.debug_class = DragOperationController.class_prefix + "debug";
                DragOperationController.debug_class_user_selection = DragOperationController.class_prefix + "immediate-user-selection";
                DragOperationController.debug_class_drop_target = DragOperationController.class_prefix + "current-drop-target";
                DragOperationController.debug_class_event_target = DragOperationController.class_prefix + "event-target";
                DragOperationController.debug_class_event_related_target = DragOperationController.class_prefix + "event-related-target";
            }
            this.touchMoveHandler = this.onTouchMove.bind(this);
            this.touchEndOrCancelHandler = this.onTouchEndOrCancel.bind(this);
            this.lastTouchEvent = initialEvent;
            this.initialDragTouchIdentifier = this.lastTouchEvent.changedTouches[0].identifier;
            document.addEventListener("touchmove", this.touchMoveHandler);
            document.addEventListener("touchend", this.touchEndOrCancelHandler);
            document.addEventListener("touchcancel", this.touchEndOrCancelHandler);
        }
        DragOperationController.prototype.setupDragAndDropOperation = function () {
            var _this = this;
            console.log("starting drag and drop operation");
            this.dragOperationState = 1;
            this.currentDragOperation = "none";
            this.dragDataStore = new DragDataStore();
            this.dataTransfer = new DataTransfer(this.dragDataStore);
            this.currentHotspotCoordinates = {
                x: null,
                y: null
            };
            this.createDragImage(this.lastTouchEvent);
            this.dragDataStore.mode = 2;
            this.dataTransfer.dropEffect = "none";
            if (this.dispatchDragEvent("dragstart", this.sourceNode, this.lastTouchEvent, this.dragDataStore, this.dataTransfer)) {
                console.log("dragstart cancelled");
                this.dragOperationState = 3;
                this.cleanup();
                return;
            }
            this.snapbackEndedCb = this.snapbackTransitionEnded.bind(this);
            this.iterationIntervalId = setInterval(function () {
                if (_this.iterationLock) {
                    console.log('iteration skipped because previous iteration hast not yet finished.');
                    return;
                }
                _this.iterationLock = true;
                _this.dragAndDropProcessModelIteration();
                _this.iterationLock = false;
            }, this.config.iterationInterval);
        };
        DragOperationController.prototype.cleanup = function () {
            console.log("cleanup");
            if (this.iterationIntervalId) {
                clearInterval(this.iterationIntervalId);
                this.iterationIntervalId = null;
            }
            document.removeEventListener("touchmove", this.touchMoveHandler);
            document.removeEventListener("touchend", this.touchEndOrCancelHandler);
            document.removeEventListener("touchcancel", this.touchEndOrCancelHandler);
            if (this.dragImage) {
                this.dragImage.parentNode.removeChild(this.dragImage);
                this.dragImage = null;
            }
            this.dragOperationEndedCb(this.lastTouchEvent, this.dragOperationState);
        };
        DragOperationController.prototype.onTouchMove = function (event) {
            if (Util.IsTouchIdentifierContainedInTouchEvent(event, this.initialDragTouchIdentifier) === false) {
                return;
            }
            if (this.dragOperationState === 0) {
                this.setupDragAndDropOperation();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lastTouchEvent = event;
            Util.UpdateCentroidCoordinatesOfTouchesIn("client", event, this.currentHotspotCoordinates);
            Util.UpdateCentroidCoordinatesOfTouchesIn("page", event, this.dragImagePageCoordinates);
            this.determineScrollIntention(this.currentHotspotCoordinates.x, this.currentHotspotCoordinates.y);
            if (DragOperationController.HorizontalScrollEndReach(this.scrollIntention) === false
                || DragOperationController.VerticalScrollEndReach(this.scrollIntention) === false) {
                this.setupScrollAnimation();
                return;
            }
            else {
                this.teardownScrollAnimation();
            }
            this.translateDragImage(this.dragImagePageCoordinates.x, this.dragImagePageCoordinates.y);
        };
        DragOperationController.prototype.onTouchEndOrCancel = function (event) {
            if (Util.IsTouchIdentifierContainedInTouchEvent(event, this.initialDragTouchIdentifier) === false) {
                return;
            }
            this.teardownScrollAnimation();
            if (this.dragOperationState === 0) {
                this.cleanup();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lastTouchEvent = event;
            this.dragOperationState = (event.type === "touchcancel") ? 3 : 2;
        };
        DragOperationController.prototype.determineScrollIntention = function (x, y) {
            if (!this.scrollIntention) {
                this.scrollIntention = {};
            }
            if (x < this.config.scrollThreshold) {
                this.scrollIntention.x = -1;
            }
            else if (window.document.documentElement.clientWidth - x < this.config.scrollThreshold) {
                this.scrollIntention.x = 1;
            }
            else {
                this.scrollIntention.x = 0;
            }
            if (y < this.config.scrollThreshold) {
                this.scrollIntention.y = -1;
            }
            else if (window.document.documentElement.clientHeight - y < this.config.scrollThreshold) {
                this.scrollIntention.y = 1;
            }
            else {
                this.scrollIntention.y = 0;
            }
        };
        DragOperationController.prototype.setupScrollAnimation = function () {
            if (this.scrollAnimationFrameId) {
                return;
            }
            console.log("setting up scroll animation");
            this.scrollAnimationCb = this.performScroll.bind(this);
            this.scrollAnimationFrameId = window.requestAnimationFrame(this.scrollAnimationCb);
        };
        DragOperationController.prototype.teardownScrollAnimation = function () {
            if (!this.scrollAnimationFrameId) {
                return;
            }
            console.log("tearing down scroll animation");
            window.cancelAnimationFrame(this.scrollAnimationFrameId);
            this.scrollAnimationFrameId = null;
            this.scrollAnimationCb = null;
        };
        DragOperationController.prototype.performScroll = function () {
            if (!this.scrollAnimationCb || !this.scrollAnimationFrameId) {
                return;
            }
            var horizontalScrollEndReached = DragOperationController.HorizontalScrollEndReach(this.scrollIntention);
            var verticalScrollEndReached = DragOperationController.VerticalScrollEndReach(this.scrollIntention);
            if (horizontalScrollEndReached && verticalScrollEndReached) {
                console.log("scroll end reached");
                this.teardownScrollAnimation();
                return;
            }
            if (!horizontalScrollEndReached) {
                var horizontalScroll = this.scrollIntention.x * this.config.scrollVelocity;
                DragOperationController.GetSetHorizontalScroll(window.document, horizontalScroll);
                this.dragImagePageCoordinates.x += horizontalScroll;
            }
            if (!verticalScrollEndReached) {
                var verticalScroll = this.scrollIntention.y * this.config.scrollVelocity;
                DragOperationController.GetSetVerticalScroll(window.document, verticalScroll);
                this.dragImagePageCoordinates.y += verticalScroll;
            }
            this.translateDragImage(this.dragImagePageCoordinates.x, this.dragImagePageCoordinates.y);
            this.scrollAnimationFrameId = window.requestAnimationFrame(this.scrollAnimationCb);
        };
        DragOperationController.GetSetHorizontalScroll = function (document, scroll) {
            if (arguments.length === 1) {
                return document.documentElement.scrollLeft || document.body.scrollLeft;
            }
            document.documentElement.scrollLeft += scroll;
            document.body.scrollLeft += scroll;
        };
        DragOperationController.GetSetVerticalScroll = function (document, scroll) {
            if (arguments.length === 1) {
                return document.documentElement.scrollTop || document.body.scrollTop;
            }
            document.documentElement.scrollTop += scroll;
            document.body.scrollTop += scroll;
        };
        DragOperationController.HorizontalScrollEndReach = function (scrollIntention) {
            var scrollLeft = DragOperationController.GetSetHorizontalScroll(document);
            if (scrollIntention.x > 0) {
                var scrollWidth = document.documentElement.scrollWidth || document.body.scrollWidth;
                return (scrollLeft + document.documentElement.clientWidth) >= (scrollWidth);
            }
            else if (scrollIntention.x < 0) {
                return (scrollLeft <= 0);
            }
            return true;
        };
        DragOperationController.VerticalScrollEndReach = function (scrollIntention) {
            var scrollTop = DragOperationController.GetSetVerticalScroll(document);
            if (scrollIntention.y > 0) {
                var scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                return (scrollTop + document.documentElement.clientHeight) >= (scrollHeight);
            }
            else if (scrollIntention.y < 0) {
                return (scrollTop <= 0);
            }
            return true;
        };
        DragOperationController.PrepareNodeCopyAsDragImage = function (srcNode, dstNode) {
            if (srcNode.nodeType === 1) {
                dstNode.removeAttribute("id");
                dstNode.removeAttribute("class");
                dstNode.removeAttribute("style");
                dstNode.removeAttribute("draggable");
                var cs = window.getComputedStyle(srcNode);
                for (var i = 0; i < cs.length; i++) {
                    var csName = cs[i];
                    dstNode.style.setProperty(csName, cs.getPropertyValue(csName), cs.getPropertyPriority(csName));
                }
                dstNode.style["pointer-events"] = "none";
            }
            if (srcNode.hasChildNodes()) {
                for (var i = 0; i < srcNode.childNodes.length; i++) {
                    DragOperationController.PrepareNodeCopyAsDragImage(srcNode.childNodes[i], dstNode.childNodes[i]);
                }
            }
        };
        DragOperationController.prototype.createDragImage = function (event) {
            this.dragImage = this.sourceNode.cloneNode(true);
            DragOperationController.PrepareNodeCopyAsDragImage(this.sourceNode, this.dragImage);
            this.dragImage.style["position"] = "absolute";
            this.dragImage.style["left"] = "0px";
            this.dragImage.style["top"] = "0px";
            this.dragImage.style["z-index"] = "999999";
            this.dragImage.classList.add(DragOperationController.class_drag_image);
            this.dragImage.classList.add(DragOperationController.class_drag_operation_icon);
            if (this.config.dragImageClass) {
                this.dragImage.classList.add(this.config.dragImageClass);
            }
            this.dragImagePageCoordinates = {
                x: null,
                y: null
            };
            Util.UpdateCentroidCoordinatesOfTouchesIn("page", event, this.dragImagePageCoordinates);
            this.translateDragImage(this.dragImagePageCoordinates.x, this.dragImagePageCoordinates.y);
            window.document.body.appendChild(this.dragImage);
        };
        DragOperationController.prototype.translateDragImage = function (x, y, centerOnCoordinates) {
            if (centerOnCoordinates === void 0) { centerOnCoordinates = true; }
            if (centerOnCoordinates) {
                x -= (parseInt(this.dragImage.offsetWidth, 10) / 2);
                y -= (parseInt(this.dragImage.offsetHeight, 10) / 2);
            }
            var translate = "translate3d(" + x + "px," + y + "px, 0)";
            for (var i = 0; i < DragOperationController.transform_css_vendor_prefixes.length; i++) {
                var transformProp = DragOperationController.transform_css_vendor_prefixes[i] + "transform";
                this.dragImage.style[transformProp] = translate;
            }
        };
        DragOperationController.prototype.snapbackDragImage = function () {
            var sourceEl = this.sourceNode;
            var visiblity = window.getComputedStyle(sourceEl, null).getPropertyValue('visibility');
            var display = window.getComputedStyle(sourceEl, null).getPropertyValue('display');
            if (visiblity === 'hidden' || display === 'none') {
                console.log("source node is not visible. skipping snapback transition.");
                this.snapbackTransitionEnded();
                return;
            }
            console.log("starting dragimage snap back");
            this.dragImage.addEventListener("transitionend", this.snapbackEndedCb);
            this.dragImage.addEventListener("webkitTransitionEnd", this.snapbackEndedCb);
            this.dragImage.classList.add(DragOperationController.class_drag_image_snapback);
            var rect = sourceEl.getBoundingClientRect();
            var elementLeft, elementTop;
            var scrollTop = document.documentElement.scrollTop ?
                document.documentElement.scrollTop : document.body.scrollTop;
            var scrollLeft = document.documentElement.scrollLeft ?
                document.documentElement.scrollLeft : document.body.scrollLeft;
            elementTop = rect.top + scrollTop;
            elementLeft = rect.left + scrollLeft;
            var cs = window.getComputedStyle(this.sourceNode, null);
            var leftPadding = parseInt(cs.getPropertyValue("padding-left"), 10);
            var topPadding = parseInt(cs.getPropertyValue("padding-top"), 10);
            elementLeft -= leftPadding;
            elementTop -= topPadding;
            this.translateDragImage(elementLeft, elementTop, false);
        };
        DragOperationController.prototype.snapbackTransitionEnded = function () {
            console.log("dragimage snap back transition ended");
            this.dragImage.removeEventListener("transitionend", this.snapbackEndedCb);
            this.dragImage.removeEventListener("webkitTransitionEnd", this.snapbackEndedCb);
            this.dragDataStore.mode = 3;
            this.dataTransfer.dropEffect = this.currentDragOperation;
            this.dispatchDragEvent("dragend", this.sourceNode, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false);
            this.dragOperationState = 2;
            this.cleanup();
        };
        DragOperationController.prototype.dragAndDropProcessModelIteration = function () {
            this.dragDataStore.mode = 3;
            this.dataTransfer.dropEffect = "none";
            var dragCancelled = this.dispatchDragEvent("drag", this.sourceNode, this.lastTouchEvent, this.dragDataStore, this.dataTransfer);
            if (dragCancelled) {
                console.log("drag event cancelled.");
                this.currentDragOperation = "none";
            }
            if (dragCancelled || this.dragOperationState === 2 || this.dragOperationState === 3) {
                var dragFailed = this.DragOperationEnded(this.dragOperationState);
                if (dragFailed) {
                    this.snapbackDragImage();
                    return;
                }
                this.dragDataStore.mode = 3;
                this.dataTransfer.dropEffect = this.currentDragOperation;
                this.dispatchDragEvent("dragend", this.sourceNode, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false);
                this.dragOperationState = 2;
                this.cleanup();
                return;
            }
            var newUserSelection = window.document.elementFromPoint(this.currentHotspotCoordinates.x, this.currentHotspotCoordinates.y);
            console.log("new immediate user selection is: " + newUserSelection);
            var previousTargetElement = this.currentDropTarget;
            if (newUserSelection !== this.immediateUserSelection && newUserSelection !== this.currentDropTarget) {
                if (this.config.debug) {
                    if (this.immediateUserSelection) {
                        this.immediateUserSelection.classList.remove(DragOperationController.debug_class_user_selection);
                    }
                    if (newUserSelection) {
                        newUserSelection.classList.add(DragOperationController.debug_class);
                        newUserSelection.classList.add(DragOperationController.debug_class_user_selection);
                    }
                }
                this.immediateUserSelection = newUserSelection;
                if (this.currentDropTarget !== null) {
                    this.dragDataStore.mode = 3;
                    this.dataTransfer.dropEffect = "none";
                    this.dispatchDragEvent("dragexit", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false);
                }
                if (this.immediateUserSelection === null) {
                    this.currentDropTarget = this.immediateUserSelection;
                    console.log("current drop target changed to null");
                }
                else {
                    this.dragDataStore.mode = 3;
                    this.dataTransfer.dropEffect = DragOperationController.DetermineDropEffect(this.dragDataStore.effectAllowed, this.sourceNode);
                    if (this.dispatchDragEvent("dragenter", this.immediateUserSelection, this.lastTouchEvent, this.dragDataStore, this.dataTransfer)) {
                        console.log("dragenter default prevented");
                        this.currentDropTarget = this.immediateUserSelection;
                        this.currentDragOperation = DragOperationController.DetermineDragOperation(this.dataTransfer);
                    }
                    else {
                        if (this.immediateUserSelection === window.document.body) {
                        }
                        else {
                            this.currentDropTarget = window.document.body;
                        }
                    }
                }
            }
            if (previousTargetElement !== this.currentDropTarget && (Util.IsDOMElement(previousTargetElement))) {
                if (this.config.debug) {
                    previousTargetElement.classList.remove(DragOperationController.debug_class_drop_target);
                }
                console.log("current drop target changed.");
                this.dragDataStore.mode = 3;
                this.dataTransfer.dropEffect = "none";
                this.dispatchDragEvent("dragleave", previousTargetElement, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false, this.currentDropTarget);
            }
            if (Util.IsDOMElement(this.currentDropTarget)) {
                if (this.config.debug) {
                    this.currentDropTarget.classList.add(DragOperationController.debug_class);
                    this.currentDropTarget.classList.add(DragOperationController.debug_class_drop_target);
                }
                this.dragDataStore.mode = 3;
                this.dataTransfer.dropEffect = DragOperationController.DetermineDropEffect(this.dragDataStore.effectAllowed, this.sourceNode);
                if (this.dispatchDragEvent("dragover", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer) === false) {
                    console.log("dragover not prevented on possible drop-target.");
                    this.currentDragOperation = "none";
                }
                else {
                    console.log("dragover prevented.");
                    this.currentDragOperation = DragOperationController.DetermineDragOperation(this.dataTransfer);
                }
            }
            console.log("d'n'd iteration ended. current drag operation: " + this.currentDragOperation);
            for (var i = 0; i < DataTransfer.DropEffects.length; i++) {
                this.dragImage.classList.remove(DragOperationController.class_prefix + DataTransfer.DropEffects[i]);
            }
            this.dragImage.classList.add(DragOperationController.class_prefix + this.currentDragOperation);
        };
        DragOperationController.prototype.DragOperationEnded = function (state) {
            console.log("drag operation end detected with " + this.currentDragOperation);
            if (this.config.debug) {
                if (this.currentDropTarget) {
                    this.currentDropTarget.classList.remove(DragOperationController.debug_class_drop_target);
                }
                if (this.immediateUserSelection) {
                    this.immediateUserSelection.classList.remove(DragOperationController.debug_class_user_selection);
                }
            }
            var dragFailed = (this.currentDragOperation === "none"
                || this.currentDropTarget === null
                || state === 3);
            if (dragFailed) {
                if (Util.IsDOMElement(this.currentDropTarget)) {
                    this.dragDataStore.mode = 3;
                    this.dataTransfer.dropEffect = "none";
                    this.dispatchDragEvent("dragleave", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer, false);
                }
            }
            else {
                if (Util.IsDOMElement(this.currentDropTarget)) {
                    this.dragDataStore.mode = 1;
                    this.dataTransfer.dropEffect = this.currentDragOperation;
                    if (this.dispatchDragEvent("drop", this.currentDropTarget, this.lastTouchEvent, this.dragDataStore, this.dataTransfer) ===
                        true) {
                        this.currentDragOperation = this.dataTransfer.dropEffect;
                    }
                    else {
                        this.currentDragOperation = "none";
                    }
                }
            }
            return dragFailed;
        };
        DragOperationController.DetermineDragOperation = function (dataTransfer) {
            if (dataTransfer.effectAllowed === "uninitialized" || dataTransfer.effectAllowed === "all") {
                return dataTransfer.dropEffect;
            }
            if (dataTransfer.dropEffect === "copy") {
                if (dataTransfer.effectAllowed.indexOf("copy") === 0) {
                    return "copy";
                }
            }
            else if (dataTransfer.dropEffect === "link") {
                if (dataTransfer.effectAllowed.indexOf("link") === 0 || dataTransfer.effectAllowed.indexOf("Link") > -1) {
                    return "link";
                }
            }
            else if (dataTransfer.dropEffect === "move") {
                if (dataTransfer.effectAllowed.indexOf("move") === 0 || dataTransfer.effectAllowed.indexOf("Move") > -1) {
                    return "move";
                }
            }
            return "none";
        };
        DragOperationController.DetermineDropEffect = function (effectAllowed, sourceNode) {
            if (effectAllowed === "none") {
                return "none";
            }
            if (effectAllowed.indexOf("copy") === 0 || effectAllowed === "all") {
                return "copy";
            }
            if (effectAllowed.indexOf("link") === 0) {
                return "link";
            }
            if (effectAllowed === "move") {
                return "move";
            }
            if (effectAllowed === "uninitialized") {
                if (sourceNode.nodeType === 3 && sourceNode.tagName === "A") {
                    return "link";
                }
            }
            return "copy";
        };
        DragOperationController.prototype.dispatchDragEvent = function (dragEvent, targetElement, touchEvent, dataStore, dataTransfer, cancelable, relatedTarget) {
            if (cancelable === void 0) { cancelable = true; }
            if (relatedTarget === void 0) { relatedTarget = null; }
            console.log(dragEvent);
            if (this.config.debug) {
                targetElement.classList.add(DragOperationController.debug_class);
                targetElement.classList.add(DragOperationController.debug_class_event_target);
                if (relatedTarget) {
                    relatedTarget.classList.add(DragOperationController.debug_class);
                    relatedTarget.classList.add(DragOperationController.debug_class_event_related_target);
                }
            }
            var leaveEvt = Util.CreateDragEventFromTouch(targetElement, touchEvent, dragEvent, cancelable, window.document.defaultView, dataTransfer, relatedTarget);
            var cancelled = !targetElement.dispatchEvent(leaveEvt);
            dataStore.mode = 0;
            if (this.config.debug) {
                targetElement.classList.remove(DragOperationController.debug_class_event_target);
                if (relatedTarget) {
                    relatedTarget.classList.remove(DragOperationController.debug_class_event_related_target);
                }
            }
            return cancelled;
        };
        DragOperationController.class_prefix = "dnd-poly-";
        DragOperationController.class_drag_image = DragOperationController.class_prefix + "drag-image";
        DragOperationController.class_drag_image_snapback = DragOperationController.class_prefix + "snapback";
        DragOperationController.class_drag_operation_icon = DragOperationController.class_prefix + "icon";
        DragOperationController.transform_css_vendor_prefixes = ["", "-webkit-"];
        return DragOperationController;
    })();
    var DataTransfer = (function () {
        function DataTransfer(dataStore) {
            this.dataStore = dataStore;
            this._dropEffect = "none";
        }
        Object.defineProperty(DataTransfer.prototype, "files", {
            get: function () {
                return null;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "items", {
            get: function () {
                return null;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "types", {
            get: function () {
                if (this.dataStore.mode === 0) {
                    return null;
                }
                return Object.freeze(this.dataStore.types);
            },
            enumerable: true,
            configurable: true
        });
        DataTransfer.prototype.setData = function (type, data) {
            if (this.dataStore.mode !== 2) {
                return;
            }
            if (type.indexOf(" ") > -1) {
                throw new Error("Space character not allowed in drag data item type string");
            }
            this.dataStore.data[type] = data;
            if (this.dataStore.types.indexOf(type) === -1) {
                this.dataStore.types.push(type);
            }
        };
        DataTransfer.prototype.getData = function (type) {
            if (this.dataStore.mode === 0
                || this.dataStore.mode === 3) {
                return null;
            }
            return this.dataStore.data[type] || "";
        };
        DataTransfer.prototype.clearData = function (format) {
            if (this.dataStore.mode !== 2) {
                return;
            }
            if (format && this.dataStore.data[format]) {
                delete this.dataStore.data[format];
                var index = this.dataStore.types.indexOf(format);
                if (index > -1) {
                    this.dataStore.types.splice(index, 1);
                }
                return;
            }
            this.dataStore.data = {};
            this.dataStore.types = [];
        };
        DataTransfer.prototype.setDragImage = function (image, x, y) {
            if (this.dataStore.mode === 0) {
                return;
            }
        };
        Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
            get: function () {
                return this.dataStore.effectAllowed;
            },
            set: function (value) {
                if (this.dataStore.mode === 0
                    || DataTransfer.AllowedEffects.indexOf(value) === -1) {
                    return;
                }
                this.dataStore.effectAllowed = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DataTransfer.prototype, "dropEffect", {
            get: function () {
                return this._dropEffect;
            },
            set: function (value) {
                if (this.dataStore.mode === 0
                    || DataTransfer.DropEffects.indexOf(value) === -1) {
                    return;
                }
                this._dropEffect = value;
            },
            enumerable: true,
            configurable: true
        });
        DataTransfer.AllowedEffects = ["none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all"];
        DataTransfer.DropEffects = ["none", "copy", "move", "link"];
        return DataTransfer;
    })();
    var DragDataStore = (function () {
        function DragDataStore() {
            this.mode = 3;
            this.data = {};
            this.types = [];
            this.effectAllowed = "uninitialized";
        }
        return DragDataStore;
    })();
    var Util = (function () {
        function Util() {
        }
        Util.Average = function (array) {
            if (array.length === 0) {
                return 0;
            }
            return array.reduce((function (s, v) {
                return v + s;
            }), 0) / array.length;
        };
        Util.IsDOMElement = function (object) {
            return object && object.tagName;
        };
        Util.IsTouchIdentifierContainedInTouchEvent = function (newTouch, touchIdentifier) {
            for (var i = 0; i < newTouch.changedTouches.length; i++) {
                var touch = newTouch.changedTouches[i];
                if (touch.identifier === touchIdentifier) {
                    return true;
                }
            }
            return false;
        };
        Util.CreateMouseEventFromTouch = function (targetElement, e, typeArg, cancelable, window, relatedTarget) {
            if (cancelable === void 0) { cancelable = true; }
            if (window === void 0) { window = document.defaultView; }
            if (relatedTarget === void 0) { relatedTarget = null; }
            var mouseEvent = document.createEvent("MouseEvents");
            var touch = e.changedTouches[0];
            mouseEvent.initMouseEvent(typeArg, true, cancelable, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, relatedTarget);
            var targetRect = targetElement.getBoundingClientRect();
            mouseEvent.offsetX = mouseEvent.clientX - targetRect.left;
            mouseEvent.offsetY = mouseEvent.clientY - targetRect.top;
            return mouseEvent;
        };
        Util.CreateDragEventFromTouch = function (targetElement, e, typeArg, cancelable, window, dataTransfer, relatedTarget) {
            if (relatedTarget === void 0) { relatedTarget = null; }
            var touch = e.changedTouches[0];
            var dndEvent = document.createEvent("Event");
            dndEvent.initEvent(typeArg, true, cancelable);
            dndEvent.dataTransfer = dataTransfer;
            dndEvent.relatedTarget = relatedTarget;
            dndEvent.screenX = touch.screenX;
            dndEvent.screenY = touch.screenY;
            dndEvent.clientX = touch.clientX;
            dndEvent.clientY = touch.clientY;
            var targetRect = targetElement.getBoundingClientRect();
            dndEvent.offsetX = dndEvent.clientX - targetRect.left;
            dndEvent.offsetY = dndEvent.clientY - targetRect.top;
            return dndEvent;
        };
        Util.UpdateCentroidCoordinatesOfTouchesIn = function (coordinateProp, event, outPoint) {
            var pageXs = [], pageYs = [];
            for (var i = 0; i < event.touches.length; i++) {
                var touch = event.touches[i];
                pageXs.push(touch[coordinateProp + "X"]);
                pageYs.push(touch[coordinateProp + "Y"]);
            }
            outPoint.x = Util.Average(pageXs);
            outPoint.y = Util.Average(pageYs);
        };
        return Util;
    })();
})(MobileDragAndDropPolyfill || (MobileDragAndDropPolyfill = {}));
//# sourceMappingURL=mobile-drag-and-drop-polyfill.js.map