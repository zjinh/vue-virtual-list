// 解析路径，支持点和索引
export function sleep(time = 1000): Promise<void> {
  return new Promise(resolve => {
    let a = setTimeout(() => {
      resolve();
      clearTimeout(a);
    }, time);
  });
}

export function randomString(len: number): string {
  len = len || 32;
  let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'; /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
  let maxPos = $chars.length;
  let pwd = '';
  for (let i = 0; i < len; i++) {
    pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return pwd;
}

export function randomNumber(x: number, y: number): number {
  // 确保 x 小于 y
  if (x > y) {
    [x, y] = [y, x]; // 交换 x 和 y
  }
  // 生成 x 和 y 之间的随机整数
  return Math.floor(Math.random() * (y - x + 1)) + x;
}

export function cloneDeep<T extends object>(origin: T, hashMap = new WeakMap<object, T>()): T {
  // 基础类型直接返回
  if (origin === undefined || origin === null || typeof origin !== 'object') {
    return origin;
  }

  // 处理循环引用
  if (hashMap.has(origin)) {
    return hashMap.get(origin)!;
  }

  // 处理特殊对象类型
  if (origin instanceof Date) {
    return new Date(origin.getTime()) as T;
  }

  if (origin instanceof RegExp) {
    return new RegExp(origin.source, origin.flags) as T;
  }

  if (origin instanceof HTMLElement) {
    return origin.cloneNode(true) as T;
  }

  if (origin instanceof Promise) {
    return origin as T;
  }

  // 处理 Map
  if (origin instanceof Map) {
    const clonedMap = new Map();
    hashMap.set(origin, clonedMap as T);
    origin.forEach((value, key) => {
      clonedMap.set(cloneDeep(key, hashMap), cloneDeep(value, hashMap));
    });
    return clonedMap as T;
  }

  // 处理 Set
  if (origin instanceof Set) {
    const clonedSet = new Set();
    hashMap.set(origin, clonedSet as T);
    origin.forEach(value => {
      clonedSet.add(cloneDeep(value, hashMap));
    });
    return clonedSet as T;
  }

  // 处理 Array
  if (Array.isArray(origin)) {
    const clonedArr: unknown[] = [];
    hashMap.set(origin, clonedArr as T);
    for (let i = 0; i < origin.length; i++) {
      clonedArr[i] = cloneDeep(origin[i], hashMap);
    }
    return clonedArr as T;
  }

  // 创建对象（不调用构造函数）
  const prototype = Object.getPrototypeOf(origin);
  const targetClone = Object.create(prototype);

  hashMap.set(origin, targetClone);

  // 处理属性描述符
  Reflect.ownKeys(origin).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(origin, key);
    if (descriptor) {
      const clonedDescriptor = { ...descriptor };
      if ('value' in clonedDescriptor) {
        clonedDescriptor.value = cloneDeep(clonedDescriptor.value, hashMap);
      }
      Object.defineProperty(targetClone, key, clonedDescriptor);
    }
  });
  return targetClone;
}

export function set<T extends object>(src: T, path: string | string[], value: any): T {
  let newPath = Array.isArray(path) ? path : path.replace('[', '.').replace(']', '').split('.');
  newPath.forEach((key, index, array) => {
    if (index === newPath.length - 1) {
      src[key] = value;
    } else {
      if (!Object.prototype.hasOwnProperty.call(src, key)) {
        // 如果不存在这个key
        const next = array[index + 1];
        src[key] = String(Number(next)) === next ? [] : {}; // 如果数组中的next不是数字，则创建一个新对象
      }
      src = src[key];
    }
  });
  return src;
}

export function get(source: any, filePath: string, defaultValue: any = undefined) {
  // a[3].b -> a.3.b -> [a,3,b]
  // path 中也可能是数组的路径，全部转化成 . 运算符并组成数组
  const paths = filePath.replace(/\[(\d+)\]/g, '.$1').split('.');
  let result = source;
  for (const p of paths) {
    // 注意 null 与 undefined 取属性会报错，所以使用 Object 包装一下。
    result = Object(result)[p];
    if (result === void 0) {
      return defaultValue;
    }
  }
  return result;
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait = 50, immediate = false) {
  let timer: NodeJS.Timeout;
  let result: any;
  let debounced: any = function (...args: any[]) {
    if (timer) {
      clearTimeout(timer);
    }
    if (immediate) {
      let callNow = !timer;
      timer = setTimeout(() => {
        clearTimeout(timer);
      }, wait);
      if (callNow) {
        //@ts-ignore
        result = func.apply(this, args);
      }
    } else {
      timer = setTimeout(() => {
        //@ts-ignore
        func.apply(this, args);
      }, wait);
    }
    return result;
  };
  debounced.cancel = function () {
    clearTimeout(timer);
  };
  return debounced;
}

export function throttle(func: () => void, delay: number) {
  let canRun = true;
  return function (...args: any[]) {
    if (!canRun) return;
    canRun = false;
    let a = setTimeout(() => {
      //@ts-ignore
      func.apply(this, args);
      canRun = true;
      clearTimeout(a);
    }, delay);
  };
}

