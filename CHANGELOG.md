## 2.3.0-rc.2 (2019-07-21)

Adds custom events to enable visualize `holdToDrag` functionality, #150,
see [README](https://github.com/timruffles/mobile-drag-drop#custom-events)

Thanks to @anwarjaved :+1:

Also will cancel pending dragstart if a `touchmove` event is detected during `holdToDrag`.

## 2.3.0-rc.1 (2018-03-17)

Maintenance release candidate for improving `holdToDrag` functionality

* improves logging of `holdToDrag` functionality
* adds `scroll` listener for aborting scheduled drag operation in capture phase

## 2.3.0-rc.0 (2018-01-22)

Maintenance release candidate containing bugfixes and API improvements.

* refactoring to modular files because my scrollwheel broke ;)
* special handling for canvas elements when creating drag image (fixes #120, thx to @johntdowney)
* got rid of some build middleware (fixes #118)
* remove DEBUG code to decrease size to 10.4kB minified
* adds config functions to customize tryFindDraggableTarget(), dragImageSetup() and elementFromPoint()

The enhanced config API is intended to enable custom workarounds when the polyfill falls short.

## 2.2.0 (2017-09-05)

`holdToDrag` option introduced in 1.x is now available in 2.x

Thanks to @altschuler and @matte00 :+1:

## 2.1.0 (2017-07-27)

This release adds a minor change to the API surface.

```TS
export function polyfill(override?: Config):boolean;
```

`polyfill()` will inform if the polyfill takes effect by returning `true`.

## 2.0.0 (2017-07-23)

Releasing the rewrite as stable 2.0.0 including a few breaking changes because of renaming. 

### BREAKING CHANGE

The github repository and released package is renamed from `drag-drop-polyfill` to `mobile-drag-drop`.

This changes how the package is installed and further how it is referenced.

BEFORE

`import {polyfill} from "drag-drop-polyfill/drag-drop-polyfill";`
`import {scrollBehaviourDragImageTranslateOverride} from "drag-drop-polyfill/drag-drop-polyfill-scroll-behaviour";` 

AFTER

`import {polyfill} from "mobile-drag-drop";`
`import {scrollBehaviourDragImageTranslateOverride} from "drag-drop-polyfill/scroll-behaviour";`


Also the css files got shorter names which do not repeat the package name in their filename.

BEFORE

`drag-drop-polyfill.css`
`drag-drop-polyfill-icons.css` 

AFTER

`default.css`
`icons.css`


## 2.0.0-rc.0 (2017-06-26)

### BREAKING CHANGE

On npm the polyfill now publishes flat.
This changes how the files are included
when the polyfill is installed through npm.

BEFORE

`import {polyfill} from "drag-drop-polyfill/release/drag-drop-polyfill";` 

AFTER

`import {polyfill} from "drag-drop-polyfill/drag-drop-polyfill";`


## 2.0.0-beta.3 (2016-11-25)

* **fix(DragImageOffset)**: fixed wrong drag image offset

* **fix(PassiveEventListener)**: added feature detection for passive event listeners on document

  Enables to register document level event listener as active i.e. listeners that propably call event.preventDefault()

  Required since future versions of Chrome and current stable Chromium will default to passive event listeners at document level to ensure smooth scrolling experience.
  
  
## 2.0.0-beta.2 (2016-09-13)

* package.json no longer uses `directories.lib` since it had no effect, `main` now points to `release/drag-drop-polyfill.min.js`.


## 2.0.0-beta.1 (2016-08-20)

### Bugfixes

* bower main-field no longer references minified file. (fixes #70)

* DEBUG variable is declared in the src itself. (fixes #71)

### Breaking changes

* `dragStartConditionOverride` previously was called multiple times for the same touch to decide if a drag-operation should start. This behaviour is deprecated in favor of having a one-time evaluation if a drag operation should start. Deciding after a multiple touch events of the same touch has the risk to break the drag-operation because if the browser started scrolling meanwhile there is no way to stop scrolling so drag operation is broken. If there is a way to reliably stop browser scrolling to let the drag operation overtake it can be discussed to bring the async-way of starting a drag-operation back. If you need to be able to scroll and have drag and drop on the scrollable content think about implementing a dedicated drag handle element.

* `dragImageTranslateOverride` no longer returns a boolean that indicates that `translateDragImageFn` was used to reposition the drag image. This is intended to simplify the API because using `translateDragImageFn` already indicates a translation override implicitly.

### Other changes

* DEBUG conditionals are not removed upon minification since its only 6 bytes more (3 bytes gzipped).
This is also motivated by an upcoming change where the sources will be refactored to ES6 modules and introducing UMD support where the global DEBUG variable will be removed.
Having a magic global DEBUG variable in the ES6 module context feels like a code-smell.


## 2.0.0-beta.0 (2016-06-25)

First beta-release of a major rewrite aiming to be as close as possible to
the HTML5 drag and drop spec.

More details to the rewrite can be read here https://github.com/timruffles/ios-html5-drag-drop-shim/pull/61

Demos, more documentation and migration notices will be subject of further beta releases.
