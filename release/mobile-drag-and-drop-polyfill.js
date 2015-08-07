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
            if (DragAndDropInitializer.IsDragAndDropSupportedNatively()) {
                return;
            }
            DragAndDropInitializer.config.log("Applying mobile drag and drop polyfill.");
            window.document.addEventListener("touchstart", DragAndDropInitializer.OnTouchstart);
        };
        DragAndDropInitializer.IsDragAndDropSupportedNatively = function () {
            var div = window.document.createElement('div');
            var dragDiv = 'draggable' in div;
            var evts = 'ondragstart' in div && 'ondrop' in div;
            var knownUserAgent = /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
            if (dragDiv) {
                DragAndDropInitializer.config.log("draggable property is present");
            }
            if (evts) {
                DragAndDropInitializer.config.log("drag events are present");
            }
            if (window["MouseEvent"] && typeof MouseEvent.constructor === 'function') {
                DragAndDropInitializer.config.log("mouse event constructor is available");
            }
            if (window["DragEvent"] && typeof DragEvent.constructor === 'function') {
                DragAndDropInitializer.config.log("drag event constructor is available");
            }
            if (knownUserAgent) {
                DragAndDropInitializer.config.log("user agent is known to need drag'n'drop polyfill");
            }
            var needsPatch = !(dragDiv || evts) || knownUserAgent;
            return !needsPatch;
        };
        DragAndDropInitializer.OnTouchstart = function (e) {
            DragAndDropInitializer.config.log("global touchstart");
            if (DragAndDropInitializer.dragOperationActive) {
                DragAndDropInitializer.config.log("drag operation already active");
                return;
            }
            var dragTarget = DragOperationController.IsDragOperation(e, DragAndDropInitializer.config);
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
                DragAndDropInitializer.DragOperationEnded();
            }
        };
        DragAndDropInitializer.DragOperationEnded = function () {
            DragAndDropInitializer.dragOperationActive = false;
        };
        DragAndDropInitializer.dragOperationActive = false;
        DragAndDropInitializer.config = {
            log: function () {
            },
            dragImageClass: null,
            iterationInterval: 150,
            coordinateSystemForElementFromPoint: "client"
        };
        return DragAndDropInitializer;
    })();
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
            this.dragDataStore = new DragDataStore();
            this.dataTransfer = null;
            this.currentDragOperation = "none";
            this.iterationLock = false;
            this.intervalId = null;
            this.lastTouchEvent = null;
            this.initialDragTouchIdentifier = null;
            this.dragOperationEnded = false;
            this.dragOperationCancelled = false;
            this.dragImageDisplayCss = null;
            config.log("setting up potential drag operation..");
            this.touchMoveHandler = this.onTouchMove.bind(this);
            this.touchEndOrCancelHandler = this.onTouchEndOrCancel.bind(this);
            this.snapbackEndedCb = this.snapbackTransitionEnded.bind(this);
            this.dataTransfer = new DataTransfer(this.dragDataStore);
            this.lastTouchEvent = initialEvent;
            this.initialDragTouchIdentifier = this.lastTouchEvent.changedTouches[0].identifier;
            if (this.dragstart(this.sourceNode)) {
                config.log("dragstart cancelled");
                this.cleanup();
            }
            else {
                this.setup();
            }
        }
        DragOperationController.prototype.setup = function () {
            var _this = this;
            this.config.log("setup");
            this.createDragImage(this.lastTouchEvent);
            document.addEventListener("touchmove", this.touchMoveHandler);
            document.addEventListener("touchend", this.touchEndOrCancelHandler);
            document.addEventListener("touchcancel", this.touchEndOrCancelHandler);
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
            this.doc = null;
            this.immediateUserSelection = null;
            this.dataTransfer = null;
            this.currentDropTarget = null;
            this.dragDataStore = null;
            this.lastTouchEvent = null;
            this.touchEndOrCancelHandler = null;
            this.touchMoveHandler = null;
            this.snapbackEndedCb = null;
            this.dragOperationEndedCb();
        };
        DragOperationController.prototype.onTouchMove = function (event) {
            if (Util.IsTouchIdentifierContainedInTouchEvent(event, this.initialDragTouchIdentifier) === false) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lastTouchEvent = event;
            var pageXs = [], pageYs = [];
            [].forEach.call(event.changedTouches, function (touch, index) {
                pageXs.push(touch.pageX);
                pageYs.push(touch.pageY);
            });
            var x = Util.Average(pageXs) - (parseInt(this.dragImage.offsetWidth, 10) / 2);
            var y = Util.Average(pageYs) - (parseInt(this.dragImage.offsetHeight, 10) / 2);
            this.translateDragImage(x, y);
        };
        DragOperationController.prototype.onTouchEndOrCancel = function (event) {
            if (Util.IsTouchIdentifierContainedInTouchEvent(event, this.initialDragTouchIdentifier) === false) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.config.log("touch cancelled or ended");
            this.lastTouchEvent = event;
            this.dragOperationEnded = true;
            this.dragOperationCancelled = (event.type === "touchcancel");
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
            if (this.config.dragImageClass) {
                this.dragImage.classList.add(this.config.dragImageClass);
            }
            var pageXs = [], pageYs = [];
            [].forEach.call(event.changedTouches, function (touch, index) {
                pageXs.push(touch.pageX);
                pageYs.push(touch.pageY);
            });
            var x = Util.Average(pageXs) - (parseInt(this.sourceNode.offsetWidth, 10) / 2);
            var y = Util.Average(pageYs) - (parseInt(this.sourceNode.offsetHeight, 10) / 2);
            this.translateDragImage(x, y);
            this.sourceNode.parentNode.insertBefore(this.dragImage, this.sourceNode.nextSibling);
        };
        DragOperationController.prototype.hideDragImage = function () {
            if (this.dragImage && this.dragImage.style["display"] != "none") {
                this.dragImageDisplayCss = this.dragImage.style["display"];
                this.dragImage.style["display"] = "none";
            }
        };
        DragOperationController.prototype.showDragImage = function () {
            if (this.dragImage) {
                this.dragImage.style["display"] = this.dragImageDisplayCss ? this.dragImageDisplayCss : "block";
            }
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
            this.cleanup();
        };
        DragOperationController.IsDragOperation = function (event, config) {
            config.log("detecting possible drag operation..");
            var el = event.target;
            do {
                if (el.draggable === false) {
                    continue;
                }
                if (el.tagName == "A" && !el.getAttribute("draggable")) {
                    var clickEvt = Util.CreateMouseEventFromTouch(event, "click");
                    config.log("dispatching click on anchor");
                    var cancelled = el.dispatchEvent(clickEvt);
                    if (!cancelled) {
                        event.preventDefault();
                        return null;
                    }
                }
                if (el.getAttribute("draggable")) {
                    config.log("drag on tag");
                    return el;
                }
            } while ((el = el.parentNode) && el !== window.document.body);
        };
        DragOperationController.prototype.dragAndDropProcessModelIteration = function () {
            var dragCancelled = this.drag(this.sourceNode);
            if (dragCancelled) {
                this.config.log("drag event cancelled.");
                this.currentDragOperation = "none";
            }
            if (dragCancelled || this.dragOperationEnded) {
                var dragFailed = this.DragOperationEnded(this.dragOperationCancelled);
                if (dragFailed) {
                    this.snapbackDragImage();
                    return;
                }
                this.dragend(this.sourceNode);
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
                        this.config.log("dragenter not prevented");
                        if (DragOperationController.GetOperationForMatchingDropzone(this.immediateUserSelection, this.dragDataStore) !== "none") {
                            this.currentDropTarget = this.immediateUserSelection;
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
                this.dragleave(previousTargetElement);
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
        DragOperationController.prototype.DragOperationEnded = function (cancelled) {
            this.config.log("drag operation end detected. cancelled: " + !!cancelled);
            var dragFailed = (this.currentDragOperation === "none"
                || this.currentDropTarget === null
                || cancelled);
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
        DragOperationController.GetOperationForMatchingDropzone = function (element, dragDataStore) {
            // If the current target element is an element with a dropzone attribute that matches the drag data store and specifies an operation
            //      Set the current drag operation to the operation specified by the dropzone attribute of the current target element.
            // If the current target element is an element with a dropzone attribute that matches the drag data store and does not specify an operation
            //      Set the current drag operation to "copy".
            // Otherwise
            //      Reset the current drag operation to "none".
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
        DragOperationController.prototype.dragenter = function (targetElement) {
            this.config.log("dragenter");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            this.dataTransfer.dropEffect = DragOperationController.DetermineDropEffect(this.dragDataStore.effectAllowed, this.sourceNode);
            var enterEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragenter", true, this.doc.defaultView, this.dataTransfer, this.currentDropTarget);
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
        DragOperationController.prototype.dragleave = function (targetElement) {
            this.config.log("dragleave");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            var leaveEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragleave", false, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(leaveEvt);
            this.dragDataStore.mode = DragDataStoreMode._DISCONNECTED;
            return cancelled;
        };
        DragOperationController.prototype.dragexit = function (targetElement) {
            this.config.log("dragexit");
            this.dragDataStore.mode = DragDataStoreMode.PROTECTED;
            var exitEvt = Util.CreateDragEventFromTouch(this.lastTouchEvent, "dragexit", false, this.doc.defaultView, this.dataTransfer, null);
            var cancelled = !targetElement.dispatchEvent(exitEvt);
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
        DataTransfer.prototype.setData = function (format, data) {
            if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                return;
            }
            if (this.dataStore.mode === DragDataStoreMode.READWRITE) {
                this.dataStore.data[format] = data;
                var index = this.dataStore.types.indexOf(format);
                if (index > -1) {
                    this.dataStore.types.push(format);
                }
            }
        };
        DataTransfer.prototype.getData = function (format) {
            if (this.dataStore.mode === DragDataStoreMode._DISCONNECTED) {
                return null;
            }
            if (this.dataStore.mode === DragDataStoreMode.PROTECTED) {
                return null;
            }
            return this.dataStore.data[format] || "";
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
        DataTransfer.prototype.setDragImage = function () {
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
        return Util;
    })();
})(MobileDragAndDropPolyfill || (MobileDragAndDropPolyfill = {}));
//# sourceMappingURL=mobile-drag-and-drop-polyfill.js.map