var MobileDragAndDropPolyfill;
(function (MobileDragAndDropPolyfill) {
    MobileDragAndDropPolyfill.Initialize = function (config) {
        DragAndDropInitializer.Initialize(config);
    };
    var DragAndDropInitializer = (function () {
        function DragAndDropInitializer() {
        }
        DragAndDropInitializer.Initialize = function (config) {
            Util.Merge(DragAndDropInitializer.config, config);
            var featureDetection = {};
            if (DragAndDropInitializer.IsDragAndDropSupportedNatively(featureDetection)) {
                return;
            }
            DragAndDropInitializer.config.log("Applying mobile drag and drop polyfill.");
            window.document.addEventListener("touchstart", DragAndDropInitializer.OnTouchstart);
        };
        DragAndDropInitializer.IsDragAndDropSupportedNatively = function (featureDetection) {
            featureDetection.draggable = 'draggable' in window.document.documentElement;
            featureDetection.dragEvents = ('ondragstart' in window.document.documentElement);
            featureDetection.touchEvents = ('ontouchstart' in window.document.documentElement);
            featureDetection.mouseEventConstructor = ('MouseEvent' in window);
            featureDetection.dragEventConstructor = ('DragEvent' in window);
            featureDetection.customEventConstructor = ('CustomEvent' in window);
            featureDetection.isBlinkEngine = !!(window.chrome) || /chrome/i.test(navigator.userAgent);
            featureDetection.isGeckoEngine = /firefox/i.test(navigator.userAgent);
            featureDetection.userAgentNotSupportingNativeDnD =
                (/iPad|iPhone|iPod|Android/.test(navigator.userAgent)
                    ||
                        featureDetection.touchEvents && (featureDetection.isBlinkEngine));
            Util.ForIn(featureDetection, function (value, key) {
                DragAndDropInitializer.config.log("feature '" + key + "' is '" + value + "'");
            });
            return (featureDetection.userAgentNotSupportingNativeDnD === false
                && featureDetection.draggable
                && featureDetection.dragEvents);
        };
        DragAndDropInitializer.OnTouchstart = function (e) {
            DragAndDropInitializer.config.log("global touchstart");
            if (DragAndDropInitializer.dragOperationActive) {
                DragAndDropInitializer.config.log("drag operation already active");
                return;
            }
            var dragTarget = DragAndDropInitializer.TargetIsDraggable(e, DragAndDropInitializer.config);
            if (!dragTarget) {
                return;
            }
            e.preventDefault();
            DragAndDropInitializer.dragOperationActive = true;
            try {
                new DragOperationController(DragAndDropInitializer.config, dragTarget, e, DragAndDropInitializer.DragOperationEnded);
            }
            catch (err) {
                DragAndDropInitializer.config.log(err);
                DragAndDropInitializer.DragOperationEnded(dragTarget, e, DragOperationState.CANCELLED);
            }
        };
        DragAndDropInitializer.TargetIsDraggable = function (event, config) {
            //1. Determine what is being dragged, as follows:
            var el = event.target;
            do {
                if (el.draggable === false) {
                    continue;
                }
                if (!el.getAttribute) {
                    continue;
                }
                if (el.getAttribute("draggable") === "true") {
                    return el;
                }
            } while ((el = el.parentNode) && el !== window.document.body);
        };
        DragAndDropInitializer.DragOperationEnded = function (sourceNode, event, state) {
            DragAndDropInitializer.dragOperationActive = false;
            if (state === DragOperationState.POTENTIAL) {
                DragAndDropInitializer.config.log("No movement on draggable. Dispatching click..");
                var clickEvt = Util.CreateMouseEventFromTouch(event, "click");
                sourceNode.dispatchEvent(clickEvt);
            }
        };
        DragAndDropInitializer.dragOperationActive = false;
        DragAndDropInitializer.config = {
            log: function () {
            },
            dragImageClass: null,
            iterationInterval: 150,
            scrollThreshold: 50,
            scrollVelocity: 10
        };
        return DragAndDropInitializer;
    })();
    var DragOperationState;
    (function (DragOperationState) {
        DragOperationState[DragOperationState["POTENTIAL"] = 0] = "POTENTIAL";
        DragOperationState[DragOperationState["STARTED"] = 1] = "STARTED";
        DragOperationState[DragOperationState["ENDED"] = 2] = "ENDED";
        DragOperationState[DragOperationState["CANCELLED"] = 3] = "CANCELLED";
    })(DragOperationState || (DragOperationState = {}));
    var DragOperationController = (function () {
        function DragOperationController(config, sourceNode, initialEvent, dragOperationEndedCb) {
            this.config = config;
            this.sourceNode = sourceNode;
            this.dragOperationEndedCb = dragOperationEndedCb;
            this.doc = window.document;
            this.dragImage = null;
            this.transformStyleMixins = {};
            this.immediateUserSelection = null;
            this.currentDropTarget = null;
            this.dragDataStore = null;
            this.dataTransfer = null;
            this.currentDragOperation = "none";
            this.iterationLock = false;
            this.intervalId = null;
            this.lastTouchEvent = null;
            this.initialDragTouchIdentifier = null;
            this.dragOperationState = DragOperationState.POTENTIAL;
            config.log("setting up potential drag operation..");
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
            this.config.log("starting drag and drop operation");
            this.dragOperationState = DragOperationState.STARTED;
            this.dragDataStore = new DragDataStore();
            this.dataTransfer = new DataTransfer(this.dragDataStore);
            this.createDragImage(this.lastTouchEvent);
            if (this.dragstart(this.sourceNode)) {
                this.config.log("dragstart cancelled");
                this.dragOperationState = DragOperationState.CANCELLED;
                this.cleanup();
                return;
            }
            this.snapbackEndedCb = this.snapbackTransitionEnded.bind(this);
            this.intervalId = setInterval(function () {
                if (_this.iterationLock) {
                    _this.config.log('iteration skipped because previous iteration hast not yet finished.');
                    return;
                }
                _this.iterationLock = true;
                _this.dragAndDropProcessModelIteration();
                _this.iterationLock = false;
            }, this.config.iterationInterval);
        };
        DragOperationController.prototype.cleanup = function () {
            this.config.log("cleanup");
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            document.removeEventListener("touchmove", this.touchMoveHandler);
            document.removeEventListener("touchend", this.touchEndOrCancelHandler);
            document.removeEventListener("touchcancel", this.touchEndOrCancelHandler);
            if (this.dragImage != null) {
                this.dragImage.parentNode.removeChild(this.dragImage);
                this.dragImage = null;
            }
            this.dataTransfer = null;
            this.dragDataStore = null;
            this.immediateUserSelection = null;
            this.currentDropTarget = null;
            this.touchEndOrCancelHandler = null;
            this.touchMoveHandler = null;
            this.snapbackEndedCb = null;
            this.dragOperationEndedCb(this.sourceNode, this.lastTouchEvent, this.dragOperationState);
            this.lastTouchEvent = null;
        };
        DragOperationController.prototype.onTouchMove = function (event) {
            if (Util.IsTouchIdentifierContainedInTouchEvent(event, this.initialDragTouchIdentifier) === false) {
                return;
            }
            if (this.dragOperationState === DragOperationState.POTENTIAL) {
                this.setupDragAndDropOperation();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lastTouchEvent = event;
            var centroid = Util.GetCentroidOfTouches(event);
            centroid.x -= (parseInt(this.dragImage.offsetWidth, 10) / 2);
            centroid.y -= (parseInt(this.dragImage.offsetHeight, 10) / 2);
            this.translateDragImage(centroid.x, centroid.y);
            var touch = Util.GetTouchContainedInTouchEventByIdentifier(event, this.initialDragTouchIdentifier);
            this.calculateViewportScrollFactor(touch.clientX, touch.clientY);
            if (this.scrollFactor.x !== 0 || this.scrollFactor.y !== 0) {
                this.setupScrollAnimation();
            }
            else {
                this.teardownScrollAnimation();
            }
        };
        DragOperationController.prototype.onTouchEndOrCancel = function (event) {
            if (Util.IsTouchIdentifierContainedInTouchEvent(event, this.initialDragTouchIdentifier) === false) {
                return;
            }
            this.teardownScrollAnimation();
            if (this.dragOperationState === DragOperationState.POTENTIAL) {
                this.cleanup();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lastTouchEvent = event;
            this.dragOperationState = (event.type === "touchcancel") ? DragOperationState.CANCELLED : DragOperationState.ENDED;
        };
        DragOperationController.prototype.calculateViewportScrollFactor = function (x, y) {
            if (!this.scrollFactor) {
                this.scrollFactor = {};
            }
            if (x < this.config.scrollThreshold) {
                this.scrollFactor.x = -1;
            }
            else if (this.doc.documentElement.clientWidth - x < this.config.scrollThreshold) {
                this.scrollFactor.x = 1;
            }
            else {
                this.scrollFactor.x = 0;
            }
            if (y < this.config.scrollThreshold) {
                this.scrollFactor.y = -1;
            }
            else if (this.doc.documentElement.clientHeight - y < this.config.scrollThreshold) {
                this.scrollFactor.y = 1;
            }
            else {
                this.scrollFactor.y = 0;
            }
        };
        DragOperationController.prototype.setupScrollAnimation = function () {
            if (this.scrollAnimationFrameId) {
                return;
            }
            this.config.log("setting up scroll animation");
            this.scrollAnimationCb = this.performScroll.bind(this);
            this.scrollAnimationFrameId = window.requestAnimationFrame(this.scrollAnimationCb);
        };
        DragOperationController.prototype.teardownScrollAnimation = function () {
            if (!this.scrollAnimationFrameId) {
                return;
            }
            this.config.log("tearing down scroll animation");
            window.cancelAnimationFrame(this.scrollAnimationFrameId);
            this.scrollAnimationFrameId = null;
            this.scrollAnimationCb = null;
        };
        DragOperationController.prototype.performScroll = function (timestamp) {
            //TODO move the dragImage while scrolling
            var horizontalScroll = this.scrollFactor.x * this.config.scrollVelocity;
            var verticalScroll = this.scrollFactor.y * this.config.scrollVelocity;
            DragOperationController.SetHorizontalScroll(this.doc, horizontalScroll);
            DragOperationController.SetVerticalScroll(this.doc, verticalScroll);
            if (DragOperationController.HorizontalScrollEndReach() && DragOperationController.VerticalScrollEndReach()) {
                this.config.log("scroll end reached");
                this.teardownScrollAnimation();
                return;
            }
            if (!this.scrollAnimationCb || !this.scrollAnimationFrameId) {
                return;
            }
            this.scrollAnimationFrameId = window.requestAnimationFrame(this.scrollAnimationCb);
        };
        DragOperationController.SetHorizontalScroll = function (document, scroll) {
            document.documentElement.scrollLeft += scroll;
            document.body.scrollLeft += scroll;
        };
        DragOperationController.SetVerticalScroll = function (document, scroll) {
            document.documentElement.scrollTop += scroll;
            document.body.scrollTop += scroll;
        };
        DragOperationController.HorizontalScrollEndReach = function () {
            var scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
            var scrollWidth = document.documentElement.scrollWidth || document.body.scrollWidth;
            return (scrollLeft <= 0
                || scrollLeft >= scrollWidth);
        };
        DragOperationController.VerticalScrollEndReach = function () {
            var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            var scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
            return (scrollTop <= 0
                || scrollTop >= scrollHeight);
        };
        DragOperationController.PrepareNodeCopyAsDragImage = function (srcNode, dstNode) {
            if (srcNode.nodeType === 1) {
                dstNode.removeAttribute("id");
                dstNode.removeAttribute("draggable");
            }
            if (srcNode.hasChildNodes()) {
                for (var i = 0; i < srcNode.childNodes.length; i++) {
                    DragOperationController.PrepareNodeCopyAsDragImage(srcNode.childNodes[i], dstNode.childNodes[i]);
                }
            }
        };
        DragOperationController.prototype.createDragImage = function (event) {
            var _this = this;
            this.dragImage = this.sourceNode.cloneNode(true);
            DragOperationController.PrepareNodeCopyAsDragImage(this.sourceNode, this.dragImage);
            this.dragImage.style["position"] = "absolute";
            this.dragImage.style["left"] = "0px";
            this.dragImage.style["top"] = "0px";
            this.dragImage.style["z-index"] = "999999";
            this.dragImage.style["pointer-events"] = "none";
            DragOperationController.transform_css_vendor_prefixes.forEach(function (vendor) {
                var prefixedCssProperty = vendor + "transform";
                var transform = _this.dragImage.style[prefixedCssProperty];
                if (typeof transform !== "undefined") {
                    if (transform !== "none") {
                        _this.transformStyleMixins[prefixedCssProperty] = transform.replace(DragOperationController.transform_css_regex, '');
                    }
                    else {
                        _this.transformStyleMixins[prefixedCssProperty] = "";
                    }
                }
            });
            this.dragImage.classList.add("mobile-dnd-poly-drag-image");
            this.dragImage.classList.add("mobile-dnd-poly-icon");
            if (this.config.dragImageClass) {
                this.dragImage.classList.add(this.config.dragImageClass);
            }
            var centroid = Util.GetCentroidOfTouches(event);
            centroid.x -= (parseInt(this.sourceNode.offsetWidth, 10) / 2);
            centroid.y -= (parseInt(this.sourceNode.offsetHeight, 10) / 2);
            this.translateDragImage(centroid.x, centroid.y);
            this.sourceNode.parentNode.insertBefore(this.dragImage, this.sourceNode.nextSibling);
        };
        DragOperationController.prototype.translateDragImage = function (x, y) {
            var _this = this;
            var translate = " translate3d(" + x + "px," + y + "px, 0)";
            Util.ForIn(this.transformStyleMixins, function (value, key) {
                _this.dragImage.style[key] = value + translate;
            });
        };
        DragOperationController.prototype.snapbackDragImage = function () {
            this.config.log("starting dragimage snap back");
            this.dragImage.addEventListener("transitionend", this.snapbackEndedCb);
            this.dragImage.addEventListener("webkitTransitionEnd", this.snapbackEndedCb);
            this.dragImage.classList.add("snapback");
            var rect = this.sourceNode.getBoundingClientRect();
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
            this.translateDragImage(elementLeft, elementTop);
        };
        DragOperationController.prototype.snapbackTransitionEnded = function () {
            this.config.log("dragimage snap back transition ended");
            this.dragImage.removeEventListener("transitionend", this.snapbackEndedCb);
            this.dragImage.removeEventListener("webkitTransitionEnd", this.snapbackEndedCb);
            this.dragend(this.sourceNode);
            this.dragOperationState = DragOperationState.ENDED;
            this.cleanup();
        };
        DragOperationController.prototype.dragAndDropProcessModelIteration = function () {
            var dragCancelled = this.drag(this.sourceNode);
            if (dragCancelled) {
                this.config.log("drag event cancelled.");
                this.currentDragOperation = "none";
            }
            if (dragCancelled || this.dragOperationState === DragOperationState.ENDED || this.dragOperationState === DragOperationState.CANCELLED) {
                var dragFailed = this.DragOperationEnded(this.dragOperationState);
                if (dragFailed) {
                    this.snapbackDragImage();
                    return;
                }
                this.dragend(this.sourceNode);
                this.dragOperationState = DragOperationState.ENDED;
                this.cleanup();
                return;
            }
            var touch = Util.GetTouchContainedInTouchEventByIdentifier(this.lastTouchEvent, this.initialDragTouchIdentifier);
            if (!touch) {
                this.config.log("touch event that did not contain initial drag operation touch slipped through");
                return;
            }
            var newUserSelection = Util.ElementFromTouch(this.doc, touch);
            var previousTargetElement = this.currentDropTarget;
            if (newUserSelection !== this.immediateUserSelection && newUserSelection !== this.currentDropTarget) {
                this.immediateUserSelection = newUserSelection;
                if (this.currentDropTarget !== null) {
                    this.dragexit(this.currentDropTarget);
                }
                if (this.immediateUserSelection === null) {
                    this.currentDropTarget = this.immediateUserSelection;
                    this.config.log("current drop target changed to null");
                }
                else {
                    if (this.dragenter(this.immediateUserSelection)) {
                        this.config.log("dragenter default prevented");
                        this.currentDropTarget = this.immediateUserSelection;
                        this.currentDragOperation = DragOperationController.DetermineDragOperation(this.dataTransfer);
                    }
                    else {
                        this.config.log("dragenter not prevented, searching for dropzone..");
                        var newTarget = DragOperationController.FindDropzoneElement(this.immediateUserSelection);
                        if (newTarget === this.immediateUserSelection &&
                            DragOperationController.GetOperationForMatchingDropzone(this.immediateUserSelection, this.dragDataStore) !== "none") {
                            this.currentDropTarget = this.immediateUserSelection;
                        }
                        else if (newTarget !== null && DragOperationController.GetOperationForMatchingDropzone(newTarget, this.dragDataStore)) {
                            this.dragenter(newTarget, this.currentDropTarget);
                            this.currentDropTarget = newTarget;
                        }
                        else if (this.immediateUserSelection === this.doc.body) {
                        }
                        else {
                            this.currentDropTarget = this.doc.body;
                        }
                    }
                }
            }
            if (previousTargetElement !== this.currentDropTarget && (Util.IsDOMElement(previousTargetElement))) {
                this.config.log("current drop target changed.");
                this.dragleave(previousTargetElement, this.currentDropTarget);
            }
            if (Util.IsDOMElement(this.currentDropTarget)) {
                if (this.dragover(this.currentDropTarget) === false) {
                    this.config.log("dragover not prevented. checking for dom element with dropzone-attr");
                    this.currentDragOperation = DragOperationController.GetOperationForMatchingDropzone(this.currentDropTarget, this.dragDataStore);
                }
                else {
                    this.config.log("dragover prevented -> valid drop target?");
                    this.currentDragOperation = DragOperationController.DetermineDragOperation(this.dataTransfer);
                    this.config.log("current drag operation after dragover: " + this.currentDragOperation);
                }
            }
            this.config.log("d'n'd iteration ended. current drag operation: " + this.currentDragOperation);
            this.dragImage.classList.remove("copy");
            this.dragImage.classList.remove("link");
            this.dragImage.classList.remove("move");
            this.dragImage.classList.remove("none");
            this.dragImage.classList.add(this.currentDragOperation);
        };
        DragOperationController.prototype.DragOperationEnded = function (state) {
            this.config.log("drag operation end detected. state: " + DragOperationState[state]);
            var dragFailed = (this.currentDragOperation === "none"
                || this.currentDropTarget === null
                || state === DragOperationState.CANCELLED);
            if (dragFailed) {
                if (Util.IsDOMElement(this.currentDropTarget)) {
                    this.dragleave(this.currentDropTarget);
                }
            }
            else {
                if (Util.IsDOMElement(this.currentDropTarget)) {
                    if (this.drop(this.currentDropTarget) === true) {
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
                    return "link";
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
        DragOperationController.FindDropzoneElement = function (element) {
            if (!element || !element.hasAttribute || typeof element.hasAttribute !== "function") {
                return null;
            }
            if (element.hasAttribute("dropzone")) {
                return element;
            }
            if (element === window.document.body) {
                return null;
            }
            return DragOperationController.FindDropzoneElement(element.parentElement);
        };
        DragOperationController.GetOperationForMatchingDropzone = function (element, dragDataStore) {
            var value = element.getAttribute("dropzone");
            if (!value) {
                return "none";
            }
            var matched = false;
            var operation;
            var keywords = value.split(" ");
            for (var i = 0; i < keywords.length; i++) {
                var keyword = keywords[i];
                if (keyword === "copy" || keyword === "move" || keyword === "link") {
                    if (!operation) {
                        operation = keyword;
                    }
                    continue;
                }
                if (keyword.length < 3 || keyword[1] !== ":") {
                    continue;
                }
                var splitKeyword = keyword.split(":");
                var kind = splitKeyword[0].toLowerCase();
                var type = splitKeyword[1].toLowerCase();
                if (dragDataStore.types.indexOf(type) > -1) {
                    matched = true;
                }
            }
            if (!matched) {
                return "none";
            }
            if (!operation) {
                return "copy";
            }
            return operation;
        };
        DragOperationController.prototype.dragstart = function (targetElement) {
            this.config.log("dragstart");
            this.dragDataStore.mode = DragDataStoreMode.READWRITE;
            this.dataTransfer.dropEffect = "none";
            var evt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragstart", true, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(evt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.drag = function (targetElement) {
            this.config.log("drag");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = "none";
            var evt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "drag", true, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(evt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.dragenter = function (targetElement, relatedTarget) {
            if (relatedTarget === void 0) { relatedTarget = null; }
            this.config.log("dragenter");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = DragOperationController.DetermineDropEffect(this.dragDataStore.effectAllowed, this.sourceNode);
            var enterEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragenter", true, this.doc.defaultView, this.dataTransfer, relatedTarget);
            var cancelled = !targetElement.dispatchEvent(enterEvt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.dragover = function (targetElement) {
            this.config.log("dragover");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = DragOperationController.DetermineDropEffect(this.dragDataStore.effectAllowed, this.sourceNode);
            var overEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragover", true, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(overEvt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.dragexit = function (targetElement) {
            this.config.log("dragexit");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = "none";
            var leaveEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragexit", false, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(leaveEvt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.dragleave = function (targetElement, relatedTarget) {
            if (relatedTarget === void 0) { relatedTarget = null; }
            this.config.log("dragleave");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = "none";
            var leaveEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragleave", false, this.doc.defaultView, this.dataTransfer, relatedTarget);
            var cancelled = !targetElement.dispatchEvent(leaveEvt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.dragend = function (targetElement) {
            this.config.log("dragend");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = this.currentDragOperation;
            var endEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragend", false, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(endEvt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.drop = function (targetElement) {
            this.config.log("drop");
            this.dragDataStore.mode = DragDataStoreMode.READONLY;
            this.dataTransfer.dropEffect = this.currentDragOperation;
            var dropEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "drop", false, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(dropEvt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.transform_css_vendor_prefixes = ["", "-webkit-"];
        DragOperationController.transform_css_regex = /translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g;
        return DragOperationController;
    })();
    var DataTransfer = (function () {
        function DataTransfer(dataStore) {
            this.dataStore = dataStore;
            this._dropEffect = "none";
        }
        Object.defineProperty(DataTransfer.prototype, "files", {
            get: function () {
                if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                    return null;
                }
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
                if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                    return null;
                }
                return Object.freeze(this.dataStore.types);
            },
            enumerable: true,
            configurable: true
        });
        DataTransfer.prototype.setData = function (type, data) {
            if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                return;
            }
            if (this.dataStore.mode !== DragDataStoreMode.READWRITE) {
                return;
            }
            if (type.indexOf(" ") > -1) {
                throw new Error("Space character not allowed in drag data item type string");
            }
            this.dataStore.data[type] = data;
            var index = this.dataStore.types.indexOf(type);
            if (index > -1) {
                this.dataStore.types.push(type);
            }
        };
        DataTransfer.prototype.getData = function (type) {
            if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                return null;
            }
            if (this.dataStore.mode === DragDataStoreMode.PROTECTED) {
                return null;
            }
            return this.dataStore.data[type] || "";
        };
        DataTransfer.prototype.clearData = function (format) {
            if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
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
            if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                return null;
            }
        };
        Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
            get: function () {
                return this.dataStore.effectAllowed;
            },
            set: function (value) {
                if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                    return;
                }
                if (DataTransfer.AllowedEffects.indexOf(value) === -1) {
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
                if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                    return;
                }
                if (DataTransfer.DropEffects.indexOf(value) === -1) {
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
    var DragDataStoreMode;
    (function (DragDataStoreMode) {
        DragDataStoreMode[DragDataStoreMode["_DISCONNECTED"] = 0] = "_DISCONNECTED";
        DragDataStoreMode[DragDataStoreMode["READONLY"] = 1] = "READONLY";
        DragDataStoreMode[DragDataStoreMode["READWRITE"] = 2] = "READWRITE";
        DragDataStoreMode[DragDataStoreMode["PROTECTED"] = 3] = "PROTECTED";
    })(DragDataStoreMode || (DragDataStoreMode = {}));
    var DragDataStore = (function () {
        function DragDataStore() {
            this.mode = DragDataStoreMode.PROTECTED;
            this.data = {};
            this.types = [];
            this.effectAllowed = "uninitialized";
        }
        return DragDataStore;
    })();
    var Util = (function () {
        function Util() {
        }
        Util.ForIn = function (obj, cb) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key) === false) {
                    continue;
                }
                cb(obj[key], key);
            }
        };
        Util.Merge = function (target, obj) {
            if (!obj) {
                return;
            }
            for (var key in obj) {
                if (obj.hasOwnProperty(key) === false) {
                    continue;
                }
                target[key] = obj[key];
            }
        };
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
        Util.GetTouchContainedInTouchEventByIdentifier = function (newTouch, touchIdentifier) {
            for (var i = 0; i < newTouch.changedTouches.length; i++) {
                var touch = newTouch.changedTouches[i];
                if (touch.identifier === touchIdentifier) {
                    return touch;
                }
            }
            return null;
        };
        Util.CreateMouseEventFromTouch = function (e, typeArg, cancelable, window, relatedTarget) {
            if (cancelable === void 0) { cancelable = true; }
            if (window === void 0) { window = document.defaultView; }
            if (relatedTarget === void 0) { relatedTarget = null; }
            var clickEvt = document.createEvent("MouseEvents");
            var touch = e.changedTouches[0];
            clickEvt.initMouseEvent(typeArg, true, cancelable, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, relatedTarget);
            return clickEvt;
        };
        Util.CreateDragEventFromTouch = function (e, typeArg, cancelable, window, dataTransfer, relatedTarget) {
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
            return dndEvent;
        };
        Util.ElementFromTouch = function (doc, touch) {
            var target = doc.elementFromPoint(touch.clientX, touch.clientY);
            return target;
        };
        Util.GetCentroidOfTouches = function (event) {
            var pageXs = [], pageYs = [];
            [].forEach.call(event.touches, function (touch) {
                pageXs.push(touch.pageX);
                pageYs.push(touch.pageY);
            });
            return {
                x: Util.Average(pageXs),
                y: Util.Average(pageYs)
            };
        };
        return Util;
    })();
})(MobileDragAndDropPolyfill || (MobileDragAndDropPolyfill = {}));
//# sourceMappingURL=mobile-drag-and-drop-polyfill.js.map