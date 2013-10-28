(function(doc) {

  log = function() {}; // noOp, remove this line to enable debugging

  main()

  var coordinateSystemForElementFromPoint;

  function main() {
    coordinateSystemForElementFromPoint = navigator.userAgent.match(/OS 5(?:_\d+)+ like Mac/) ? "client" : "page";

    var div = doc.createElement('div');
    dragDiv = 'draggable' in div;
    evts = 'ondragstart' in div && 'ondrop' in div;

    var needsPatch = !(dragDiv || evts) || /iPad|iPhone|iPod/.test(navigator.userAgent);
    log((needsPatch ? "" : "not ") + "patching html5 drag drop");

    if(false && !needsPatch) return

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

      ;[].forEach.call(event.changedTouches,function(touch, index) {
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
      this.el.style["-webkit-transform"] = "translate(" + this.elTranslation.x + "px," + this.elTranslation.y + "px)";
    },
    dragend: function(event) {

      // we'll dispatch drop if there's a target, then dragEnd. If drop isn't fired
      // or isn't cancelled, we'll snap back
      // drop comes first http://www.whatwg.org/specs/web-apps/current-work/multipage/dnd.html#drag-and-drop-processing-model
      log("dragend");

      var target = elementFromTouchEvent(this.el,event)

      if (target) {
        log("found drop target " + target.tagName);
        this.dispatchDrop()
      } else {
        log("no drop target, scheduling snapBack")
        once(doc, "dragend", this.snapBack, this);
      }

      var dragendEvt = doc.createEvent("Event");
      dragendEvt.initEvent("dragend", true, true);
      this.el.dispatchEvent(dragendEvt);
    },
    dispatchDrop: function() {
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
        snapBack = false;
        this.el.style["-webkit-transform"] = "translate(0,0)";
      }.bind(this);

      once(doc, "drop", function() {
        log("drop event not canceled");
        if (snapBack) this.snapBack()
      },this);

      target.dispatchEvent(dropEvt);
    },
    snapBack: function() {
      once(this.el, "webkitTransitionEnd", function() {
        this.el.style["-webkit-transition"] = "none";
      },this);
      setTimeout(function() {
        this.el.style["-webkit-transition"] = "all 0.2s";
        this.el.style["-webkit-transform"] = "translate(0,0)";
      }.bind(this));
    },
    dispatchDragStart: function() {
      var evt = doc.createEvent("Event");
      evt.initEvent("dragstart", true, true);
      evt.dataTransfer = {
        setData: function(type, val) {
          return this.dragData[type] = val;
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
    } while((el = el.parentNode) && el != doc.body)
  }

  // DOM helpers
  function elementFromTouchEvent(el,event) {
    var parent = el.parentElement;
    var next = el.nextSibling
    parent.removeChild(el);

    var touch = event.changedTouches[0];
    target = doc.elementFromPoint(
      touch[coordinateSystemForElementFromPoint + "X"], 
      touch[coordinateSystemForElementFromPoint + "Y"]
    );

    if(next) {
      parent.insertBefore(el, next);
    } else {
      parent.appendChild(el);
    }

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

})(document);
