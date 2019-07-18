// debug mode, which will highlight drop target, immediate user selection and events fired as you interact
// only available in non-minified js / development environment
// export const DEBUG = false;

// css classes
export const CLASS_PREFIX = "dnd-poly-";
export const CLASS_DRAG_IMAGE = CLASS_PREFIX + "drag-image";
export const CLASS_DRAG_IMAGE_SNAPBACK = CLASS_PREFIX + "snapback";
export const CLASS_DRAG_OPERATION_ICON = CLASS_PREFIX + "icon";

// custom event
export const EVENT_PREFIX = "dnd-poly-";
export const EVENT_DRAG_DRAGSTART_PENDING = EVENT_PREFIX + "dragstart-pending";
export const EVENT_DRAG_DRAGSTART_CANCEL = EVENT_PREFIX + "dragstart-cancel";

// defines the array indexes to access string in ALLOWED_EFFECTS
export const enum EFFECT_ALLOWED {
    NONE = 0,
    COPY = 1,
    COPY_LINK = 2,
    COPY_MOVE = 3,
    LINK = 4,
    LINK_MOVE = 5,
    MOVE = 6,
    ALL = 7
}

// contains all possible values of the effectAllowed property
export const ALLOWED_EFFECTS = [ "none", "copy", "copyLink", "copyMove", "link", "linkMove", "move", "all" ];

// defines the array indexes to access string in DROP_EFFECTS
export const enum DROP_EFFECT {
    NONE = 0,
    COPY = 1,
    MOVE = 2,
    LINK = 3,
}

// contains all possible values of the dropEffect property
export const DROP_EFFECTS = [ "none", "copy", "move", "link" ];
