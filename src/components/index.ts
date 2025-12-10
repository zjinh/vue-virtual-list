import './virtualList.scss';
import { h, version, ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated, onUpdated, nextTick, watch, Ref, ComputedRef } from 'vue';
import keyboardControl from './keyboardControl';
import selectRegion, { binarySearch, getGroupPosition, mergeIndex } from './selectRegion';
import { sleep, randomString, debounce, ElementVisibilityDetector } from '../utils/coreUtils';

interface PosData {
  index: number;
  height: number;
  top: number;
  bottom: number;
}
interface ScrollData {
  start: number;
  end: number;
  startOffset: number;
  scrollTop: number;
  direction: string;
}

const isVue2 = version.startsWith('2');
const renderHelper = function (attrs?: { [key: string]: string | number | null }, listen?: { [key: string]: Function | Array<Function> }): any {
  if (isVue2) {
    return {
      attrs: attrs,
      on: listen,
    };
  } else {
    let obj: any = attrs;
    for (let key in listen) {
      obj[`on${key.charAt(0).toUpperCase() + key.slice(1)}`] = listen[key];
    }
    return obj;
  }
};
const propsHelper = function (props?: any) {
  if (isVue2) {
    return {
      props,
    };
  } else {
    return props;
  }
};
export default {
  name: 'virtualList',
  props: {
    //所有列表数据
    listData: {
      type: Array,
      required: true,
      default: function () {
        return [];
      },
    },
    //预估高度
    itemHeight: {
      type: Number,
      required: true,
    },
    //项目宽度
    itemWidth: {
      type: Number,
      default: function () {
        return 0;
      },
    },
    //缓冲区比例
    //废弃
    bufferScale: {
      type: Number,
      default: 1,
    },
    //选择使用的字段
    selectField: {
      type: String,
      default: function () {
        return 'isSelected';
      },
    },
    //是否计算选中
    calcGroupSelect: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    //鼠标拖选
    mouseSelect: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    //鼠标选择中
    dragging: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    //精确计算元素位置
    accuratePosition: {
      type: Boolean,
      default: function () {
        return true;
      },
    },
    //鼠标选择class
    mouseAreaClassName: {
      type: String,
      default: function () {
        return '';
      },
    },
    //方向键选择
    arrowSelect: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    //方向键选择前的判断函数
    beforeKeyDown: {
      type: Function,
      default: function () {
        return () => {
          return true;
        };
      },
    },
    //是否多选
    multipleSelect: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    scrollEndDistance: {
      type: Number,
      default: 10,
    },
    //容器高度 100%
    height: {
      type: String,
      default: '100%',
    },
    //鼠标选择前的判断函数
    beforeMouseSelect: {
      type: Function,
      default: function () {
        return () => {
          return true;
        };
      },
    },
    //鼠标拖选计算的元素
    mouseSelectSelector: {
      type: String,
      default: function () {
        return '.virtual-item';
      },
    },
    scrollLockTime: {
      type: Number,
      default: function () {
        return 100;
      },
    },
    //自动滚动距离
    autoScrollHeight: {
      type: Number,
      default: function () {
        return 0;
      },
    },
    //是否启用监听元素可见变化进行重新渲染
    listenVisible: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    keyBoardSearchField: {
      type: String,
      default: '',
    },
    //数据不满一屏时自动触发scrollDown
    autoTriggerScrollDown: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'callback', // 渲染回调事件
    'scroll', // 滚动事件
    'scrolling', // 滚动中事件
    'scrollEnd', // 滚动结束事件
    'scrollDown', // 滚动到底部事件
    'update:listData', // 更新列表数据
    'update:dragging', // 更新拖拽状态
    'select-end', // 选择结束事件
    'selection-change', // 鼠标选择变化事件
    'keyboard-selection-change', // 键盘选择变化事件
  ],
  setup(props: any, { slots, emit, expose }) {
    // refs
    const virtualList: Ref<HTMLElement | null> = ref(null);
    const phantom: Ref<HTMLElement | null> = ref(null);
    const content: Ref<HTMLElement | null> = ref(null);
    const keyboardControlRef: Ref<any> = ref(null);
    //data
    const screenHeight = ref(0);
    const start = ref(0);
    const end = ref(0);
    const column = ref(props.itemWidth <= 0 ? 1 : 0);
    const positions: Ref<PosData[]> = ref([]);
    const ready = ref(false);
    const active = ref(true);
    //缓存变量
    let scrollTopCache: number = 0;
    let lastColumn: number = 0;
    let startOffset = 0;
    let lockScroll = false;
    let oldScrollTop = 0;
    let preventAutoScroll = false;
    let lastDirection = '';
    let styleObj: HTMLElement | null = null;
    const randomClass = 'virtual_' + randomString(5).toLowerCase();
    //大小变更监听
    let resizer: ResizeObserver | null = new ResizeObserver(
      debounce(() => {
        if (!active.value || !elm.value?.offsetHeight) {
          preventAutoScroll = false;
          return;
        }
        // 如果元素不可见，不进行resize处理
        if (!isElementVisible()) {
          return;
        }
        startRender();
      }, 100)
    );
    //元素可见检测器
    const visibilityDetector = new ElementVisibilityDetector({
      onVisibilityChange: (isVisible: boolean) => {
        if (isVisible && ready.value) {
          // 从隐藏变为可见时，重新初始化
          nextTick(() => {
            startRender();
          });
        }
      },
    });

    // 检测元素是否真正可见的方法
    const isElementVisible = (): boolean => {
      if (!props.listenVisible) {
        return true;
      }
      return visibilityDetector.isElementVisible(elm.value);
    };

    // 确保项目可见，但避免不必要的滚动
    const ensureItemVisible = async (index: number) => {
      if (!elm.value || index < 0 || index >= props.listData.length) return;

      // 等待 DOM 更新
      await nextTick();

      const scrollTop = elm.value.scrollTop;
      const viewportHeight = elm.value.clientHeight;

      // 获取元素的顶部和底部位置
      let itemTop: number;
      let itemBottom: number;

      // 优先使用真实渲染的 DOM 元素位置（最准确）
      const targetItem = content.value?.querySelector(`.virtual-item[data-index="${index}"]`) as HTMLElement;

      if (targetItem) {
        // 元素已渲染，使用实际 DOM 位置
        const containerRect = elm.value.getBoundingClientRect();
        const itemRect = targetItem.getBoundingClientRect();
        itemTop = itemRect.top - containerRect.top + scrollTop;
        itemBottom = itemTop + itemRect.height;
      } else {
        // 元素未渲染，计算预估位置
        const colCount = column.value || 1;
        const rowIndex = Math.floor(index / colCount);
        itemTop = rowIndex * props.itemHeight;
        itemBottom = (rowIndex + 1) * props.itemHeight;
      }

      // 统一处理滚动逻辑
      if (itemTop < scrollTop) {
        // 元素在可视区域上方
        elm.value.scrollTo({
          top: itemTop,
          behavior: 'auto',
        });
      } else if (itemBottom > scrollTop + viewportHeight) {
        // 元素在可视区域下方
        elm.value.scrollTo({
          top: itemBottom - viewportHeight,
          behavior: 'auto',
        });
      }
      // 元素已在可视区域内，不需要滚动
    };

    // 生命周期钩子
    onMounted(async () => {
      await nextTick();
      ready.value = true;
      //初始化
      if (isElementVisible()) {
        startRender();
      }
      // 开始监听可见性变化
      startVisibilityCheck();
      resizer?.observe(elm.value);
    });

    onBeforeUnmount(() => {
      scrollTopCache = 0;
      lastColumn = 0;

      // 销毁可见性检测器
      visibilityDetector.destroy();
      resizer?.disconnect();
      resizer = null;

      if (styleObj) {
        styleObj.remove();
        styleObj = null;
      }
    });

    onActivated(() => {
      active.value = true;
      if (content.value && elm.value && isElementVisible()) {
        elm.value.scrollTop = scrollTopCache;
        let haveItem = updatePhantomStyle(true);
        if (haveItem) {
          column.value = lastColumn;
          content.value.style.transform = `translate3d(0,${startOffset}px,0)`;
        }
      }
      startVisibilityCheck();
    });

    onDeactivated(() => {
      active.value = false;
      lastColumn = column.value;
      visibilityDetector.stopObserving();
    });

    onUpdated(() => {
      if (!active.value || !isElementVisible()) {
        return;
      }
      //列表数据长度不等于缓存长度
      if (_listData.value.length !== positions.value.length) {
        initPositions();
        scrollHandler.unlock();
      }
      afterRenderUpdated();
    });

    // computed
    const elm: ComputedRef<HTMLElement> = computed(() => {
      return virtualList.value as HTMLElement;
    });

    const _listData = computed(() => {
      if (column.value === 0 || !ready.value) return [];
      return props.listData.reduce((init: any, cur: any, index: number) => {
        let item = cur;
        item._index = index;
        if (index % column.value === 0 || index === 0) {
          init.push({
            _key: `_${index === 0 ? 0 : index / column.value}_${index}`,
            _startIndex: index,
            value: [],
          });
        }
        let dataIndex = Math.max(0, init.length - 1);
        init[dataIndex].value.push(item);
        init[dataIndex]._endIndex = index;
        return init;
      }, []);
    });

    const anchorPoint = computed(() => (positions.value.length ? positions.value[start.value] : null));

    const visibleCount = computed(() => Math.ceil(screenHeight.value / props.itemHeight));

    const aboveCount = computed(() => Math.min(start.value, visibleCount.value));

    const belowCount = computed(() => Math.min(props.listData.length - end.value, visibleCount.value));

    const renderListData = computed(() => {
      let startIndex = start.value - Math.max(0, aboveCount.value);
      let endIndex = end.value + Math.max(1, belowCount.value);
      return _listData.value.slice(startIndex, endIndex);
    });

    const groupByIndex = computed(() => {
      let data: number[] = [];
      if (!props.itemWidth && props.calcGroupSelect) {
        props.listData.forEach((item: any, index: number) => {
          if (item[props.selectField]) {
            data.push(index);
          }
        });
      }
      return mergeIndex(data);
    });

    // watch
    watch(
      () => props.itemWidth,
      () => {
        lastColumn = column.value;
        startRender();
      }
    );

    if (props.autoTriggerScrollDown) {
      watch(
        () => props.listData.length,
        () => {
          checkAutoTrigger();
        }
      );
    }

    // 检测是否需要自动触发scrollDown的公共方法
    const checkAutoTrigger = () => {
      if (!props.autoTriggerScrollDown || !elm.value || !active.value || props.listData.length === 0) {
        return;
      }
      nextTick(() => {
        if (!isElementVisible()) {
          return;
        }
        const scrollHeight = getScrollHeight();
        const clientHeight = elm.value?.clientHeight || 0;
        // 数据不满足一屏可显示的数量
        if (scrollHeight <= clientHeight) {
          // 触发scrollDown事件，带上自动触发标识
          scrollHandler.down(scrollHeight, true);
        }
      });
    };

    const startVisibilityCheck = () => {
      if (!props.listenVisible || !elm.value) {
        return;
      }
      visibilityDetector.startObserving(elm.value);
    };

    const checkStyleObj = () => {
      if (!styleObj) {
        styleObj = document.createElement('style');
        styleObj.style.display = 'none';
        elm.value.appendChild(styleObj);
      }
      styleObj.innerText = `.${randomClass} .virtual-item.w{width:${props.itemWidth ? props.itemWidth + 'px' : '100%'};flex-shrink:0}`;
    };

    const startRender = () => {
      initPositions();
      getSizeInfo();
      renderCallback();
      setStartOffset();
      checkStyleObj();
      checkAutoTrigger();
    };

    const getSizeInfo = () => {
      // 如果元素不可见，不进行尺寸计算
      if (!isElementVisible() || !elm.value) {
        return;
      }

      try {
        let height = Math.max(elm.value.clientHeight, -1);
        //@ts-ignore
        screenHeight.value = height > 0 ? height : elm.value.parentNode ? elm.value.parentNode.clientHeight : 0;
        if (props.itemWidth) {
          let count = Math.floor(elm.value.offsetWidth / props.itemWidth);
          column.value = Math.max(1, count);
        } else {
          column.value = 1;
        }
      } catch (e) {
        screenHeight.value = 0;
      }
    };

    const getRenderItems = (): NodeListOf<Element> => {
      return content.value ? content.value.querySelectorAll('.virtual-item-group') : ([] as any);
    };

    //数据变更渲染后重新计算
    const afterRenderUpdated = () => {
      let data = getRenderItems();
      if (!data || !data.length) {
        updatePhantomStyle(false, '0px');
        return;
      }
      //获取真实元素大小，修改对应的尺寸缓存
      updateItemsSize(data);
      updatePhantomStyle(true);
      //更新真实偏移量
      setStartOffset(false);
    };

    const initPositions = () => {
      let positionList: PosData[] = [];
      for (let index = 0; index < _listData.value.length; index++) {
        positionList.push({
          index,
          height: props.itemHeight,
          top: index * props.itemHeight,
          bottom: (index + 1) * props.itemHeight,
        });
      }
      positions.value = positionList;
    };

    //获取列表项的当前尺寸
    const updateItemsSize = (renderItems: NodeListOf<Element>) => {
      renderItems.forEach((node: Element) => {
        const dataId = (node as HTMLElement).getAttribute('data-id');
        const index = dataId ? +dataId.replace(/^_(\d+).*/, '$1') : -1;
        const item = positions.value[index];
        if (!item) return;
        const oldHeight = item.height;
        let rect = node.getBoundingClientRect();
        let height = rect.height;
        let dValue = oldHeight - height;
        if (dValue) {
          positions.value[index].bottom = positions.value[index].bottom - dValue;
          positions.value[index].height = height;
          for (let k = index + 1; k < positions.value.length; k++) {
            positions.value[k].top = positions.value[k - 1].bottom;
            positions.value[k].bottom = positions.value[k].bottom - dValue;
          }
        }
      });
    };

    const setStartOffset = (calc = true) => {
      if (calc) {
        start.value = Math.max(binarySearch(positions.value, elm.value?.scrollTop || 0), 0);
        end.value = start.value + visibleCount.value;
      }
      let offset = 0;
      try {
        if (start.value >= 1) {
          let size = positions.value[start.value].top - (positions.value[start.value - aboveCount.value]?.top || 0);
          offset = positions.value[start.value - 1].bottom - size;
        }
      } catch (e) {
        offset = 0;
      }

      startOffset = offset;
      if (content.value) {
        content.value.style.transform = `translate3d(0,${offset}px,0)`;
      }
    };

    const getScrollHeight = () => {
      return phantom.value?.offsetHeight || 0;
    };

    const scrollEvent = (e: Event, force = false) => {
      if (!e?.target) return;

      let scrollTop = (e.target as HTMLElement).scrollTop;
      if (force || !anchorPoint.value || scrollTop > anchorPoint.value.bottom || scrollTop < anchorPoint.value.top) {
        setStartOffset();
      }
      scrollingEvent(e);
    };

    //计算当前节点的选中
    const activeGroupPosition = (item: any, index: number) => {
      let data = groupByIndex.value;
      let result = { start: false, end: false };
      if (!props.calcGroupSelect || data.length === 0 || !item[props.selectField] || props.itemWidth) {
        return result;
      }
      return getGroupPosition(data, index);
    };

    const renderCallback = () => {
      emit('callback', {
        columns: column.value,
        end: end.value,
        start: start.value,
      });
    };

    const updatePhantomStyle = (usePosition: boolean, height?: string) => {
      let numberHeight = 0;
      if (phantom.value) {
        if (usePosition) {
          let lastItem = positions.value[positions.value.length - 1];
          numberHeight = lastItem?.bottom || 0;
        } else if (height) {
          numberHeight = Number(height.replace('px', ''));
        }
        phantom.value.style.height = Math.max(numberHeight, phantom.value.parentElement?.clientHeight || 0) + 'px';
      }
      return numberHeight > 0;
    };

    //所有的滚动工具方法、事件
    const scrollTo = async (index = 0, anim = true, first = true) => {
      if (index < 0 || preventAutoScroll) return;

      await nextTick();

      let listIndex: number;
      let scrollTop = 0;
      let currentScrollHeight = getScrollHeight();

      // 滚动距离小于列表高度，不用滚了
      if (currentScrollHeight <= elm.value!.clientHeight && !first) {
        await nextTick();
        await scrollTo(index, anim, false);
        return;
      }

      if (props.itemWidth) {
        listIndex = Math.floor(Math.max(Math.abs(index / column.value), 0));
      } else {
        listIndex = Math.min(index, _listData.value.length - 1);
      }

      try {
        scrollTop = positions.value[listIndex].top;
        scrollTop = Math.floor(scrollTop);
      } catch (e) {
        scrollTop = 0;
      }

      if (scrollTop <= 0) {
        elm.value.scrollTo({
          top: 0,
          behavior: anim ? 'smooth' : 'auto',
        });
        return;
      }
      const maxScrollTop = getScrollHeight() - elm.value!.clientHeight; //到底部的scrollTop最大值
      scrollTop = Math.min(scrollTop, maxScrollTop);
      elm.value.scrollTo({
        top: scrollTop,
        behavior: anim ? 'smooth' : 'auto',
      });

      scrollEvent(
        {
          target: elm.value,
        } as unknown as Event,
        true
      );

      if (getScrollHeight() !== currentScrollHeight) {
        await scrollTo(index, anim, false);
        return;
      }

      let currentScrollTop = Math.floor(elm.value.scrollTop);
      let diff = Math.abs(currentScrollTop - scrollTop) > props.itemHeight / 2;
      await sleep(100);
      if (currentScrollTop !== scrollTop && !lockScroll) {
        if (diff) {
          await scrollTo(index, anim, false);
        }
      } else if (currentScrollTop === scrollTop) {
        scrollHandler.unlock();
      }
    };
    const scrollHandler = {
      end: debounce((event: MouseEvent, data: ScrollData) => {
        emit('scrollEnd', event, data);
      }, 100),
      down: debounce((scrollHeight: number, autoTrigger = false) => {
        if (scrollHeight === getScrollHeight()) {
          emit('scrollDown', { autoTrigger });
        }
      }, 100),
      unlock: debounce(() => {
        lockScroll = false;
        preventAutoScroll = false;
      }, props.scrollLockTime),
    };
    const scrollingEvent = (event: Event) => {
      const element: HTMLElement = event.target as HTMLElement;
      if (!active.value || !element) {
        return;
      }
      const scrollTop = element.scrollTop;
      const direction = scrollTop - oldScrollTop >= 0 ? 'down' : 'up';
      const scrollHeight = getScrollHeight();
      if (scrollTopCache !== scrollTop && active.value) {
        emit('scroll', event);
      }
      scrollTopCache = scrollTop;
      const data: ScrollData = {
        start: start.value * column.value,
        end: Math.min(end.value * column.value, props.listData.length - 1),
        startOffset: startOffset,
        scrollTop,
        direction,
      };
      emit('scrolling', event, data);

      if (oldScrollTop && lastDirection && lastDirection !== direction) {
        preventAutoScroll = true;
        scrollHandler.unlock();
      }

      oldScrollTop = scrollTop;
      lastDirection = direction;
      scrollHandler.end(event, data);

      if (scrollHeight <= element.clientHeight) return;
      if (lockScroll) return;

      if (scrollHeight - scrollTop - props.scrollEndDistance <= element.clientHeight && direction === 'down') {
        lockScroll = true;
        scrollHandler.down(scrollHeight);
        scrollHandler.unlock();
      }
    };

    // 设置键盘选择锚点的方法
    const setSelectionAnchor = (index: number, preserveDirection: boolean = false) => {
      if (keyboardControlRef.value && typeof keyboardControlRef.value.setSelectionAnchor === 'function') {
        keyboardControlRef.value.setSelectionAnchor(index, preserveDirection);
      }
    };

    // 暴露方法
    expose({
      scrollTo,
      setSelectionAnchor,
    });

    // render 函数
    return () =>
      h(
        'section',
        {
          ref: virtualList,
          class: ['virtual-list', randomClass],
          style: {
            height: props.height,
          },
          ...renderHelper(
            {
              'data-w': props.itemWidth,
              'data-h': props.itemHeight,
              tabindex: props.keyBoardSearchField || props.arrowSelect ? -1 : null,
            },
            {
              scroll: scrollEvent,
            }
          ),
        },
        [
          //撑起列表高度
          h('div', {
            ref: phantom,
            class: 'virtual-list-phantom',
          }),
          //渲染容器
          h(
            'div',
            {
              ref: content,
              class: 'virtual-list-container',
            },
            renderListData.value.map((row: any) => {
              //渲染组
              return h(
                'div',
                {
                  class: ['virtual-item-group', { flex: column.value !== 1 }],
                  ...renderHelper({
                    'data-id': row._key,
                  }),
                  key: row._key,
                },
                row.value.map((item: any) =>
                  h(
                    'div',
                    {
                      class: 'virtual-item w',
                      key: `${row._key}-${item._index}`,
                      ...renderHelper(
                        {
                          'data-index': item._index,
                        },
                        {
                          mousedown: (event: MouseEvent) => {
                            // 如果按住了 Ctrl 或 Cmd 键，保持方向记录
                            const preserveDirection = event.ctrlKey || event.metaKey;
                            setSelectionAnchor(item._index, preserveDirection);
                          },
                        }
                      ),
                    },
                    [
                      slots.default?.({
                        item: item,
                        index: item._index,
                        select: activeGroupPosition(item, item._index),
                      }),
                    ]
                  )
                )
              );
            })
          ),
          slots.after?.(),
          // 键盘控制组件
          h(keyboardControl, {
            ref: keyboardControlRef,
            ...propsHelper({
              listData: props.listData,
              selectField: props.selectField,
              keyBoardSearchField: props.keyBoardSearchField,
              arrowSelect: props.arrowSelect,
              multipleSelect: props.multipleSelect,
              beforeKeyDown: props.beforeKeyDown,
              colCount: column.value || 1,
              isElementVisible: isElementVisible,
              active: active.value,
            }),
            ...renderHelper(
              {},
              {
                'update:listData': (newData: any[]) => emit('update:listData', newData),
                'select-end': () => emit('select-end', 'keyboard'),
                ensureItemVisible: ensureItemVisible,
                focus: () => elm.value?.focus(),
                'selection-change': (changes: Array<{ index: number; selected: boolean }>) => emit('keyboard-selection-change', changes),
              }
            ),
          }),
          // 鼠标选择组件
          props.mouseSelect &&
            elm.value &&
            //@ts-ignore
            h(selectRegion, {
              ...propsHelper({
                itemHeight: props.itemHeight,
                autoScrollHeight: props.autoScrollHeight,
                getScrollHeight: getScrollHeight,
                regionArea: () => {
                  return elm.value;
                },
                regionClass: props.mouseAreaClassName,
                beforeMouseSelect: props.beforeMouseSelect,
                listData: props.listData,
                selectField: props.selectField,
                mouseSelectSelector: props.mouseSelectSelector,
                accuratePosition: props.accuratePosition,
              }),
              ...renderHelper(
                {},
                {
                  'update:listData': (newData: any[]) => emit('update:listData', newData),
                  selectEnd: () => emit('select-end', 'mouse'),
                  dragging: (state: boolean) => emit('update:dragging', state),
                  selectionChange: (changes: Array<{ index: number; selected: boolean }>) => emit('selection-change', changes),
                }
              ),
            }),
        ]
      );
  },
};
