import { effect } from './signal';
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
const version = '__VERSION__';
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
    // $once
    const op = oNode.props;
    if (op && hasOwn(op, '$once')) {
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
        if (op != null && hasOwn(op, '$memo')) {
            const memo = op.$memo;
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
let _el = Object.create(null);
// Reset view
function resetView(view) {
    bindUnmounted();
    _el.innerHTML = '';
    componentMap = new WeakMap();
    memoMap = new WeakMap();
    const param = { content: view, memo: memo.bind(view) };
    const template = view.call(view, param);
    const newTree = effectFn(template, view);
    mount(newTree, _el);
    componentMap.set(view, newTree);
    bindMounted();
}
export { version, createApp, domInfo, onMounted, onUnmounted, resetView };
