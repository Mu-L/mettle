var NOTHING = Symbol.for('immer-nothing');
var DRAFTABLE = Symbol.for('immer-draftable');
var DRAFT_STATE: any = Symbol.for('immer-state');

function die(error: any, ...args: any) {
  throw new Error(`Error`);
}

var getPrototypeOf = Object.getPrototypeOf;
function isDraft(value: any) {
  return !!value && !!value[DRAFT_STATE];
}
function isDraftable(value: any) {
  if (!value) return false;
  return (
    isPlainObject(value) ||
    Array.isArray(value) ||
    !!value[DRAFTABLE] ||
    !!value.constructor?.[DRAFTABLE] ||
    isMap(value) ||
    isSet(value)
  );
}
var objectCtorString = Object.prototype.constructor.toString();
function isPlainObject(value: any) {
  if (!value || typeof value !== 'object') return false;
  const proto = getPrototypeOf(value);
  if (proto === null) {
    return true;
  }
  const Ctor = Object.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  if (Ctor === Object) return true;
  return typeof Ctor == 'function' && Function.toString.call(Ctor) === objectCtorString;
}
function each(obj: any, iter: any) {
  if (getArchtype(obj) === 0 /* Object */) {
    Reflect.ownKeys(obj).forEach((key) => {
      iter(key, obj[key], obj);
    });
  } else {
    obj.forEach((entry: any, index: any) => iter(index, entry, obj));
  }
}
function getArchtype(thing: any) {
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
function has(thing: any, prop: any) {
  return getArchtype(thing) === 2 /* Map */
    ? thing.has(prop)
    : Object.prototype.hasOwnProperty.call(thing, prop);
}
function set(thing: any, propOrOldValue: any, value: any) {
  const t = getArchtype(thing);
  if (t === 2 /* Map */) thing.set(propOrOldValue, value);
  else if (t === 3 /* Set */) {
    thing.add(value);
  } else thing[propOrOldValue] = value;
}
function is(x: any, y: any) {
  if (x === y) {
    return x !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}
function isMap(target: any) {
  return target instanceof Map;
}
function isSet(target: any) {
  return target instanceof Set;
}
function latest(state: any) {
  return state.copy_ || state.base_;
}
function shallowCopy(base: any, strict: any) {
  if (isMap(base)) {
    return new Map(base);
  }
  if (isSet(base)) {
    return new Set(base);
  }
  if (Array.isArray(base)) return Array.prototype.slice.call(base);
  const isPlain = isPlainObject(base);
  if (strict === true || (strict === 'class_only' && !isPlain)) {
    const descriptors = Object.getOwnPropertyDescriptors(base);
    delete descriptors[DRAFT_STATE];
    let keys = Reflect.ownKeys(descriptors);
    for (let i = 0; i < keys.length; i++) {
      const key: any = keys[i];
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
  } else {
    const proto = getPrototypeOf(base);
    if (proto !== null && isPlain) {
      return { ...base };
    }
    const obj = Object.create(proto);
    return Object.assign(obj, base);
  }
}
function freeze(obj: any, deep = false) {
  if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj)) return obj;
  if (getArchtype(obj) > 1) {
    obj.set = obj.add = obj.clear = obj.delete = dontMutateFrozenCollections;
  }
  Object.freeze(obj);
  if (deep) Object.entries(obj).forEach(([key, value]) => freeze(value, true));
  return obj;
}
function dontMutateFrozenCollections() {
  die(2);
}
function isFrozen(obj: any) {
  return Object.isFrozen(obj);
}

var plugins: any = {};
function getPlugin(pluginKey: any) {
  const plugin = plugins[pluginKey];
  if (!plugin) {
    die(0, pluginKey);
  }
  return plugin;
}

var currentScope: any;
function getCurrentScope() {
  return currentScope;
}
function createScope(parent_: any, immer_: any): any {
  return {
    drafts_: [],
    parent_,
    immer_,
    canAutoFreeze_: true,
    unfinalizedDrafts_: 0,
  };
}
function usePatchesInScope(scope: any, patchListener: any) {
  if (patchListener) {
    getPlugin('Patches');
    scope.patches_ = [];
    scope.inversePatches_ = [];
    scope.patchListener_ = patchListener;
  }
}
function revokeScope(scope: any) {
  leaveScope(scope);
  scope.drafts_.forEach(revokeDraft);
  scope.drafts_ = null;
}
function leaveScope(scope: any) {
  if (scope === currentScope) {
    currentScope = scope.parent_;
  }
}
function enterScope(immer2: any) {
  return (currentScope = createScope(currentScope, immer2));
}
function revokeDraft(draft: any) {
  const state = draft[DRAFT_STATE];
  if (state.type_ === 0 /* Object */ || state.type_ === 1 /* Array */) state.revoke_();
  else state.revoked_ = true;
}

function processResult(result: any, scope: any) {
  scope.unfinalizedDrafts_ = scope.drafts_.length;
  const baseDraft = scope.drafts_[0];
  const isReplaced = result !== void 0 && result !== baseDraft;
  if (isReplaced) {
    if (baseDraft[DRAFT_STATE].modified_) {
      revokeScope(scope);
      die(4);
    }
    if (isDraftable(result)) {
      result = finalize(scope, result);
      if (!scope.parent_) maybeFreeze(scope, result);
    }
    if (scope.patches_) {
      getPlugin('Patches').generateReplacementPatches_(
        baseDraft[DRAFT_STATE].base_,
        result,
        scope.patches_,
        scope.inversePatches_
      );
    }
  } else {
    result = finalize(scope, baseDraft, []);
  }
  revokeScope(scope);
  if (scope.patches_) {
    scope.patchListener_(scope.patches_, scope.inversePatches_);
  }
  return result !== NOTHING ? result : void 0;
}
function finalize(rootScope: any, value: any, path?: any): any {
  if (isFrozen(value)) return value;
  const state = value[DRAFT_STATE];
  if (!state) {
    each(value, (key: any, childValue: any) =>
      finalizeProperty(rootScope, state, value, key, childValue, path)
    );
    return value;
  }
  if (state.scope_ !== rootScope) return value;
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
    each(resultEach, (key: any, childValue: any) =>
      finalizeProperty(rootScope, state, result, key, childValue, path, isSet2)
    );
    maybeFreeze(rootScope, result, false);
    if (path && rootScope.patches_) {
      getPlugin('Patches').generatePatches_(
        state,
        path,
        rootScope.patches_,
        rootScope.inversePatches_
      );
    }
  }
  return state.copy_;
}
function finalizeProperty(
  rootScope: any,
  parentState: any,
  targetObject: any,
  prop: any,
  childValue: any,
  rootPath: any,
  targetIsSet?: any
): any {
  if (isDraft(childValue)) {
    const path =
      rootPath &&
      parentState &&
      parentState.type_ !== 3 /* Set */ && // Set objects are atomic since they have no keys.
      !has(parentState.assigned_, prop)
        ? rootPath.concat(prop)
        : void 0;
    const res = finalize(rootScope, childValue, path);
    set(targetObject, prop, res);
    if (isDraft(res)) {
      rootScope.canAutoFreeze_ = false;
    } else return;
  } else if (targetIsSet) {
    targetObject.add(childValue);
  }
  if (isDraftable(childValue) && !isFrozen(childValue)) {
    if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
      return;
    }
    finalize(rootScope, childValue);
    if (
      (!parentState || !parentState.scope_.parent_) &&
      typeof prop !== 'symbol' &&
      Object.prototype.propertyIsEnumerable.call(targetObject, prop)
    )
      maybeFreeze(rootScope, childValue);
  }
}
function maybeFreeze(scope: any, value: any, deep = false) {
  if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
    freeze(value, deep);
  }
}

