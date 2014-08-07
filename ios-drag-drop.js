(function(doc) {

  log = noop; // noOp, remove this line to enable debugging

  var coordinateSystemForElementFromPoint;

  function main(config) {
    config = config || {};

    coordinateSystemForElementFromPoint = navigator.userAgent.match(/OS 5(?:_\d+)+ like Mac/) ? "client" : "page";

    var div = doc.createElement('div');
    var dragDiv = 'draggable' in div;
    var evts = 'ondragstart' in div && 'ondrop' in div;

    var needsPatch = !(dragDiv || evts) || /iPad|iPhone|iPod/.test(navigator.userAgent);
    log((needsPatch ? "" : "not ") + "patching html5 drag drop");

    if(!needsPatch) return;

    if(!config.enableEnterLeave) {
      DragDrop.prototype.synthesizeEnterLeave = noop;
    }

    doc.addEventListener("touchstart", touchstart);
  }

  function DragDrop(event, el) {

    this.touchPositions = {};
    this.dragData = {};
    this.el = el || event.target

    event.preventDefault();

    log("dragstart");

    this.dispatchDragStart()
    this.elTranslation = readTransform(this.el);

    this.listen()

  }

  DragDrop.prototype = {
    listen: function() {
      var move = onEvt(doc, "touchmove", this.move, this);
      var end = onEvt(doc, "touchend", ontouchend, this);
      var cancel = onEvt(doc, "touchcancel", cleanup, this);

      function ontouchend(event) {
        this.dragend(event, event.target);
        cleanup();
      }
      function cleanup() {
        log("cleanup");
        this.touchPositions = {};
        this.el = this.dragData = null;
        return [move, end, cancel].forEach(function(handler) {
          return handler.off();
        });
      }
    },
    move: function(event) {
      var deltas = { x: [], y: [] };

      [].forEach.call(event.changedTouches,function(touch, index) {
        var lastPosition = this.touchPositions[index];
        if (lastPosition) {
          deltas.x.push(touch.pageX - lastPosition.x);
          deltas.y.push(touch.pageY - lastPosition.y);
        } else {
          this.touchPositions[index] = lastPosition = {};
        }
        lastPosition.x = touch.pageX;
        lastPosition.y = touch.pageY;
      }.bind(this))

      this.elTranslation.x += average(deltas.x);
      this.elTranslation.y += average(deltas.y);
      this.el.style["z-index"] = "999999";
      this.el.style["pointer-events"] = "none";
      writeTransform(this.el, this.elTranslation.x, this.elTranslation.y);

      this.synthesizeEnterLeave(event);
    },
    synthesizeEnterLeave: function(event) {
      var target = elementFromTouchEvent(this.el,event)
      if (target != this.lastEnter) {
        if (this.lastEnter) {
          this.dispatchLeave();
        }
        this.lastEnter = target;
        this.dispatchEnter();
      }
    },
    dragend: function(event) {

      // we'll dispatch drop if there's a target, then dragEnd. If drop isn't fired
      // or isn't cancelled, we'll snap back
      // drop comes first http://www.whatwg.org/specs/web-apps/current-work/multipage/dnd.html#drag-and-drop-processing-model
      log("dragend");

      if (this.lastEnter) {
        this.dispatchLeave();
      }

      var target = elementFromTouchEvent(this.el,event)

      if (target) {
        log("found drop target " + target.tagName);
        this.dispatchDrop(target)
      } else {
        log("no drop target, scheduling snapBack")
        once(doc, "dragend", this.snapBack, this);
      }

      var dragendEvt = doc.createEvent("Event");
      dragendEvt.initEvent("dragend", true, true);
      this.el.dispatchEvent(dragendEvt);
    },
    dispatchDrop: function(target) {
      var snapBack = true;

      var dropEvt = doc.createEvent("Event");
      dropEvt.initEvent("drop", true, true);
      dropEvt.dataTransfer = {
        getData: function(type) {
          return this.dragData[type];
        }.bind(this)
      };
      dropEvt.preventDefault = function() {
         // https://www.w3.org/Bugs/Public/show_bug.cgi?id=14638 - if we don't cancel it, we'll snap back
        this.el.style["z-index"] = "";
        this.el.style["pointer-events"] = "auto";
        snapBack = false;
        writeTransform(this.el, 0, 0);
      }.bind(this);

      once(doc, "drop", function() {
        log("drop event not canceled");
        if (snapBack) this.snapBack()
      },this);

      target.dispatchEvent(dropEvt);
    },
    dispatchEnter: function() {

      var enterEvt = doc.createEvent("Event");
      enterEvt.initEvent("dragenter", true, true);
      enterEvt.dataTransfer = {
        getData: function(type) {
          return this.dragData[type];
        }.bind(this)
      };

      this.lastEnter.dispatchEvent(enterEvt);
    },
    dispatchLeave: function() {

      var leaveEvt = doc.createEvent("Event");
      leaveEvt.initEvent("dragleave", true, true);
      leaveEvt.dataTransfer = {
        getData: function(type) {
          return this.dragData[type];
        }.bind(this)
      };

      this.lastEnter.dispatchEvent(leaveEvt);
      this.lastEnter = null;
    },
    snapBack: function() {
      once(this.el, "webkitTransitionEnd", function() {
        this.el.style["pointer-events"] = "auto";
        this.el.style["z-index"] = "";
        this.el.style["-webkit-transition"] = "none";
      },this);
      setTimeout(function() {
        this.el.style["-webkit-transition"] = "all 0.2s";
        writeTransform(this.el, 0, 0)
      }.bind(this));
    },
    dispatchDragStart: function() {
      var evt = doc.createEvent("Event");
      evt.initEvent("dragstart", true, true);
      evt.dataTransfer = {
        setData: function(type, val) {
          this.dragData[type] = val;
          return val;
        }.bind(this),
        dropEffect: "move"
      };
      this.el.dispatchEvent(evt);
    }
  }

  // event listeners
  function touchstart(evt) {
    var el = evt.target;
    do {
      if (el.hasAttribute("draggable")) {
        evt.preventDefault();
        new DragDrop(evt,el);
      }
    } while((el = el.parentNode) && el !== doc.body)
  }

  // DOM helpers
  function elementFromTouchEvent(el,event) {
    var touch = event.changedTouches[0];
    var target = doc.elementFromPoint(
      touch[coordinateSystemForElementFromPoint + "X"],
      touch[coordinateSystemForElementFromPoint + "Y"]
    );
    return target
  }

  function readTransform(el) {
    var transform = el.style["-webkit-transform"];
    var x = 0
    var y = 0
    var match = /translate\(\s*(\d+)[^,]*,\D*(\d+)/.exec(transform)
    if(match) {
      x = parseInt(match[1],10)
      y = parseInt(match[2],10)
    }
    return { x: x, y: y };
  }

  function writeTransform(el, x, y) {
    var transform = el.style["-webkit-transform"].replace(/translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g, '');
    el.style["-webkit-transform"] = transform + " translate(" + x + "px," + y + "px)";
  }

  function onEvt(el, event, handler, context) {
    if(context) handler = handler.bind(context)
    el.addEventListener(event, handler);
    return {
      off: function() {
        return el.removeEventListener(event, handler);
      }
    };
  }

  function once(el, event, handler, context) {
    if(context) handler = handler.bind(context)
    function listener(evt) {
      handler(evt);
      return el.removeEventListener(event,listener);
    }
    return el.addEventListener(event,listener);
  }


  // general helpers
  function log(msg) {
    console.log(msg);
  }

  function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((function(s, v) {
      return v + s;
    }), 0) / arr.length;
  }

  function noop() {}

  main(window.iosDragDropShim);


})(document);
