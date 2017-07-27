![dependencies](https://img.shields.io/david/timruffles/ios-html5-drag-drop-shim/master.svg)
![devdependencies](https://img.shields.io/david/dev/timruffles/ios-html5-drag-drop-shim/master.svg)
[![npmversion](https://img.shields.io/npm/v/mobile-drag-drop.svg)](https://www.npmjs.com/package/mobile-drag-drop)
![bowerversion](https://img.shields.io/bower/v/mobile-drag-drop.svg)
![license](https://img.shields.io/npm/l/mobile-drag-drop.svg)
![issues](https://img.shields.io/github/issues/timruffles/ios-html5-drag-drop-shim.svg)
![size](https://badge-size.herokuapp.com/timruffles/ios-html5-drag-drop-shim/master/release/index.min.js)
![gzippedsize](https://badge-size.herokuapp.com/timruffles/ios-html5-drag-drop-shim/master/release/index.min.js?compression=gzip)


# Polyfill for HTML 5 drag'n'drop

The HTML 5 drag'n'drop API allows you to implement drag'n'drop on [most desktop browsers](http://caniuse.com/#search=drag). 

Unfortunately, you'll notice most mobile browsers don't support it, so no iPad (or Nexus) action for you!

Luckily, browsers give us enough tools to make it happen ourselves. If you drop
this package in your page your existing HTML 5 drag'n'drop code should _just work_ ([*almost](#polyfill-requires-dragenter-listener)).


## Demos

[Demo](http://timruffles.github.io/ios-html5-drag-drop-shim/demo/)

Check out the demo to see it in action and monitor the console to see the events firing.


## Install

**bower**

`bower install mobile-drag-drop --save`

**npm**

`npm install mobile-drag-drop --save`

**jspm**

`jspm install npm:mobile-drag-drop`


### Include

**global**

```HTML
<link rel="stylesheet" href="libs/mobile-drag-drop/release/default.css">
<script src="libs/mobile-drag-drop/release/index.min.js"></script>

<!--optional import of scroll behaviour-->
<script src="libs/mobile-drag-drop/release/scroll-behaviour.min.js"></script>

<script>
    // options are optional ;)
    MobileDragDrop.polyfill({
        // use this to make use of the scroll behaviour
        dragImageTranslateOverride: MobileDragDrop.scrollBehaviourDragImageTranslateOverride
    });
</script>
```

**SystemJS/JSPM**

```JavaScript
System.import("mobile-drag-drop");
// import css if using system-js css loader plugin 
System.import("mobile-drag-drop/default.css!");
```

**ES2015/TypeScript/webpack**

```JavaScript
import {polyfill} from "mobile-drag-drop";

// optional import of scroll behaviour
import {scrollBehaviourDragImageTranslateOverride} from "mobile-drag-drop/scroll-behaviour";

// options are optional ;)
polyfill({
    // use this to make use of the scroll behaviour
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
});
```

**Make sure to implement a `dragenter`-listener!** ([read here why](#polyfill-requires-dragenter-listener))

```
// dragenter listener
(event)=> {
    event.preventDefault();
}
```

**webpack/scss**

```SCSS
@import "~mobile-drag-drop/default.css";
```

## API & Options <a name="options"></a>

```TypeScript
export interface Point {
    x: number;
    y: number;
}

// function signature for the dragImageTranslateOverride hook
export type DragImageTranslateOverrideFn = (
    // corresponding touchmove event
    event: TouchEvent, 
    // the processed touch event viewport coordinates
    hoverCoordinates: Point, 
    // the element under the calculated touch coordinates
    hoveredElement: HTMLElement, 
    // callback for updating the drag image offset
    translateDragImageFn: (offsetX: number, offsetY: number) => void;
) => void;

export interface Config {
    // flag to force the polyfill being applied and not rely on internal feature detection
    forceApply?: boolean;
    // useful for when you want the default drag image but still want to apply
    // some static offset from touch coordinates to drag image coordinates
    // defaults to (0,0)
    dragImageOffset?: Point;
    // if the dragImage shall be centered on the touch coordinates
    // defaults to false
    dragImageCenterOnTouch?: boolean;
    // the drag and drop operation involves some processing. here you can specify in what interval this processing takes place.
    // defaults to 150ms
    iterationInterval?: number;
    // hook for custom logic that decides if a drag operation should start
    // executed once with the initial touchmove and if true is returned the drag-operation initializes.
    // defaults to (event.touches.length === 1) 
    dragStartConditionOverride?: (event: TouchEvent) => boolean;
    // hook for custom logic that can manipulate the drag image translate offset
    dragImageTranslateOverride?: DragImageTranslateOverrideFn;
    // hook for custom logic that can override the default action based on the original touch event when the drag never started
    // be sure to call event.preventDefault() if handling the default action in the override to prevent the browser default.
    defaultActionOverride?: (event: TouchEvent) => void;
}

// invoke for initializing the polyfill
export function polyfill(override?: Config): void;
```


## DragImage Customization

Override the classes that are applied by the polyfill. Mind the `!important`.

```CSS
.dnd-poly-drag-image {
    opacity: .5 !important;
}
/* applied when the drag effect is none and the operation ends */
.dnd-poly-drag-image.snapback {
    -webkit-transition: -webkit-transform 250ms ease-out !important;
    -moz-transition: -moz-transform 250ms ease-out !important;
    -o-transition: -o-transform 250ms ease-out !important;
    transition: transform 250ms ease-out !important;
}
/* applied always as a base class for drop effect styles */
.dnd-poly-drag-icon {
}
```

CSS classes are applied to the `dragImage`-element according to the
current drop effect: `none`, `copy`, `move`, `link`.

There is `icons.css` which defines default styles and icons.
Feel free to use this as a starting point.

```HTML
<link rel="stylesheet" href="[...]/mobile-drag-drop/icons.css">
```

[setDragImage()](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/setDragImage) is supported.


## Known issues and limitations

`iFrames` are currently not supported. Contributions welcome. Please see https://github.com/timruffles/ios-html5-drag-drop-shim/issues/5 for the current state.


## Browser compatibility

| Browser                          |  Support                 |  Known issues                                  |
| -------------------------------- | ------------------------ | ---------------------------------------------- |
| Chrome                           |  Native                  |  No known issues. [More info](#chrome-issues)  |
| Firefox                          |  Native                  |  No known issues. [More info](#firefox-issues) |
| Safari                           |  Native                  |  No known issues.                              |
| Opera                            |  Native                  |  Same as Chrome.                               |
| Internet Explorer 11             |  Native                  |  No known issues.                              |
| Edge                             |  **Unknown**             |  **Unknown**                                   |
| Mobile Safari (<iOS 10)          |  Polyfill                |  No known issues.                              |
| Mobile Safari (iOS 10)           |  Polyfill                |  [#77](https://github.com/timruffles/ios-html5-drag-drop-shim/issues/77) |
| Chrome on iOS                    |  Polyfill                |  No known issues.                              |
| Chrome on Android                |  Polyfill                |  No known issues.                              |
| Chrome on touch device           |  Polyfill                |  No known issues. [More info](#chrome-issues)  |
| Firefox on touch device          |  Native                  |  No known issues.                              |
| Firefox on Android               |  Polyfill                |  No known issues.                              |
| Amazon Silk                      |  **Unknown**             |  **Unknown**                                   |
| Ubuntu Phone                     |  Polyfill                |  No known issues.                              |
| IEMobile                         |  Native                  |  **Unknown**                                   |

**Chrome: <a name="chrome-issues"></a>**
Chrome supports touch devices/events. When run on a desktop touch device like MS Surface it turns on touch events
which also disables native drag-and-drop support. Touch events can also be set by a user in `chrome://flags` to `auto`, `on`, `off`.   
There is also a flag for enabling drag-and-drop through touch interaction but only for Windows and the option is off by default.
The polyfill still works if this setting is active. We cannot detect if this flag is set so we just stick to applying the polyfill
when Chrome is detected with touch events enabled.

**Firefox: <a name="firefox-issues"></a>**
Touch events can be activated by a user in `about:config` to `0` (off), `1` (on), `2`(auto).
As of today (FF39.0) touch behavior is off.
When touch events are active drag-and-drop interaction will still work, so no need to polyfill.


## Cross-browser differences in HTML5 drag'n'drop API

The drag'n'drop API is not implemented consistently in all browsers.
This table is an effort to list all things required to make drag'n'drop work in all browsers and with the polyfill.

| **Browser** | **dragstart**                            | **drag** | **dragend** | **dragenter**                                    | **dragover**                          | **dragleave** | **dragexit** |
| ----------- | ---------------------------------------- | -------- | ----------- | ------------------------------------------------ | ------------------------------------- | ------------- | ------------ |
| Firefox     | `event.dataTransfer.setData(type, data)` |          |             | [effectAllowed,dropEffect](#ff-quirk)            | [effectAllowed,dropEffect](#ff-quirk) |               |              |
| IE11        |                                          |          |             | `event.preventDefault()` when registered on body |                                       |               |              |
| Polyfill    |                                          |          |             | `event.preventDefault()` or `dropzone` required  |                                       |               |              |

_empty cells mean there is nothing special to take into account_

#### Polyfill requires dragenter listener

On desktop browsers if no `dragenter`-handler is registered the drag-operation is silently allowed. Browsers don't implement `dropzone`-attribute 
according to [caniuse](http://caniuse.com/#search=drag) which is why they allow it by default, which violates the spec. 

If a handler is set up it has to call `event.preventDefault()` to allow dropping.

This is pretty bad for the polyfill since JS doesn't allow to check how many listeners were invoked when the event is dispatched,
which forces the polyfill to rely on a listener being present calling `event.preventDefault()` to make it work.


**Further notices:**

*   FF:<a name="ff-quirk"></a> If `effectAllowed` or `dropEffect` is set in `dragstart` then `dragenter/dragover` also need to set it.
*   When using a MS Surface tablet a drag-operation is initiated by touch and hold on a draggable.
*   IE11 and Chrome scroll automatically when dragging close to a viewport edge.

**Baseline recommendations for cross-browser/-platform support:**

* Always set drag data on `dragstart` by calling `event.dataTransfer.setData(type, data)`.
* Always handle `dragenter`-event on possible dropzones if the drop is allowed by calling `event.preventDefault()`.
* Handle `dragover`-event on dropzone when the drop is allowed by calling `event.preventDefault()`, otherwise the drag-operation is aborted.


## Contribute

Contributions are welcome.

For more details on development setup see [CONTRIBUTING.md](./CONTRIBUTING.md)


## Thanks

To the [amazing contributors](https://github.com/timruffles/ios-html5-drag-drop-shim/graphs/contributors) who've provided massive extensions and fixes to the original.

<a href="http://twitter.com/rem">@rem</a> - who created the original demo used to demo this shim's drop-in nature.


## License

[MIT License](LICENSE)
