import { getType, isUndef, checkSameVnode, isVnode, checkVnode, setStyleProp, setAttribute, removeAttribute, createNode, warn, getSequence, notTagComponent, addEventListener, removeEventListener, } from './utils';
// version
const version = '__VERSION__';
// Flag
const flag = ['$ref', '$is', '$once', '$memo'];
// DomInfo
const domInfo = new WeakMap();
// Component
let componentMap = new WeakMap();
// Update text node
function updateTextNode(val, el) {
    el.textContent = val;
}
// Create el for the child elements of the element marked with $memo
function memoCreateEl(oNode, nNode) {
    const oldChildren = oNode.children;
    const newChildren = nNode.children;
    const childrenType = getType(newChildren);
    if (childrenType === 'array') {
        for (let index = 0; index < newChildren.length; index++) {
            const newChild = newChildren[index];
            const oldChild = oldChildren[index];
            if (isVnode(newChild)) {
                newChild.el = oldChild.el;
                memoCreateEl(oldChild, newChild);
            }
        }
    }
    else if (childrenType === 'object') {
        newChildren.el = oldChildren.el;
    }
}
// Convert virtual dom to real dom
function mount(vnode, container, anchor) {
    const { tag, props, children } = vnode;
    // tag
    if (!isUndef(tag)) {
        const el = createNode(tag);
        vnode.el = el;
        // props
        if (!isUndef(props)) {
            const keys = Object.keys(props);
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                const propValue = props[key];
                const propValueType = getType(propValue);
                if (key.startsWith('on')) {
                    addEventListener(el, key, propValue);
                }
                if (propValueType !== 'function' && key !== 'key' && !flag.includes(key)) {
                    setAttribute(el, key, propValue);
                }
                if (key === 'style' && propValueType === 'object') {
                    setStyleProp(el, propValue);
                }
                // component
                if (key === flag[1] && propValueType === 'object') {
                    const newTree = propValue.template();
                    mount(newTree, el);
                    componentMap.set(propValue, newTree);
                }
                // domInfo
                if (key === flag[0] && propValueType === 'object') {
                    domInfo.set(propValue, el);
                }
            }
        }
        // children
        if (tag !== 'component') {
            if (!isUndef(children)) {
                if (!checkVnode(children)) {
                    if (el) {
                        updateTextNode(children, el);
                    }
                }
                else {
                    const childrenType = getType(children);
                    if (childrenType === 'array') {
                        for (let index = 0; index < children.length; index++) {
                            const child = children[index];
                            if (isVnode(child)) {
                                mount(child, el);
                            }
                        }
                    }
                    else if (childrenType === 'object') {
                        mount(children, el);
                    }
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
}
// Diff
function patch(oNode, nNode, memoFlag) {
    // $once
    if (oNode.props && oNode.props.hasOwnProperty(flag[2])) {
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
            const newType = getType(newValue);
            const isFunc = newType === 'function';
            const isStyle = key === 'style';
            if (isFunc) {
                if (newValue.toString() !== oldValue.toString()) {
                    removeEventListener(el, key, oldValue);
                    addEventListener(el, key, newValue);
                }
                continue;
            }
            if (isStyle && newType === 'object') {
                setStyleProp(el, newValue);
                continue;
            }
            const isRegularAttr = key !== 'key' && !flag.includes(key);
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
        if (oNode.props && oNode.props.hasOwnProperty(flag[3])) {
            if (!oNode.props.$memo[0] && oNode.props.$memo[1] === memoFlag) {
                memoCreateEl(oNode, nNode);
                return;
            }
        }
        // children
        const oc = oNode.children;
        const nc = nNode.children;
        if (getType(oc) === 'array' && getType(nc) === 'array') {
            patchKeyChildren(oc, nc, el, memoFlag);
        }
        else if (isVnode(oc) && isVnode(nc)) {
            patch(oc, nc, memoFlag);
        }
        else if (!checkVnode(oc) && !checkVnode(nc) && oc !== nc) {
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
async function setData(callback, content, memoFlag) {
    if (typeof callback === 'function' && typeof Promise !== 'undefined') {
        try {
            await Promise.resolve(callback());
            const target = content ? content : this;
            const newTree = target.template();
            const oldTree = componentMap.get(target);
            patch(oldTree, newTree, memoFlag);
            componentMap.set(target, newTree);
        }
        catch (err) {
            warn(err.message);
        }
    }
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
function resetView(content) {
    bindUnmounted();
    _el.innerHTML = '';
    componentMap = null;
    componentMap = new WeakMap();
    const newTree = content.template();
    mount(newTree, _el);
    componentMap.set(content, newTree);
    bindMounted();
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
// Define Component
function defineComponent(options, factory) {
    if (typeof options === 'function') {
        factory = options;
        options = Object.create(null);
    }
    class Component {
        template;
        static instance;
        constructor() {
            const param = { content: this, setData: setData.bind(this) };
            const template = factory.call(this, param);
            this.template = template;
            const newTree = template();
            if (options.mount) {
                const mountNodeEl = normalizeContainer(options.mount);
                mount(newTree, mountNodeEl);
                componentMap.set(this, newTree);
                _el = mountNodeEl;
                bindMounted();
            }
        }
        static getInstance() {
            if (!this.instance) {
                this.instance = new Component();
            }
            return this.instance;
        }
    }
    return Component.getInstance();
}
export { version, resetView, setData, defineComponent, domInfo, onMounted, onUnmounted, };