function createProxyProxy(base: any, parent: any) {
  const isArray = Array.isArray(base);
  const state: any = {
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
  let traps: any = objectTraps;
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
  get(state: any, prop: any) {
    if (prop === DRAFT_STATE) return state;
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
  has(state: any, prop: any) {
    return prop in latest(state);
  },
  ownKeys(state: any) {
    return Reflect.ownKeys(latest(state));
  },
  set(state: any, prop: any, value?: any) {
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
      if (is(value, current2) && (value !== void 0 || has(state.base_, prop))) return true;
      prepareCopy(state);
      markChanged(state);
    }
    if (
      (state.copy_[prop] === value && // special case: handle new props with value 'undefined'
        (value !== void 0 || prop in state.copy_)) || // special case: NaN
      (Number.isNaN(value) && Number.isNaN(state.copy_[prop]))
    )
      return true;
    state.copy_[prop] = value;
    state.assigned_[prop] = true;
    return true;
  },
  deleteProperty(state: any, prop: any) {
    if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
      state.assigned_[prop] = false;
      prepareCopy(state);
      markChanged(state);
    } else {
      delete state.assigned_[prop];
    }
    if (state.copy_) {
      delete state.copy_[prop];
    }
    return true;
  },
  getOwnPropertyDescriptor(state: any, prop: any) {
    const owner = latest(state);
    const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
    if (!desc) return desc;
    return {
      writable: true,
      configurable: state.type_ !== 1 /* Array */ || prop !== 'length',
      enumerable: desc.enumerable,
      value: owner[prop],
    };
  },
  defineProperty() {
    die(11);
  },
  getPrototypeOf(state: any) {
    return getPrototypeOf(state.base_);
  },
  setPrototypeOf() {
    die(12);
  },
};
var arrayTraps: any = {};
each(objectTraps, (key: any, fn: any) => {
  arrayTraps[key] = function () {
    arguments[0] = arguments[0][0];
    return fn.apply(this, arguments);
  };
});
arrayTraps.deleteProperty = function (state: any, prop: any) {
  return arrayTraps.set.call(this, state, prop, void 0);
};
arrayTraps.set = function (state: any, prop: any, value: any) {
  // @ts-ignore
  return objectTraps.set.call(this, state[0], prop, value, state[0]);
};
function peek(draft: any, prop: any) {
  const state = draft[DRAFT_STATE];
  const source = state ? latest(state) : draft;
  return source[prop];
}
function readPropFromProto(state: any, source: any, prop: any) {
  const desc = getDescriptorFromProto(source, prop);
  return desc ? (`value` in desc ? desc.value : desc.get?.call(state.draft_)) : void 0;
}
function getDescriptorFromProto(source: any, prop: any) {
  if (!(prop in source)) return void 0;
  let proto = getPrototypeOf(source);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc) return desc;
    proto = getPrototypeOf(proto);
  }
  return void 0;
}
function markChanged(state: any) {
  if (!state.modified_) {
    state.modified_ = true;
    if (state.parent_) {
      markChanged(state.parent_);
    }
  }
}
function prepareCopy(state: any) {
  if (!state.copy_) {
    state.copy_ = shallowCopy(state.base_, state.scope_.immer_.useStrictShallowCopy_);
  }
}