export function isPlainObject(obj: any): boolean {
  // 检查参数是否为对象且不为 null
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  // 检查对象的构造函数是否为 Object
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

export function isEqual(a: any, b: any, stack = new WeakMap()): boolean {
  // 基础类型比较
  if (a === b) {
    return true;
  }

  // NaN 特殊处理
  if (Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }

  // null 和 undefined 处理
  if (a == null || b == null) {
    return a === b;
  }

  // 类型不同直接返回 false
  if (typeof a !== typeof b) {
    return false;
  }

  // 基础类型已经在第一步处理了，这里只处理对象类型
  if (typeof a !== 'object') {
    return false;
  }

  // 处理循环引用
  if (stack.has(a)) {
    return stack.get(a) === b;
  }
  stack.set(a, b);

  // Date 对象比较
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // RegExp 对象比较
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  // 数组比较
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i], stack)) {
        return false;
      }
    }
    return true;
  }

  // 只有一个是数组的情况
  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  // Map 比较
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }
    for (const [key, value] of a) {
      if (!b.has(key) || !isEqual(value, b.get(key), stack)) {
        return false;
      }
    }
    return true;
  }

  // Set 比较
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return false;
    }
    for (const value of a) {
      let found = false;
      for (const bValue of b) {
        if (isEqual(value, bValue, stack)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  }

  // 构造函数类型检查
  if (a.constructor !== b.constructor) {
    return false;
  }

  // 普通对象比较
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (!isEqual(a[key], b[key], stack)) {
      return false;
    }
  }

  return true;
}

export function isInputElement(element?: HTMLElement): boolean {
  // 检查当前焦点是否在输入元素上
  const activeElement = element || document.activeElement;
  if (!activeElement) {
    return false;
  }
  const tag = activeElement.nodeName.toUpperCase();
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (activeElement as HTMLElement).hasAttribute('contenteditable');
}

export function openLink(url: string, target: string = '_blank', windowRef?: Window | null) {
  try {
    // 如果提供了预打开的窗口引用（异步场景），直接设置 URL
    if (windowRef && !windowRef.closed) {
      windowRef.location.href = url;
      return windowRef;
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = target;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    let ab = setTimeout(() => {
      document.body.removeChild(a);
      clearTimeout(ab);
    }, 100);
  } catch (e) {
    window.open(url, target, 'noopener,noreferrer');
  }
}

/**
 * 元素可见性检测器
 * 结合IntersectionObserver和DOM样式检测，提供准确的元素可见性判断
 */
export class ElementVisibilityDetector {
  private intersectionObserver: IntersectionObserver | null = null;
  private lastVisibleState = false;
  private onVisibilityChange?: (isVisible: boolean) => void;

  /**
   * 构造函数
   * @param options 配置选项
   */
  constructor(options?: { threshold?: number | number[]; onVisibilityChange?: (isVisible: boolean) => void }) {
    this.onVisibilityChange = options?.onVisibilityChange;
  }

  /**
   * 检测元素是否真正可见
   * 检查元素本身及其父元素的display、visibility样式，以及元素的实际尺寸
   * @param element 要检测的元素，如果不传则使用当前监听的元素
   * @returns 是否可见
   */
  isElementVisible(element: HTMLElement): boolean {
    const targetEl = element;
    if (!targetEl) return false;

    // 检查元素本身及其父元素是否被 v-show 或 display:none 隐藏
    let el: HTMLElement | null = targetEl;
    while (el) {
      const computedStyle = window.getComputedStyle(el);
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        return false;
      }
      el = el.parentElement;
    }
    // 检查元素是否有实际的可见尺寸
    const rect = targetEl.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && targetEl.offsetHeight > 0;
  }

  /**
   * 开始监听元素可见性变化
   * @param element 要监听的元素
   * @param options 监听选项
   */
  startObserving(
    element: HTMLElement,
    options?: {
      threshold?: number | number[];
      rootMargin?: string;
    }
  ): void {
    // 如果已经在监听，先停止
    if (this.intersectionObserver) {
      this.stopObserving();
    }
    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0;
          this.handleVisibilityChange(isIntersecting && this.isElementVisible(element));
        });
      },
      {
        threshold: options?.threshold || [0, 0.1], // 监听元素刚进入和离开
        rootMargin: options?.rootMargin,
      }
    );

    this.intersectionObserver.observe(element);

    // 初始化可见状态
    this.lastVisibleState = this.isElementVisible(element);
  }

  /**
   * 停止监听元素可见性变化
   */
  stopObserving(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    this.intersectionObserver = null;
  }

  /**
   * 处理可见性变化
   */
  private handleVisibilityChange(isVisible: boolean): void {
    if (isVisible !== this.lastVisibleState) {
      this.lastVisibleState = isVisible;
      this.onVisibilityChange?.(isVisible);
    }
  }

  /**
   * 销毁检测器，清理所有资源
   */
  destroy(): void {
    this.stopObserving();
    this.onVisibilityChange = undefined;
  }
}
