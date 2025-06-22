declare const version: string;
declare const domInfo: WeakMap<object, any>;
declare function setData(callback: () => void, content?: any, memoFlag?: symbol): Promise<void>;
declare function onMounted(fn?: any): void;
declare function onUnmounted(fn?: any): void;
declare function resetView(content: any): void;
interface OptionsProps {
    content: any;
    setData: (data: () => void, content?: any, memoFlag?: symbol) => Promise<void>;
}
declare function defineComponent(options?: any, factory?: any): {
    template: () => any;
};
export { version, resetView, setData, defineComponent, domInfo, onMounted, onUnmounted, OptionsProps, };
