/*!
 * Mettle.js v1.7.5
 * (c) 2021-2025 maomincoding
 * Released under the MIT License.
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Mettle = {}));
})(this, (function (exports) { 'use strict';

    const MODE_SLASH = 0;
    const MODE_TEXT = 1;
    const MODE_WHITESPACE = 2;
    const MODE_TAGNAME = 3;
    const MODE_COMMENT = 4;
    const MODE_PROP_SET = 5;
    const MODE_PROP_APPEND = 6;
    const CHILD_APPEND = 0;
    const CHILD_RECURSE = 2;
    const TAG_SET = 3;
    const PROPS_ASSIGN = 4;
    const PROP_SET = MODE_PROP_SET;
    const PROP_APPEND = MODE_PROP_APPEND;
    const evaluate = (h, built, fields, args) => {
        let tmp;
        built[0] = 0;
        for (let i = 1; i < built.length; i++) {
            const type = built[i++];
            const value = built[i] ? ((built[0] |= type ? 1 : 2), fields[built[i++]]) : built[++i];
            if (type === TAG_SET) {
                args[0] = value;
            }
            else if (type === PROPS_ASSIGN) {
                args[1] = Object.assign(args[1] || {}, value);
            }
            else if (type === PROP_SET) {
                (args[1] = args[1] || {})[built[++i]] = value;
            }
            else if (type === PROP_APPEND) {
                args[1][built[++i]] += value + '';
            }
            else if (type) {
                tmp = h.apply(value, evaluate(h, value, fields, ['', null]));
                args.push(tmp);
                if (value[0]) {
                    built[0] |= 2;
                }
                else {
                    built[i - 2] = CHILD_APPEND;
                    built[i] = tmp;
                }
            }
            else {
                args.push(value);
            }
        }
        return args;
    };
    const build = function (statics) {
        let mode = MODE_TEXT;
        let buffer = '';
        let quote = '';
        let current = [0];
        let char, propName;
        const commit = (field) => {
            if (mode === MODE_TEXT && (field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, '')))) {
                current.push(CHILD_APPEND, field, buffer);
            }
            else if (mode === MODE_TAGNAME && (field || buffer)) {
                current.push(TAG_SET, field, buffer);
                mode = MODE_WHITESPACE;
            }
            else if (mode === MODE_WHITESPACE && buffer === '...' && field) {
                current.push(PROPS_ASSIGN, field, 0);
            }
            else if (mode === MODE_WHITESPACE && buffer && !field) {
                current.push(PROP_SET, 0, true, buffer);
            }
            else if (mode >= MODE_PROP_SET) {
                if (buffer || (!field && mode === MODE_PROP_SET)) {
                    current.push(mode, 0, buffer, propName);
                    mode = MODE_PROP_APPEND;
                }
                if (field) {
                    current.push(mode, field, 0, propName);
                    mode = MODE_PROP_APPEND;
                }
            }
            buffer = '';
        };
        for (let i = 0; i < statics.length; i++) {
            if (i) {
                if (mode === MODE_TEXT) {
                    commit();
                }
                commit(i);
            }
            for (let j = 0; j < statics[i].length; j++) {
                char = statics[i][j];
                if (mode === MODE_TEXT) {
                    if (char === '<') {
                        commit();
                        current = [current];
                        mode = MODE_TAGNAME;
                    }
                    else {
                        buffer += char;
                    }
                }
                else if (mode === MODE_COMMENT) {
                    if (buffer === '--' && char === '>') {
                        mode = MODE_TEXT;
                        buffer = '';
                    }
                    else {
                        buffer = char + buffer[0];
                    }
                }
                else if (quote) {
                    if (char === quote) {
                        quote = '';
                    }
                    else {
                        buffer += char;
                    }
                }
                else if (char === '"' || char === "'") {
                    quote = char;
                }
                else if (char === '>') {
                    commit();
                    mode = MODE_TEXT;
                }
                else if (!mode) ;
                else if (char === '=') {
                    mode = MODE_PROP_SET;
                    propName = buffer;
                    buffer = '';
                }
                else if (char === '/' && (mode < MODE_PROP_SET || statics[i][j + 1] === '>')) {
                    commit();
                    if (mode === MODE_TAGNAME) {
                        current = current[0];
                    }
                    mode = current;
                    (current = current[0]).push(CHILD_RECURSE, 0, mode);
                    mode = MODE_SLASH;
                }
                else if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
                    commit();
                    mode = MODE_WHITESPACE;
                }
                else {
                    buffer += char;
                }
                if (mode === MODE_TAGNAME && buffer === '!--') {
                    mode = MODE_COMMENT;
                    current = current[0];
                }
            }
        }
        commit();
        return current;
    };
    const CACHES = new Map();
    const regular = function (statics) {
        let tmp = CACHES.get(this);
        if (!tmp) {
            tmp = new Map();
            CACHES.set(this, tmp);
        }
        tmp = evaluate(this, tmp.get(statics) || (tmp.set(statics, (tmp = build(statics))), tmp), arguments, []);
        return tmp.length > 1 ? tmp : tmp[0];
    };
    const createVNode = function (tag, props, child) {
        let key = null;
        let el = null;
        let i = null;
        let children = null;
        for (i in props) {
            if (i === 'key')
                key = props[i];
        }
        if (arguments.length > 2) {
            children = arguments.length > 3 ? Array.prototype.slice.call(arguments, 2) : child;
        }
        // Vnode
        return {
            tag,
            props,
            children,
            key,
            el,
        };
    };
    const html = regular.bind(createVNode);

    const BRAND_SYMBOL = Symbol.for('signals');
    const RUNNING = 1 << 0;
    const NOTIFIED = 1 << 1;
    const OUTDATED = 1 << 2;
    const DISPOSED = 1 << 3;
    const HAS_ERROR = 1 << 4;
    const TRACKING = 1 << 5;
    // Batch
    function startBatch() {
        batchDepth++;
    }
    function endBatch() {
        if (batchDepth > 1) {
            batchDepth--;
            return;
        }
        let error;
        let hasError = false;
        while (batchedEffect !== undefined) {
            let effect = batchedEffect;
            batchedEffect = undefined;
            batchIteration++;
            while (effect !== undefined) {
                const next = effect._nextBatchedEffect;
                effect._nextBatchedEffect = undefined;
                effect._flags &= ~NOTIFIED;
                if (!(effect._flags & DISPOSED) && needsToRecompute(effect)) {
                    try {
                        effect._callback();
                    }
                    catch (err) {
                        if (!hasError) {
                            error = err;
                            hasError = true;
                        }
                    }
                }
                effect = next;
            }
        }
        batchIteration = 0;
        batchDepth--;
        if (hasError) {
            throw error;
        }
    }
    function batch(fn) {
        if (batchDepth > 0) {
            return fn();
        }
        /*@__INLINE__**/ startBatch();
        try {
            return fn();
        }
        finally {
            endBatch();
        }
    }
    // Currently evaluated computed or effect.
    let evalContext = undefined;
    function untracked(fn) {
        const prevContext = evalContext;
        evalContext = undefined;
        try {
            return fn();
        }
        finally {
            evalContext = prevContext;
        }
    }
    let batchedEffect = undefined;
    let batchDepth = 0;
    let batchIteration = 0;
    let globalVersion = 0;
    function addDependency(signal) {
        if (evalContext === undefined) {
            return undefined;
        }
        let node = signal._node;
        if (node === undefined || node._target !== evalContext) {
            node = {
                _version: 0,
                _source: signal,
                _prevSource: evalContext._sources,
                _nextSource: undefined,
                _target: evalContext,
                _prevTarget: undefined,
                _nextTarget: undefined,
                _rollbackNode: node,
            };
            if (evalContext._sources !== undefined) {
                evalContext._sources._nextSource = node;
            }
            evalContext._sources = node;
            signal._node = node;
            if (evalContext._flags & TRACKING) {
                signal._subscribe(node);
            }
            return node;
        }
        else if (node._version === -1) {
            node._version = 0;
            if (node._nextSource !== undefined) {
                node._nextSource._prevSource = node._prevSource;
                if (node._prevSource !== undefined) {
                    node._prevSource._nextSource = node._nextSource;
                }
                node._prevSource = evalContext._sources;
                node._nextSource = undefined;
                evalContext._sources._nextSource = node;
                evalContext._sources = node;
            }
            return node;
        }
        return undefined;
    }
    /** @internal */
    // @ts-ignore: "Cannot redeclare exported variable 'Signal'."
    function Signal(value, options) {
        this._value = value;
        this._version = 0;
        this._node = undefined;
        this._targets = undefined;
        this._watched = options?.watched;
        this._unwatched = options?.unwatched;
        this.name = options?.name;
    }
    Signal.prototype.brand = BRAND_SYMBOL;
    Signal.prototype._refresh = function () {
        return true;
    };
    Signal.prototype._subscribe = function (node) {
        const targets = this._targets;
        if (targets !== node && node._prevTarget === undefined) {
            node._nextTarget = targets;
            this._targets = node;
            if (targets !== undefined) {
                targets._prevTarget = node;
            }
            else {
                untracked(() => {
                    this._watched?.call(this);
                });
            }
        }
    };
    Signal.prototype._unsubscribe = function (node) {
        if (this._targets !== undefined) {
            const prev = node._prevTarget;
            const next = node._nextTarget;
            if (prev !== undefined) {
                prev._nextTarget = next;
                node._prevTarget = undefined;
            }
            if (next !== undefined) {
                next._prevTarget = prev;
                node._nextTarget = undefined;
            }
            if (node === this._targets) {
                this._targets = next;
                if (next === undefined) {
                    untracked(() => {
                        this._unwatched?.call(this);
                    });
                }
            }
        }
    };
    Signal.prototype.subscribe = function (fn) {
        return effect(() => {
            const value = this.value;
            const prevContext = evalContext;
            evalContext = undefined;
            try {
                fn(value);
            }
            finally {
                evalContext = prevContext;
            }
        }, { name: 'sub' });
    };
    Signal.prototype.valueOf = function () {
        return this.value;
    };
    Signal.prototype.toString = function () {
        return this.value + '';
    };
    Signal.prototype.toJSON = function () {
        return this.value;
    };
    Signal.prototype.peek = function () {
        const prevContext = evalContext;
        evalContext = undefined;
        try {
            return this.value;
        }
        finally {
            evalContext = prevContext;
        }
    };
    Object.defineProperty(Signal.prototype, 'value', {
        get() {
            const node = addDependency(this);
            if (node !== undefined) {
                node._version = this._version;
            }
            return this._value;
        },
        set(value) {
            if (value !== this._value) {
                if (batchIteration > 100) {
                    throw new Error('Cycle detected');
                }
                this._value = value;
                this._version++;
                globalVersion++;
                /**@__INLINE__*/ startBatch();
                try {
                    for (let node = this._targets; node !== undefined; node = node._nextTarget) {
                        node._target._notify();
                    }
                }
                finally {
                    endBatch();
                }
            }
        },
    });
    function signal(value, options) {
        return new Signal(value, options);
    }
    function needsToRecompute(target) {
        for (let node = target._sources; node !== undefined; node = node._nextSource) {
            if (node._source._version !== node._version ||
                !node._source._refresh() ||
                node._source._version !== node._version) {
                return true;
            }
        }
        return false;
    }
    function prepareSources(target) {
        for (let node = target._sources; node !== undefined; node = node._nextSource) {
            const rollbackNode = node._source._node;
            if (rollbackNode !== undefined) {
                node._rollbackNode = rollbackNode;
            }
            node._source._node = node;
            node._version = -1;
            if (node._nextSource === undefined) {
                target._sources = node;
                break;
            }
        }
    }
    function cleanupSources(target) {
        let node = target._sources;
        let head = undefined;
        while (node !== undefined) {
            const prev = node._prevSource;
            if (node._version === -1) {
                node._source._unsubscribe(node);
                if (prev !== undefined) {
                    prev._nextSource = node._nextSource;
                }
                if (node._nextSource !== undefined) {
                    node._nextSource._prevSource = prev;
                }
            }
            else {
                head = node;
            }
            node._source._node = node._rollbackNode;
            if (node._rollbackNode !== undefined) {
                node._rollbackNode = undefined;
            }
            node = prev;
        }
        target._sources = head;
    }
    /** @internal */
    function Computed(fn, options) {
        Signal.call(this, undefined);
        this._fn = fn;
        this._sources = undefined;
        this._globalVersion = globalVersion - 1;
        this._flags = OUTDATED;
        this._watched = options?.watched;
        this._unwatched = options?.unwatched;
        this.name = options?.name;
    }
    Computed.prototype = new Signal();
    Computed.prototype._refresh = function () {
        this._flags &= ~NOTIFIED;
        if (this._flags & RUNNING) {
            return false;
        }
        if ((this._flags & (OUTDATED | TRACKING)) === TRACKING) {
            return true;
        }
        this._flags &= ~OUTDATED;
        if (this._globalVersion === globalVersion) {
            return true;
        }
        this._globalVersion = globalVersion;
        this._flags |= RUNNING;
        if (this._version > 0 && !needsToRecompute(this)) {
            this._flags &= ~RUNNING;
            return true;
        }
        const prevContext = evalContext;
        try {
            prepareSources(this);
            evalContext = this;
            const value = this._fn();
            if (this._flags & HAS_ERROR || this._value !== value || this._version === 0) {
                this._value = value;
                this._flags &= ~HAS_ERROR;
                this._version++;
            }
        }
        catch (err) {
            this._value = err;
            this._flags |= HAS_ERROR;
            this._version++;
        }
        evalContext = prevContext;
        cleanupSources(this);
        this._flags &= ~RUNNING;
        return true;
    };
    Computed.prototype._subscribe = function (node) {
        if (this._targets === undefined) {
            this._flags |= OUTDATED | TRACKING;
            for (let node = this._sources; node !== undefined; node = node._nextSource) {
                node._source._subscribe(node);
            }
        }
        Signal.prototype._subscribe.call(this, node);
    };
    Computed.prototype._unsubscribe = function (node) {
        if (this._targets !== undefined) {
            Signal.prototype._unsubscribe.call(this, node);
            if (this._targets === undefined) {
                this._flags &= ~TRACKING;
                for (let node = this._sources; node !== undefined; node = node._nextSource) {
                    node._source._unsubscribe(node);
                }
            }
        }
    };
    Computed.prototype._notify = function () {
        if (!(this._flags & NOTIFIED)) {
            this._flags |= OUTDATED | NOTIFIED;
            for (let node = this._targets; node !== undefined; node = node._nextTarget) {
                node._target._notify();
            }
        }
    };
    Object.defineProperty(Computed.prototype, 'value', {
        get() {
            if (this._flags & RUNNING) {
                throw new Error('Cycle detected');
            }
            const node = addDependency(this);
            this._refresh();
            if (node !== undefined) {
                node._version = this._version;
            }
            if (this._flags & HAS_ERROR) {
                throw this._value;
            }
            return this._value;
        },
    });
    function computed(fn, options) {
        return new Computed(fn, options);
    }
    // Effect
    function cleanupEffect(effect) {
        const cleanup = effect._cleanup;
        effect._cleanup = undefined;
        if (typeof cleanup === 'function') {
            /*@__INLINE__**/ startBatch();
            const prevContext = evalContext;
            evalContext = undefined;
            try {
                cleanup();
            }
            catch (err) {
                effect._flags &= ~RUNNING;
                effect._flags |= DISPOSED;
                disposeEffect(effect);
                throw err;
            }
            finally {
                evalContext = prevContext;
                endBatch();
            }
        }
    }
    function disposeEffect(effect) {
        for (let node = effect._sources; node !== undefined; node = node._nextSource) {
            node._source._unsubscribe(node);
        }
        effect._fn = undefined;
        effect._sources = undefined;
        cleanupEffect(effect);
    }
    function endEffect(prevContext) {
        if (evalContext !== this) {
            throw new Error('Out-of-order effect');
        }
        cleanupSources(this);
        evalContext = prevContext;
        this._flags &= ~RUNNING;
        if (this._flags & DISPOSED) {
            disposeEffect(this);
        }
        endBatch();
    }
    /** @internal */
    function Effect(fn, options) {
        this._fn = fn;
        this._cleanup = undefined;
        this._sources = undefined;
        this._nextBatchedEffect = undefined;
        this._flags = TRACKING;
        this.name = options?.name;
    }
    Effect.prototype._callback = function () {
        const finish = this._start();
        try {
            if (this._flags & DISPOSED)
                return;
            if (this._fn === undefined)
                return;
            const cleanup = this._fn();
            if (typeof cleanup === 'function') {
                this._cleanup = cleanup;
            }
        }
        finally {
            finish();
        }
    };
    Effect.prototype._start = function () {
        if (this._flags & RUNNING) {
            throw new Error('Cycle detected');
        }
        this._flags |= RUNNING;
        this._flags &= ~DISPOSED;
        cleanupEffect(this);
        prepareSources(this);
        /*@__INLINE__**/ startBatch();
        const prevContext = evalContext;
        evalContext = this;
        return endEffect.bind(this, prevContext);
    };
    Effect.prototype._notify = function () {
        if (!(this._flags & NOTIFIED)) {
            this._flags |= NOTIFIED;
            this._nextBatchedEffect = batchedEffect;
            batchedEffect = this;
        }
    };
    Effect.prototype._dispose = function () {
        this._flags |= DISPOSED;
        if (!(this._flags & RUNNING)) {
            disposeEffect(this);
        }
    };
    Effect.prototype.dispose = function () {
        this._dispose();
    };
    function effect(fn, options) {
        const effect = new Effect(fn, options);
        try {
            effect._callback();
        }
        catch (err) {
            effect._dispose();
            throw err;
        }
        const dispose = effect._dispose.bind(effect);
        // @ts-ignore
        dispose[Symbol.dispose] = dispose;
        return dispose;
    }

    // https://developer.mozilla.org/en-US/docs/Web/SVG/Element
    const SVG_TAGS = 'svg,animate,circle,clippath,cursor,image,defs,desc,ellipse,filter,font-face,' +
        'foreignobject,g,glyph,line,marker,mask,missing-glyph,path,pattern,' +
        'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view,' +
        'feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feFlood,feGaussianBlur,' +
        'feImage,feMerge,feMorphology,feOffset,feSpecularLighting,feTile,feTurbulence,feDistantLight,fePointLight,feSpotLight,' +
        'linearGradient,stop,radialGradient,' +
        'animateTransform,animateMotion';
    function makeMap(str) {
        const map = Object.create(null);
        const list = str.split(',');
        for (let i = 0; i < list.length; i++) {
            map[list[i]] = true;
        }
        return function (val) {
            return map[val];
        };
    }
    const isSVG = /*#__PURE__*/ makeMap(SVG_TAGS);
    const namespaceMap = {
        svg: 'http://www.w3.org/2000/svg',
        math: 'http://www.w3.org/1998/Math/MathML',
    };
    function getTagNamespace(tag) {
        if (isSVG(tag)) {
            return 'svg';
        }
        if (tag === 'math') {
            return 'math';
        }
        return undefined;
    }
    function createElementNS(namespace, tagName) {
        return document.createElementNS(namespaceMap[namespace], tagName);
    }
    const hasOwnProperty$1 = Object.prototype.hasOwnProperty;
    const hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
    const isObject = (val) => val !== null && typeof val === 'object';
    const isUndef = (v) => v === undefined || v === null;
    const checkSameVnode = (o, n) => o.tag === n.tag && o.key === n.key;
    const notTagComponent = (oNode, nNode) => typeof oNode.tag !== 'function' && typeof nNode.tag !== 'function';
    const isVnode = (vnode) => vnode != null && (typeof vnode === 'object' ? 'tag' in vnode : false);
    const isTextChildren = (children) => !isVnode(children) && !Array.isArray(children);
    function warn(msg) {
        console.warn(`[Mettle.js warn]: ${msg}`);
    }
    function setStyleProp(el, prototype) {
        Object.assign(el.style, prototype);
    }
    function addEventListener(el, name, listener) {
        if (typeof listener !== 'function')
            return;
        const eventName = name.slice(2).toLowerCase();
        el.addEventListener(eventName, listener);
    }
    function removeEventListener(el, name, listener) {
        if (typeof listener !== 'function')
            return;
        const eventName = name.slice(2).toLowerCase();
        el.removeEventListener(eventName, listener);
    }
    const XLINK_NS = 'http://www.w3.org/1999/xlink';
    const BOOLEAN_ATTRS = new Set([
        'checked',
        'disabled',
        'readonly',
        'selected',
        'multiple',
        'hidden',
    ]);
    function setAttribute(el, key, value) {
        if (BOOLEAN_ATTRS.has(key)) {
            value ? el.setAttribute(key, '') : el.removeAttribute(key);
            return;
        }
        if (key.startsWith('xlink:')) {
            el.setAttributeNS(XLINK_NS, key, value);
            return;
        }
        el.setAttribute(key, value);
    }
    function removeAttribute(el, key) {
        if (key.startsWith('xlink:')) {
            el.removeAttributeNS(XLINK_NS, key);
            return;
        }
        el.removeAttribute(key);
    }
    const CREATE_ELEMENT = document.createElement.bind(document);
    const CREATE_FRAGMENT = document.createDocumentFragment.bind(document);
    const CREATE_COMMENT = document.createComment.bind(document);
    function createNode(tag) {
        if (tag === 'fragment')
            return CREATE_FRAGMENT();
        if (tag === 'comment' || tag === 'null')
            return CREATE_COMMENT('');
        if (isSVG(tag))
            return createElementNS(getTagNamespace(tag), tag);
        return CREATE_ELEMENT(tag);
    }
    // https://en.wikipedia.org/wiki/Longest_increasing_subsequence
    function getSequence(arr) {
        const p = arr.slice();
        const result = [0];
        let i, j, u, v, c;
        const len = arr.length;
        for (i = 0; i < len; i++) {
            const arrI = arr[i];
            if (arrI !== 0) {
                j = result[result.length - 1];
                if (arr[j] < arrI) {
                    p[i] = j;
                    result.push(i);
                    continue;
                }
                u = 0;
                v = result.length - 1;
                while (u < v) {
                    c = ((u + v) / 2) | 0;
                    if (arr[result[c]] < arrI) {
                        u = c + 1;
                    }
                    else {
                        v = c;
                    }
                }
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1];
                    }
                    result[u] = i;
                }
            }
        }
        u = result.length;
        v = result[u - 1];
        while (u-- > 0) {
            result[u] = v;
            v = p[v];
        }
        return result;
    }
    // Create el for the child elements of the element marked with $memo
    function memoCreateEl(oNode, nNode) {
        const oldChildren = oNode.children;
        const newChildren = nNode.children;
        const childrenArrType = Array.isArray(newChildren);
        if (childrenArrType) {
            for (let index = 0; index < newChildren.length; index++) {
                const newChild = newChildren[index];
                const oldChild = oldChildren[index];
                if (isVnode(newChild)) {
                    newChild.el = oldChild.el;
                    memoCreateEl(oldChild, newChild);
                }
            }
        }
        else if (isObject(newChildren)) {
            newChildren.el = oldChildren.el;
        }
    }
    // version
    const version = '1.7.5';
    // Flag
    const isFlag = /* @__PURE__ */ makeMap('$ref,$once,$memo');
    // Component
    let componentMap = new WeakMap();
    // DomInfo
    const domInfo = new WeakMap();
    // Memo
    let memoMap = new WeakMap();
    // Update text node
    function updateTextNode(val, el) {
        el.textContent = val;
    }
    // Convert virtual dom to real dom
    function mount(vnode, container, anchor) {
        const { tag, props, children } = vnode;
        if (isUndef(tag))
            return;
        // tag
        if (typeof tag === 'string') {
            const el = createNode(tag);
            vnode.el = el;
            // props
            if (!isUndef(props)) {
                const keys = Object.keys(props);
                for (let index = 0; index < keys.length; index++) {
                    const key = keys[index];
                    const propValue = props[key];
                    const propTypeObj = isObject(propValue);
                    if (key.startsWith('on')) {
                        addEventListener(el, key, propValue);
                    }
                    if (typeof propValue !== 'function' && key !== 'key' && !isFlag(key)) {
                        setAttribute(el, key, propValue);
                    }
                    if (key === 'style' && propTypeObj) {
                        setStyleProp(el, propValue);
                    }
                    // domInfo
                    if (key === '$ref' && propTypeObj) {
                        domInfo.set(propValue, el);
                    }
                }
            }
            // children
            if (!isUndef(children)) {
                if (isTextChildren(children)) {
                    if (el) {
                        updateTextNode(children, el);
                    }
                }
                else {
                    const childrenObjType = isObject(children);
                    if (Array.isArray(children)) {
                        for (let index = 0; index < children.length; index++) {
                            const child = children[index];
                            if (isVnode(child)) {
                                mount(child, el);
                            }
                        }
                    }
                    else if (childrenObjType) {
                        mount(children, el);
                    }
                }
            }
            if (anchor) {
                container.insertBefore(el, anchor);
            }
            else if (container) {
                container.appendChild(el);
            }
            else {
                return el;
            }
        }
        else if (typeof tag === 'function') {
            const param = {
                content: tag,
                props,
                memo: memo.bind(tag),
            };
            const template = tag.call(tag, param);
            const newTree = effectFn(template, tag);
            componentMap.set(tag, newTree);
            mount(newTree, container);
        }
    }
    // Diff
    function patch(oNode, nNode, memoFlag) {
        const oldProps = oNode.props || {};
        // $once
        if (hasOwn(oldProps, '$once')) {
            return;
        }
        if (!notTagComponent(oNode, nNode)) {
            return;
        }
        if (!checkSameVnode(oNode, nNode)) {
            const parent = oNode.el.parentNode;
            const anchor = oNode.el.nextSibling;
            parent.removeChild(oNode.el);
            mount(nNode, parent, anchor);
        }
        else {
            const el = (nNode.el = oNode.el);
            // props
            const oldProps = oNode.props || {};
            const newProps = nNode.props || {};
            const allKeys = {};
            const newKeys = Object.keys(newProps);
            const oldKeys = Object.keys(oldProps);
            const newKeySet = new Set(newKeys);
            for (let i = 0; i < newKeys.length; i++) {
                allKeys[newKeys[i]] = true;
            }
            for (let i = 0; i < oldKeys.length; i++) {
                allKeys[oldKeys[i]] = true;
            }
            const keys = Object.keys(allKeys);
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                const newValue = newProps[key];
                const oldValue = oldProps[key];
                if (newValue === oldValue)
                    continue;
                if (isUndef(newValue)) {
                    removeAttribute(el, key);
                    continue;
                }
                const newObjType = isObject(newValue);
                const isFunc = typeof newValue === 'function';
                const isStyle = key === 'style';
                if (isFunc) {
                    if (newValue.toString() !== oldValue.toString()) {
                        removeEventListener(el, key, oldValue);
                        addEventListener(el, key, newValue);
                    }
                    continue;
                }
                if (isStyle && newObjType) {
                    setStyleProp(el, newValue);
                    continue;
                }
                const isRegularAttr = key !== 'key' && !isFlag(key);
                if (isRegularAttr && !isFunc) {
                    setAttribute(el, key, newValue);
                }
            }
            for (let index = 0; index < oldKeys.length; index++) {
                const key = oldKeys[index];
                if (!newKeySet.has(key)) {
                    removeAttribute(el, key);
                }
            }
            // $memo
            if (hasOwn(oldProps, '$memo')) {
                const memo = oldProps.$memo;
                if (memoFlag === memo[1] && !memo[0]) {
                    memo[2] && memoCreateEl(oNode, nNode);
                    return;
                }
            }
            // children
            const oc = oNode.children;
            const nc = nNode.children;
            if (Array.isArray(oc) && Array.isArray(nc)) {
                patchKeyChildren(oc, nc, el, memoFlag);
            }
            else if (isVnode(oc) && isVnode(nc)) {
                patch(oc, nc, memoFlag);
            }
            else if (isTextChildren(oc) && isTextChildren(nc) && oc !== nc) {
                updateTextNode(nc, el);
            }
        }
    }
    // can be all-keyed or mixed
    function patchKeyChildren(n1, n2, parentElm, memoFlag) {
        const l2 = n2.length;
        let i = 0;
        let e1 = n1.length - 1;
        let e2 = l2 - 1;
        while (i <= e1 && i <= e2) {
            if (checkSameVnode(n1[i], n2[i])) {
                patch(n1[i], n2[i], memoFlag);
            }
            else {
                break;
            }
            i++;
        }
        while (i <= e1 && i <= e2) {
            if (checkSameVnode(n1[e1], n2[e2])) {
                patch(n1[e1], n2[e2], memoFlag);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        if (i > e1) {
            if (i <= e2) {
                const nextPos = e2 + 1;
                const anchor = nextPos < l2 ? n2[nextPos].el : null;
                while (i <= e2) {
                    parentElm.insertBefore(mount(n2[i]), anchor);
                    i++;
                }
            }
        }
        else if (i > e2) {
            while (i <= e1) {
                parentElm.removeChild(n1[i].el);
                i++;
            }
        }
        else {
            const s1 = i;
            const s2 = i;
            const keyToNewIndexMap = new Map();
            for (i = s2; i <= e2; i++) {
                const nextChild = n2[i];
                if (nextChild.key != null) {
                    keyToNewIndexMap.set(nextChild.key, i);
                }
            }
            let j;
            let patched = 0;
            const toBePatched = e2 - s2 + 1;
            let moved = false;
            let maxIndexSoFar = 0;
            const newIndexToOldIndexMap = new Array(toBePatched);
            for (i = 0; i < toBePatched; i++)
                newIndexToOldIndexMap[i] = 0;
            for (let i = s1; i <= e1; i++) {
                if (patched >= toBePatched) {
                    parentElm.removeChild(n1[i].el);
                    continue;
                }
                let newIndex;
                if (n1[i].key !== null) {
                    newIndex = keyToNewIndexMap.get(n1[i].key);
                }
                else {
                    for (j = s2; j <= e2; j++) {
                        if (newIndexToOldIndexMap[j - s2] === 0 && checkSameVnode(n1[i], n2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                if (newIndex === undefined) {
                    parentElm.removeChild(n1[i].el);
                }
                else {
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    if (newIndex > maxIndexSoFar) {
                        maxIndexSoFar = newIndex;
                    }
                    else {
                        moved = true;
                    }
                    patch(n1[i], n2[newIndex], memoFlag);
                    patched++;
                }
            }
            const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : [];
            j = increasingNewIndexSequence.length - 1;
            for (let i = toBePatched - 1; i >= 0; i--) {
                const nextIndex = i + s2;
                const anchor = nextIndex + 1 < l2 ? n2[nextIndex + 1].el : null;
                if (newIndexToOldIndexMap[i] === 0) {
                    parentElm.insertBefore(mount(n2[nextIndex]), anchor);
                }
                else if (moved) {
                    if (j < 0 || i !== increasingNewIndexSequence[j]) {
                        parentElm.insertBefore(n2[nextIndex].el, anchor);
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    }
    // Change data
    function setData(target, newTree, memoFlag) {
        try {
            const oldTree = componentMap.get(target);
            patch(oldTree, newTree, memoFlag);
            componentMap.set(target, newTree);
        }
        catch (err) {
            warn(err);
        }
    }
    // Memo
    function memo(fn, name) {
        memoMap.set(this, name);
        if (typeof fn === 'function') {
            fn();
        }
    }
    // Effect
    function effectFn(template, target) {
        let initMode = true;
        effect(() => {
            target.template = template;
            const newTree = template();
            if (initMode) {
                initMode = null;
            }
            else {
                const memoFlag = memoMap.get(target);
                setData(target, newTree, memoFlag);
                if (memoMap.has(target)) {
                    memoMap = new WeakMap();
                }
            }
        });
        return template();
    }
    // Normalize Container
    function normalizeContainer(container) {
        if (typeof container === 'string') {
            const res = document.querySelector(container);
            if (!res) {
                let elem = null;
                if (container.startsWith('#')) {
                    elem = document.createElement('div');
                    elem.setAttribute('id', container.substring(1, container.length));
                }
                else if (container.startsWith('.')) {
                    elem = document.createElement('div');
                    elem.setAttribute('class', container.substring(1, container.length));
                }
                else {
                    warn(`Failed to mount app: mount target selector "${container}" returned null.`);
                }
                document.body.insertAdjacentElement('afterbegin', elem);
                return elem;
            }
            return res;
        }
        else if (container instanceof HTMLElement) {
            return container;
        }
        else if (window.ShadowRoot &&
            container instanceof window.ShadowRoot &&
            container.mode === 'closed') {
            warn('mounting on a ShadowRoot with `{mode: "closed"}` may lead to unpredictable bugs.');
            return null;
        }
        else {
            return null;
        }
    }
    let _el = Object.create(null);
    // Create Mettle application
    function createApp(root, container) {
        const rootContent = root.tag;
        const param = {
            content: rootContent,
            props: root.props,
            memo: memo.bind(rootContent),
        };
        const template = rootContent.call(rootContent, param);
        const newTree = effectFn(template, rootContent);
        const mountNodeEl = normalizeContainer(container);
        mount(newTree, mountNodeEl);
        componentMap.set(rootContent, newTree);
        _el = mountNodeEl;
        bindMounted();
    }
    // onMounted
    let mountHook = [];
    let unMountedHookCount = 0;
    let oldunMountedHookCount = 0;
    function onMounted(fn = null) {
        if (fn === null)
            return;
        if (typeof fn !== 'function') {
            warn('The parameter of onMounted is not a function!');
            return;
        }
        mountHook.push(fn);
    }
    function bindMounted() {
        if (mountHook.length > 0) {
            for (let i = 0, j = mountHook.length; i < j; i++) {
                mountHook[i] && mountHook[i]();
            }
        }
        oldunMountedHookCount = unMountedHookCount;
        unMountedHookCount = 0;
        mountHook = [];
    }
    // onUnmounted
    let unMountedHook = [];
    function onUnmounted(fn = null) {
        if (fn === null)
            return;
        if (typeof fn !== 'function') {
            warn('The parameter of onUnmounted is not a function!');
            return;
        }
        unMountedHookCount += 1;
        unMountedHook.push(fn);
    }
    function bindUnmounted() {
        if (unMountedHook.length > 0) {
            for (let i = 0; i < oldunMountedHookCount; i++) {
                unMountedHook[i] && unMountedHook[i]();
            }
            unMountedHook.splice(0, oldunMountedHookCount);
        }
        oldunMountedHookCount = unMountedHookCount;
    }
    // Reset view
    function resetView(view, routerContainer) {
        bindUnmounted();
        const routerContainerEl = routerContainer ? normalizeContainer(routerContainer) : _el;
        routerContainerEl.innerHTML = '';
        const param = { content: view, memo: memo.bind(view) };
        const template = view.call(view, param);
        const newTree = effectFn(template, view);
        mount(newTree, routerContainerEl);
        componentMap.set(view, newTree);
        bindMounted();
    }

    var NOTHING = Symbol.for('immer-nothing');
    var DRAFTABLE = Symbol.for('immer-draftable');
    var DRAFT_STATE = Symbol.for('immer-state');
    function die(error, ...args) {
        throw new Error(`Error`);
    }
    var getPrototypeOf = Object.getPrototypeOf;
    function isDraft(value) {
        return !!value && !!value[DRAFT_STATE];
    }
    function isDraftable(value) {
        if (!value)
            return false;
        return (isPlainObject(value) ||
            Array.isArray(value) ||
            !!value[DRAFTABLE] ||
            !!value.constructor?.[DRAFTABLE] ||
            isMap(value) ||
            isSet(value));
    }
    var objectCtorString = Object.prototype.constructor.toString();
    function isPlainObject(value) {
        if (!value || typeof value !== 'object')
            return false;
        const proto = getPrototypeOf(value);
        if (proto === null) {
            return true;
        }
        const Ctor = Object.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
        if (Ctor === Object)
            return true;
        return typeof Ctor == 'function' && Function.toString.call(Ctor) === objectCtorString;
    }
    function each(obj, iter) {
        if (getArchtype(obj) === 0 /* Object */) {
            Reflect.ownKeys(obj).forEach((key) => {
                iter(key, obj[key], obj);
            });
        }
        else {
            obj.forEach((entry, index) => iter(index, entry, obj));
        }
    }
    function getArchtype(thing) {
        const state = thing[DRAFT_STATE];
        return state
            ? state.type_
            : Array.isArray(thing)
                ? 1 /* Array */
                : isMap(thing)
                    ? 2 /* Map */
                    : isSet(thing)
                        ? 3 /* Set */
                        : 0 /* Object */;
    }
    function has(thing, prop) {
        return getArchtype(thing) === 2 /* Map */
            ? thing.has(prop)
            : Object.prototype.hasOwnProperty.call(thing, prop);
    }
    function set(thing, propOrOldValue, value) {
        const t = getArchtype(thing);
        if (t === 2 /* Map */)
            thing.set(propOrOldValue, value);
        else if (t === 3 /* Set */) {
            thing.add(value);
        }
        else
            thing[propOrOldValue] = value;
    }
    function is(x, y) {
        if (x === y) {
            return x !== 0 || 1 / x === 1 / y;
        }
        else {
            return x !== x && y !== y;
        }
    }
    function isMap(target) {
        return target instanceof Map;
    }
    function isSet(target) {
        return target instanceof Set;
    }
    function latest(state) {
        return state.copy_ || state.base_;
    }
    function shallowCopy(base, strict) {
        if (isMap(base)) {
            return new Map(base);
        }
        if (isSet(base)) {
            return new Set(base);
        }
        if (Array.isArray(base))
            return Array.prototype.slice.call(base);
        const isPlain = isPlainObject(base);
        if (strict === true || (strict === 'class_only' && !isPlain)) {
            const descriptors = Object.getOwnPropertyDescriptors(base);
            delete descriptors[DRAFT_STATE];
            let keys = Reflect.ownKeys(descriptors);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const desc = descriptors[key];
                if (desc.writable === false) {
                    desc.writable = true;
                    desc.configurable = true;
                }
                if (desc.get || desc.set)
                    descriptors[key] = {
                        configurable: true,
                        writable: true,
                        enumerable: desc.enumerable,
                        value: base[key],
                    };
            }
            return Object.create(getPrototypeOf(base), descriptors);
        }
        else {
            const proto = getPrototypeOf(base);
            if (proto !== null && isPlain) {
                return { ...base };
            }
            const obj = Object.create(proto);
            return Object.assign(obj, base);
        }
    }
    function freeze(obj, deep = false) {
        if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj))
            return obj;
        if (getArchtype(obj) > 1) {
            obj.set = obj.add = obj.clear = obj.delete = dontMutateFrozenCollections;
        }
        Object.freeze(obj);
        if (deep)
            Object.entries(obj).forEach(([key, value]) => freeze(value, true));
        return obj;
    }
    function dontMutateFrozenCollections() {
        die();
    }
    function isFrozen(obj) {
        return Object.isFrozen(obj);
    }
    var plugins = {};
    function getPlugin(pluginKey) {
        const plugin = plugins[pluginKey];
        if (!plugin) {
            die(0, pluginKey);
        }
        return plugin;
    }
    var currentScope;
    function getCurrentScope() {
        return currentScope;
    }
    function createScope(parent_, immer_) {
        return {
            drafts_: [],
            parent_,
            immer_,
            canAutoFreeze_: true,
            unfinalizedDrafts_: 0,
        };
    }
    function usePatchesInScope(scope, patchListener) {
        if (patchListener) {
            getPlugin('Patches');
            scope.patches_ = [];
            scope.inversePatches_ = [];
            scope.patchListener_ = patchListener;
        }
    }
    function revokeScope(scope) {
        leaveScope(scope);
        scope.drafts_.forEach(revokeDraft);
        scope.drafts_ = null;
    }
    function leaveScope(scope) {
        if (scope === currentScope) {
            currentScope = scope.parent_;
        }
    }
    function enterScope(immer2) {
        return (currentScope = createScope(currentScope, immer2));
    }
    function revokeDraft(draft) {
        const state = draft[DRAFT_STATE];
        if (state.type_ === 0 /* Object */ || state.type_ === 1 /* Array */)
            state.revoke_();
        else
            state.revoked_ = true;
    }
    function processResult(result, scope) {
        scope.unfinalizedDrafts_ = scope.drafts_.length;
        const baseDraft = scope.drafts_[0];
        const isReplaced = result !== void 0 && result !== baseDraft;
        if (isReplaced) {
            if (baseDraft[DRAFT_STATE].modified_) {
                revokeScope(scope);
                die();
            }
            if (isDraftable(result)) {
                result = finalize(scope, result);
                if (!scope.parent_)
                    maybeFreeze(scope, result);
            }
            if (scope.patches_) {
                getPlugin('Patches').generateReplacementPatches_(baseDraft[DRAFT_STATE].base_, result, scope.patches_, scope.inversePatches_);
            }
        }
        else {
            result = finalize(scope, baseDraft, []);
        }
        revokeScope(scope);
        if (scope.patches_) {
            scope.patchListener_(scope.patches_, scope.inversePatches_);
        }
        return result !== NOTHING ? result : void 0;
    }
    function finalize(rootScope, value, path) {
        if (isFrozen(value))
            return value;
        const state = value[DRAFT_STATE];
        if (!state) {
            each(value, (key, childValue) => finalizeProperty(rootScope, state, value, key, childValue, path));
            return value;
        }
        if (state.scope_ !== rootScope)
            return value;
        if (!state.modified_) {
            maybeFreeze(rootScope, state.base_, true);
            return state.base_;
        }
        if (!state.finalized_) {
            state.finalized_ = true;
            state.scope_.unfinalizedDrafts_--;
            const result = state.copy_;
            let resultEach = result;
            let isSet2 = false;
            if (state.type_ === 3 /* Set */) {
                resultEach = new Set(result);
                result.clear();
                isSet2 = true;
            }
            each(resultEach, (key, childValue) => finalizeProperty(rootScope, state, result, key, childValue, path, isSet2));
            maybeFreeze(rootScope, result, false);
            if (path && rootScope.patches_) {
                getPlugin('Patches').generatePatches_(state, path, rootScope.patches_, rootScope.inversePatches_);
            }
        }
        return state.copy_;
    }
    function finalizeProperty(rootScope, parentState, targetObject, prop, childValue, rootPath, targetIsSet) {
        if (isDraft(childValue)) {
            const path = rootPath &&
                parentState &&
                parentState.type_ !== 3 /* Set */ && // Set objects are atomic since they have no keys.
                !has(parentState.assigned_, prop)
                ? rootPath.concat(prop)
                : void 0;
            const res = finalize(rootScope, childValue, path);
            set(targetObject, prop, res);
            if (isDraft(res)) {
                rootScope.canAutoFreeze_ = false;
            }
            else
                return;
        }
        else if (targetIsSet) {
            targetObject.add(childValue);
        }
        if (isDraftable(childValue) && !isFrozen(childValue)) {
            if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
                return;
            }
            finalize(rootScope, childValue);
            if ((!parentState || !parentState.scope_.parent_) &&
                typeof prop !== 'symbol' &&
                Object.prototype.propertyIsEnumerable.call(targetObject, prop))
                maybeFreeze(rootScope, childValue);
        }
    }
    function maybeFreeze(scope, value, deep = false) {
        if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
            freeze(value, deep);
        }
    }
    function createProxyProxy(base, parent) {
        const isArray = Array.isArray(base);
        const state = {
            type_: isArray ? 1 /* Array */ : 0 /* Object */,
            scope_: parent ? parent.scope_ : getCurrentScope(),
            modified_: false,
            finalized_: false,
            assigned_: {},
            parent_: parent,
            base_: base,
            draft_: null,
            copy_: null,
            revoke_: null,
            isManual_: false,
        };
        let target = state;
        let traps = objectTraps;
        if (isArray) {
            target = [state];
            traps = arrayTraps;
        }
        const { revoke, proxy } = Proxy.revocable(target, traps);
        state.draft_ = proxy;
        state.revoke_ = revoke;
        return proxy;
    }
    var objectTraps = {
        get(state, prop) {
            if (prop === DRAFT_STATE)
                return state;
            const source = latest(state);
            if (!has(source, prop)) {
                return readPropFromProto(state, source, prop);
            }
            const value = source[prop];
            if (state.finalized_ || !isDraftable(value)) {
                return value;
            }
            if (value === peek(state.base_, prop)) {
                prepareCopy(state);
                return (state.copy_[prop] = createProxy(value, state));
            }
            return value;
        },
        has(state, prop) {
            return prop in latest(state);
        },
        ownKeys(state) {
            return Reflect.ownKeys(latest(state));
        },
        set(state, prop, value) {
            const desc = getDescriptorFromProto(latest(state), prop);
            if (desc?.set) {
                desc.set.call(state.draft_, value);
                return true;
            }
            if (!state.modified_) {
                const current2 = peek(latest(state), prop);
                const currentState = current2?.[DRAFT_STATE];
                if (currentState && currentState.base_ === value) {
                    state.copy_[prop] = value;
                    state.assigned_[prop] = false;
                    return true;
                }
                if (is(value, current2) && (value !== void 0 || has(state.base_, prop)))
                    return true;
                prepareCopy(state);
                markChanged(state);
            }
            if ((state.copy_[prop] === value && // special case: handle new props with value 'undefined'
                (value !== void 0 || prop in state.copy_)) || // special case: NaN
                (Number.isNaN(value) && Number.isNaN(state.copy_[prop])))
                return true;
            state.copy_[prop] = value;
            state.assigned_[prop] = true;
            return true;
        },
        deleteProperty(state, prop) {
            if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
                state.assigned_[prop] = false;
                prepareCopy(state);
                markChanged(state);
            }
            else {
                delete state.assigned_[prop];
            }
            if (state.copy_) {
                delete state.copy_[prop];
            }
            return true;
        },
        getOwnPropertyDescriptor(state, prop) {
            const owner = latest(state);
            const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
            if (!desc)
                return desc;
            return {
                writable: true,
                configurable: state.type_ !== 1 /* Array */ || prop !== 'length',
                enumerable: desc.enumerable,
                value: owner[prop],
            };
        },
        defineProperty() {
            die();
        },
        getPrototypeOf(state) {
            return getPrototypeOf(state.base_);
        },
        setPrototypeOf() {
            die();
        },
    };
    var arrayTraps = {};
    each(objectTraps, (key, fn) => {
        arrayTraps[key] = function () {
            arguments[0] = arguments[0][0];
            return fn.apply(this, arguments);
        };
    });
    arrayTraps.deleteProperty = function (state, prop) {
        return arrayTraps.set.call(this, state, prop, void 0);
    };
    arrayTraps.set = function (state, prop, value) {
        // @ts-ignore
        return objectTraps.set.call(this, state[0], prop, value, state[0]);
    };
    function peek(draft, prop) {
        const state = draft[DRAFT_STATE];
        const source = state ? latest(state) : draft;
        return source[prop];
    }
    function readPropFromProto(state, source, prop) {
        const desc = getDescriptorFromProto(source, prop);
        return desc ? (`value` in desc ? desc.value : desc.get?.call(state.draft_)) : void 0;
    }
    function getDescriptorFromProto(source, prop) {
        if (!(prop in source))
            return void 0;
        let proto = getPrototypeOf(source);
        while (proto) {
            const desc = Object.getOwnPropertyDescriptor(proto, prop);
            if (desc)
                return desc;
            proto = getPrototypeOf(proto);
        }
        return void 0;
    }
    function markChanged(state) {
        if (!state.modified_) {
            state.modified_ = true;
            if (state.parent_) {
                markChanged(state.parent_);
            }
        }
    }
    function prepareCopy(state) {
        if (!state.copy_) {
            state.copy_ = shallowCopy(state.base_, state.scope_.immer_.useStrictShallowCopy_);
        }
    }
    var Immer2 = class {
        autoFreeze_;
        useStrictShallowCopy_;
        produce;
        produceWithPatches;
        constructor(config) {
            this.autoFreeze_ = true;
            this.useStrictShallowCopy_ = false;
            this.produce = (base, recipe, patchListener) => {
                if (typeof base === 'function' && typeof recipe !== 'function') {
                    const defaultBase = recipe;
                    recipe = base;
                    const self = this;
                    return function curriedProduce(base2 = defaultBase, ...args) {
                        return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
                    };
                }
                if (typeof recipe !== 'function')
                    die();
                if (patchListener !== void 0 && typeof patchListener !== 'function')
                    die();
                let result;
                if (isDraftable(base)) {
                    const scope = enterScope(this);
                    const proxy = createProxy(base, void 0);
                    let hasError = true;
                    try {
                        result = recipe(proxy);
                        hasError = false;
                    }
                    finally {
                        if (hasError)
                            revokeScope(scope);
                        else
                            leaveScope(scope);
                    }
                    usePatchesInScope(scope, patchListener);
                    return processResult(result, scope);
                }
                else if (!base || typeof base !== 'object') {
                    result = recipe(base);
                    if (result === void 0)
                        result = base;
                    if (result === NOTHING)
                        result = void 0;
                    if (this.autoFreeze_)
                        freeze(result, true);
                    if (patchListener) {
                        const p = [];
                        const ip = [];
                        getPlugin('Patches').generateReplacementPatches_(base, result, p, ip);
                        patchListener(p, ip);
                    }
                    return result;
                }
                else
                    die(1, base);
            };
            this.produceWithPatches = (base, recipe) => {
                if (typeof base === 'function') {
                    return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
                }
                let patches, inversePatches;
                const result = this.produce(base, recipe, (p, ip) => {
                    patches = p;
                    inversePatches = ip;
                });
                return [result, patches, inversePatches];
            };
            if (typeof config?.autoFreeze === 'boolean')
                this.setAutoFreeze(config.autoFreeze);
            if (typeof config?.useStrictShallowCopy === 'boolean')
                this.setUseStrictShallowCopy(config.useStrictShallowCopy);
        }
        createDraft(base) {
            if (!isDraftable(base))
                die();
            if (isDraft(base))
                base = current(base);
            const scope = enterScope(this);
            const proxy = createProxy(base, void 0);
            proxy[DRAFT_STATE].isManual_ = true;
            leaveScope(scope);
            return proxy;
        }
        finishDraft(draft, patchListener) {
            const state = draft && draft[DRAFT_STATE];
            if (!state || !state.isManual_)
                die();
            const { scope_: scope } = state;
            usePatchesInScope(scope, patchListener);
            return processResult(void 0, scope);
        }
        setAutoFreeze(value) {
            this.autoFreeze_ = value;
        }
        setUseStrictShallowCopy(value) {
            this.useStrictShallowCopy_ = value;
        }
        applyPatches(base, patches) {
            let i;
            for (i = patches.length - 1; i >= 0; i--) {
                const patch = patches[i];
                if (patch.path.length === 0 && patch.op === 'replace') {
                    base = patch.value;
                    break;
                }
            }
            if (i > -1) {
                patches = patches.slice(i + 1);
            }
            const applyPatchesImpl = getPlugin('Patches').applyPatches_;
            if (isDraft(base)) {
                return applyPatchesImpl(base, patches);
            }
            return this.produce(base, (draft) => applyPatchesImpl(draft, patches));
        }
    };
    function createProxy(value, parent) {
        const draft = isMap(value)
            ? getPlugin('MapSet').proxyMap_(value, parent)
            : isSet(value)
                ? getPlugin('MapSet').proxySet_(value, parent)
                : createProxyProxy(value, parent);
        const scope = parent ? parent.scope_ : getCurrentScope();
        scope.drafts_.push(draft);
        return draft;
    }
    function current(value) {
        if (!isDraft(value))
            die(10, value);
        return currentImpl(value);
    }
    function currentImpl(value) {
        if (!isDraftable(value) || isFrozen(value))
            return value;
        const state = value[DRAFT_STATE];
        let copy;
        if (state) {
            if (!state.modified_)
                return state.base_;
            state.finalized_ = true;
            copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
        }
        else {
            copy = shallowCopy(value, true);
        }
        each(copy, (key, childValue) => {
            set(copy, key, currentImpl(childValue));
        });
        if (state) {
            state.finalized_ = false;
        }
        return copy;
    }
    var immer = new Immer2();
    var produce = immer.produce;

    exports.batch = batch;
    exports.computed = computed;
    exports.createApp = createApp;
    exports.domInfo = domInfo;
    exports.effect = effect;
    exports.html = html;
    exports.onMounted = onMounted;
    exports.onUnmounted = onUnmounted;
    exports.produce = produce;
    exports.resetView = resetView;
    exports.signal = signal;
    exports.untracked = untracked;
    exports.version = version;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