var Immer2: any = class {
  autoFreeze_: any;
  useStrictShallowCopy_: boolean;
  produce: (base: any, recipe: any, patchListener?: any) => any;
  produceWithPatches: (base: any, recipe: any) => any[] | ((state: any, ...args: any) => any);
  constructor(config: any) {
    this.autoFreeze_ = true;
    this.useStrictShallowCopy_ = false;
    this.produce = (base: any, recipe: any, patchListener: any): any => {
      if (typeof base === 'function' && typeof recipe !== 'function') {
        const defaultBase = recipe;
        recipe = base;
        const self = this;
        return function curriedProduce(base2 = defaultBase, ...args: any[]) {
          return self.produce(base2, (draft: any) => recipe.call(this, draft, ...args));
        };
      }
      if (typeof recipe !== 'function') die(6);
      if (patchListener !== void 0 && typeof patchListener !== 'function') die(7);
      let result;
      if (isDraftable(base)) {
        const scope = enterScope(this);
        const proxy = createProxy(base, void 0);
        let hasError = true;
        try {
          result = recipe(proxy);
          hasError = false;
        } finally {
          if (hasError) revokeScope(scope);
          else leaveScope(scope);
        }
        usePatchesInScope(scope, patchListener);
        return processResult(result, scope);
      } else if (!base || typeof base !== 'object') {
        result = recipe(base);
        if (result === void 0) result = base;
        if (result === NOTHING) result = void 0;
        if (this.autoFreeze_) freeze(result, true);
        if (patchListener) {
          const p: any = [];
          const ip: any = [];
          getPlugin('Patches').generateReplacementPatches_(base, result, p, ip);
          patchListener(p, ip);
        }
        return result;
      } else die(1, base);
    };
    this.produceWithPatches = (base: any, recipe: any) => {
      if (typeof base === 'function') {
        return (state: any, ...args: any) =>
          this.produceWithPatches(state, (draft: any) => base(draft, ...args));
      }
      let patches, inversePatches;
      const result = this.produce(base, recipe, (p: any, ip: any) => {
        patches = p;
        inversePatches = ip;
      });
      return [result, patches, inversePatches];
    };
    if (typeof config?.autoFreeze === 'boolean') this.setAutoFreeze(config.autoFreeze);
    if (typeof config?.useStrictShallowCopy === 'boolean')
      this.setUseStrictShallowCopy(config.useStrictShallowCopy);
  }
  createDraft(base: any) {
    if (!isDraftable(base)) die(8);
    if (isDraft(base)) base = current(base);
    const scope = enterScope(this);
    const proxy = createProxy(base, void 0);
    proxy[DRAFT_STATE].isManual_ = true;
    leaveScope(scope);
    return proxy;
  }
  finishDraft(draft: any, patchListener: any) {
    const state = draft && draft[DRAFT_STATE];
    if (!state || !state.isManual_) die(9);
    const { scope_: scope } = state;
    usePatchesInScope(scope, patchListener);
    return processResult(void 0, scope);
  }
  setAutoFreeze(value: any) {
    this.autoFreeze_ = value;
  }
  setUseStrictShallowCopy(value: any) {
    this.useStrictShallowCopy_ = value;
  }
  applyPatches(base: any, patches: any) {
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
    return this.produce(base, (draft: any) => applyPatchesImpl(draft, patches));
  }
};
function createProxy(value: any, parent: any) {
  const draft = isMap(value)
    ? getPlugin('MapSet').proxyMap_(value, parent)
    : isSet(value)
    ? getPlugin('MapSet').proxySet_(value, parent)
    : createProxyProxy(value, parent);
  const scope = parent ? parent.scope_ : getCurrentScope();
  scope.drafts_.push(draft);
  return draft;
}

function current(value: any) {
  if (!isDraft(value)) die(10, value);
  return currentImpl(value);
}
function currentImpl(value: any) {
  if (!isDraftable(value) || isFrozen(value)) return value;
  const state = value[DRAFT_STATE];
  let copy: any;
  if (state) {
    if (!state.modified_) return state.base_;
    state.finalized_ = true;
    copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
  } else {
    copy = shallowCopy(value, true);
  }
  each(copy, (key: any, childValue: any) => {
    set(copy, key, currentImpl(childValue));
  });
  if (state) {
    state.finalized_ = false;
  }
  return copy;
}

var immer: any = new Immer2();
var produce: any = immer.produce;

export { produce };
