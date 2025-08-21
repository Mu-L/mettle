const BRAND_SYMBOL = Symbol.for('signals');

const RUNNING = 1 << 0;
const NOTIFIED = 1 << 1;
const OUTDATED = 1 << 2;
const DISPOSED = 1 << 3;
const HAS_ERROR = 1 << 4;
const TRACKING = 1 << 5;
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
        } catch (err) {
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
  } finally {
    endBatch();
  }
}

let evalContext = undefined;

function untracked(fn) {
  const prevContext = evalContext;
  evalContext = undefined;
  try {
    return fn();
  } finally {
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
  } else if (node._version === -1) {
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
    } else {
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
  return effect(
    () => {
      const value = this.value;
      const prevContext = evalContext;
      evalContext = undefined;
      try {
        fn(value);
      } finally {
        evalContext = prevContext;
      }
    },
    { name: 'sub' }
  );
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
  } finally {
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
      } finally {
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
    if (
      node._source._version !== node._version ||
      !node._source._refresh() ||
      node._source._version !== node._version
    ) {
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
    } else {
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
  } catch (err) {
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

function cleanupEffect(effect) {
  const cleanup = effect._cleanup;
  effect._cleanup = undefined;
  if (typeof cleanup === 'function') {
    /*@__INLINE__**/ startBatch();
    const prevContext = evalContext;
    evalContext = undefined;
    try {
      cleanup();
    } catch (err) {
      effect._flags &= ~RUNNING;
      effect._flags |= DISPOSED;
      disposeEffect(effect);
      throw err;
    } finally {
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
    if (this._flags & DISPOSED) return;
    if (this._fn === undefined) return;
    const cleanup = this._fn();
    if (typeof cleanup === 'function') {
      this._cleanup = cleanup;
    }
  } finally {
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
  } catch (err) {
    effect._dispose();
    throw err;
  }
  const dispose = effect._dispose.bind(effect);
  dispose[Symbol.dispose] = dispose;
  return dispose;
}

export { computed, effect, batch, untracked, signal };
