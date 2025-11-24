declare const version: string;
declare const domInfo: WeakMap<object, any>;
declare function createApp(root: any, container: string): void;
declare function onMounted(fn?: any): void;
declare function onUnmounted(fn?: any): void;
declare function resetView(view: any, routerContainer?: string): void;
export { version, createApp, domInfo, onMounted, onUnmounted, resetView };
