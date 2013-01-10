(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  (function() {
    var DEBUG, DragDrop, ERROR, INFO, LOG_LEVEL, VERBOSE, average, div, doc, dragDiv, dragstart, evts, getEls, handler, log, needsPatch, noop, onEvt, once, parents;
    VERBOSE = 3;
    DEBUG = 2;
    INFO = 1;
    ERROR = 0;
    LOG_LEVEL = 1;
    doc = document;
    noop = function() {};
    log = noop || function(msg, level) {
      if (level == null) {
        level = ERROR;
      }
      if (level <= LOG_LEVEL) {
        return console.log(msg);
      }
    };
    onEvt = function(el, event, handler) {
      el.addEventListener(event, handler);
      return {
        off: function() {
          return el.removeEventListener(event, handler);
        }
      };
    };
    once = function(el, event, handler) {
      var listener;
      return el.addEventListener(event, listener = function(evt) {
        handler(evt);
        return el.removeEventListener(event, listener);
      });
    };
    average = function(arr) {
      if (arr.length === 0) {
        return 0;
      }
      return arr.reduce((function(s, v) {
        return v + s;
      }), 0) / arr.length;
    };
    DragDrop = (function() {
      function DragDrop(event, el) {
        var cancel, cleanup, end, evt, match, move, transform, x, y, _ref;
        if (el == null) {
          el = event.target;
        }
        this.dragend = __bind(this.dragend, this);
        this.move = __bind(this.move, this);
        event.preventDefault();
        log("dragstart");
        this.dragData = {};
        evt = doc.createEvent("Event");
        evt.initEvent("dragstart", true, true);
        evt.dataTransfer = {
          setData: __bind(function(type, val) {
            return this.dragData[type] = val;
          }, this),
          dropEffect: "move"
        };
        el.dispatchEvent(evt);
        cleanup = __bind(function() {
          log("cleanup");
          this.touchPositions = {};
          return [move, end, cancel].forEach(function(handler) {
            return handler.off();
          });
        }, this);
        this.el = el;
        this.touchPositions = {};
        transform = this.el.style["-webkit-transform"];
        _ref = (match = /translate\(\s*(\d+)[^,]*,\D*(\d+)/.exec(transform)) ? [parseInt(match[1]), parseInt(match[2])] : [0, 0], x = _ref[0], y = _ref[1];
        this.elTranslation = {
          x: x,
          y: y
        };
        move = onEvt(doc, "touchmove", this.move);
        end = onEvt(doc, "touchend", __bind(function(evt) {
          this.dragend(evt, event.target);
          return cleanup();
        }, this));
        cancel = onEvt(doc, "touchcancel", cleanup);
      }
      DragDrop.prototype.move = function(event) {
        var deltas;
        log("dragmove", VERBOSE);
        deltas = [].slice.call(event.changedTouches).reduce(__bind(function(deltas, touch, index) {
          var position;
          position = this.touchPositions[index];
          if (position) {
            deltas.x.push(touch.pageX - position.x);
            deltas.y.push(touch.pageY - position.y);
          } else {
            this.touchPositions[index] = position = {};
          }
          position.x = touch.pageX;
          position.y = touch.pageY;
          return deltas;
        }, this), {
          x: [],
          y: []
        });
        this.elTranslation.x += average(deltas.x);
        this.elTranslation.y += average(deltas.y);
        return this.el.style["-webkit-transform"] = "translate(" + this.elTranslation.x + "px," + this.elTranslation.y + "px)";
      };
      DragDrop.prototype.dragend = function(event) {
        var doSnapBack, dragendEvt, dropEvt, next, parent, replacementFn, snapBack, target;
        log("dragend");
        doSnapBack = __bind(function() {
          once(this.el, "webkitTransitionEnd", __bind(function() {
            return this.el.style["-webkit-transition"] = "none";
          }, this));
          return setTimeout(__bind(function() {
            this.el.style["-webkit-transition"] = "all 0.2s";
            return this.el.style["-webkit-transform"] = "translate(0,0)";
          }, this));
        }, this);
        target = doc.elementFromPoint(event.changedTouches[0].pageX, event.changedTouches[0].pageY);
        if (target) {
          dropEvt = doc.createEvent("Event");
          dropEvt.initEvent("drop", true, true);
          dropEvt.dataTransfer = {
            getData: __bind(function(type) {
              return this.dragData[type];
            }, this)
          };
          snapBack = true;
          dropEvt.preventDefault = __bind(function() {
            snapBack = false;
            return this.el.style["-webkit-transform"] = "translate(0,0)";
          }, this);
          once(doc, "drop", __bind(function() {
            if (snapBack) {
              return doSnapBack();
            }
          }, this));
          parent = this.el.parentNode;
          replacementFn = (next = this.el.nextSibling) ? __bind(function() {
            return parent.insertBefore(this.el, next);
          }, this) : __bind(function() {
            return parent.appendChild(this.el);
          }, this);
          parent.removeChild(this.el);
          replacementFn();
          target.dispatchEvent(dropEvt);
        } else {
          once(doc, "dragend", doSnapBack);
        }
        dragendEvt = doc.createEvent("Event");
        dragendEvt.initEvent("dragend", true, true);
        return this.el.dispatchEvent(dragendEvt);
      };
      return DragDrop;
    })();
    getEls = function(el, selector) {
      var _ref;
      if (!selector) {
        _ref = [doc, el], el = _ref[0], selector = _ref[1];
      }
      return [].slice.call(el.querySelectorAll(selector));
    };
    div = doc.createElement('div');
    dragDiv = 'draggable' in div;
    evts = 'ondragstart' in div && 'ondrop' in div;
    needsPatch = !(dragDiv || evts) || /iPad|iPhone|iPod/.test(navigator.userAgent);
    log("" + (needsPatch ? "" : "not ") + "patching html5 drag drop");
    if (!needsPatch) {
      return;
    }
    dragstart = function(evt) {
      evt.preventDefault();
      return new DragDrop(evt);
    };
    parents = function(el) {
      var parent, _results;
      _results = [];
      while ((parent = el.parentNode) && parent !== doc.body) {
        el = parent;
        _results.push(parent);
      }
      return _results;
    };
    return doc.addEventListener("touchstart", handler = function(evt) {
      var el, _i, _len, _ref;
      _ref = [evt.target].concat(parents(evt.target));
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        el = _ref[_i];
        if (el.hasAttribute("draggable")) {
          evt.preventDefault();
          return dragstart(evt, el);
        }
      }
      return null;
    });
  })();
}).call(this);
