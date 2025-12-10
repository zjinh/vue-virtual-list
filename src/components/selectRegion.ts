import { computed, ComputedRef, getCurrentInstance, h, onBeforeUnmount, onMounted, ref, Ref } from 'vue';

// 这个接口只在TypeScript类型检查中使用，不影响实际组件的props定义
interface SelectRegionProps {
  regionArea: () => any;
  regionClass?: string;
  autoScrollHeight?: number;
  autoScrollWidth?: number;
  getScrollHeight: () => number;
  beforeMouseSelect?: () => boolean;
  // 新增属性
  listData: any[];
  selectField: string;
  mouseSelectSelector: string;
  accuratePosition: boolean;
}

interface SelectData {
  start: { x: number; y: number };
  end: { x: number; y: number };
  ctrl: boolean;
}

interface SelectRegionEmits {
  (e: 'update:listData', data: any[]): void;
  (e: 'selectEnd'): void;
  (e: 'dragging', state: boolean): void;
  (e: 'selectionChange', changes: Array<{ index: number; selected: boolean }>): void;
}

export default {
  name: 'selectRegion',
  props: {
    regionArea: {
      //父级元素传进来, 用于获取父级元素的scrollTop/scrollLeft
      type: Function,
      default: null,
    },
    //鼠标选择class
    regionClass: {
      type: String,
      default: 'default',
    },
    autoScrollHeight: {
      type: Number,
      required: true,
    },
    autoScrollWidth: {
      type: Number,
      default: 30,
    },
    getScrollHeight: {
      type: Function,
      required: true,
    },
    beforeMouseSelect: {
      type: Function,
      default: () => true,
    },
    // 新增属性
    listData: {
      type: Array,
      required: true,
    },
    selectField: {
      type: String,
      default: 'isSelected',
    },
    mouseSelectSelector: {
      type: String,
      default: '.virtual-item',
    },
    accuratePosition: {
      type: Boolean,
      default: true,
    },
  },
  setup(props: SelectRegionProps, { emit }: { emit: SelectRegionEmits }) {
    const instance = getCurrentInstance();
    const mouseSelectData = ref({
      left: '0',
      top: '0',
      width: '0',
      height: '0',
    });

    const startPos = ref({
      x: 0,
      y: 0,
    });

    const showMouseSelect = ref(false);
    const dragging = ref(false);
    const areaInfo: Ref<{ height: number; width: number; top: number; left: number }> = ref({
      height: 0,
      width: 0,
      top: 0,
      left: 0,
    });
    const scrollInterval: Ref<NodeJS.Timeout | null> = ref(null);
    const el: ComputedRef<HTMLElement> = computed(() => {
      return instance!.proxy.$el as HTMLElement;
    });

    // 缓存选中状态
    const cacheSelect = new Map<number, boolean>();
    // 记录拖选过程中已经处理过的项目，避免重复切换
    const processedItems = new Set<number>();
    // 记录当前拖选会话的ID，用于区分不同的拖选会话
    let currentSessionId = 0;

    // 初始化缓存：保存拖选开始时的选中状态
    const initializeCache = () => {
      cacheSelect.clear();
      processedItems.clear();
      currentSessionId++; // 新的拖选会话
      for (let i = 0; i < props.listData.length; i++) {
        cacheSelect.set(i, props.listData[i][props.selectField] || false);
      }
    };

    // 处理鼠标框选逻辑
    const handleMouseSelectInternal = (data: SelectData) => {
      let start = data.start;
      let end = data.end;
      let ctrl = data.ctrl;
      let area_data = {
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y) - props.regionArea().scrollTop,
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };

      let selList: NodeListOf<HTMLElement> = props.regionArea().querySelectorAll(props.mouseSelectSelector + '[data-index]');
      const selectionChanges: Array<{ index: number; selected: boolean }> = [];

      for (let i = 0; i < selList.length; i++) {
        let elm = selList[i];
        let index = Number(elm.dataset.index);
        if (props.accuratePosition) {
          //@ts-ignore
          elm = elm.children[0] || elm;
        }

        let item = props.listData[index];
        if (!item) break;

        let rect = elm.getBoundingClientRect();
        let containerRect = props.regionArea().getBoundingClientRect();
        let scrollLeft = props.regionArea().scrollLeft;
        let scrollTop = props.regionArea().scrollTop;

        // 计算元素相对于容器内容的位置（统一坐标系）
        let elmLeft = rect.left - containerRect.left + scrollLeft;
        let elmTop = rect.top - containerRect.top + scrollTop;
        let elmRight = elmLeft + rect.width;
        let elmBottom = elmTop + rect.height;

        let area_l = area_data.left + area_data.width + scrollLeft;
        let area_t = area_data.top + area_data.height + scrollTop;

        let newSelectedState: boolean;
        if (elmRight > area_data.left + scrollLeft && elmBottom > area_data.top + scrollTop && elmLeft < area_l && elmTop < area_t) {
          // Inside selection area
          if (ctrl) {
            // Ctrl/Command键：基于初始状态设置最终状态
            const initialState = cacheSelect.get(index) || false;
            newSelectedState = !initialState;
          } else {
            // 普通拖选：选中
            newSelectedState = true;
          }
        } else {
          // Outside selection area
          if (!ctrl) {
            // 普通拖选：取消选中
            newSelectedState = false;
          } else {
            // Ctrl/Command键：恢复初始状态
            newSelectedState = cacheSelect.get(index) || false;
          }
        }

        // 检查状态是否发生变化
        const currentState = item[props.selectField] || false;
        if (currentState !== newSelectedState) {
          item[props.selectField] = newSelectedState;
          selectionChanges.push({ index, selected: newSelectedState });
        }
      }

      // 如果有选中状态变化，通知外部
      if (selectionChanges.length > 0) {
        emit('selectionChange', selectionChanges);
      }

      emit('update:listData', props.listData);
    };

    const clearSelection = () => {
      mouseSelectData.value = {
        left: '0',
        top: '0',
        width: '0',
        height: '0',
      };
      document.onmousemove = null;
      //@ts-ignore
      document.onmousewheel = null;
      document.onmousedown = null;
      showMouseSelect.value = false;
      if (dragging.value) {
        emit('selectEnd');
      }
      dragging.value = false;
      setTimeout(() => {
        dragging.value = false;
        emit('dragging', false);
      }, 200);
    };

    const stopAutoScroll = () => {
      if (scrollInterval.value) {
        clearInterval(scrollInterval.value);
        scrollInterval.value = null;
      }
    };

    // 记录上一次的鼠标位置，用于平滑处理
    const lastMousePos = ref({ x: 0, y: 0 });

    const handleMouseMove = (ev: MouseEvent) => {
      if (ev.buttons === 2) {
        return;
      }
      if (!dragging.value) {
        dragging.value = true;
        emit('dragging', true);
      }

      let area = props.regionArea();
      showMouseSelect.value = true;

      // 记录当前鼠标位置，用于计算滚动速度
      lastMousePos.value = {
        x: ev.clientX,
        y: ev.clientY,
      };

      let end = {
        x: ev.clientX - areaInfo.value.left + area.scrollLeft,
        y: ev.clientY - areaInfo.value.top + area.scrollTop,
      };

      // 限制选择区域不超出内容高度，防止滚动条压缩
      let scrollHeight = props.getScrollHeight();
      const numScrollHeight = typeof scrollHeight === 'string' ? parseFloat(scrollHeight) : scrollHeight;
      if (numScrollHeight > 0) {
        end.y = Math.min(end.y, numScrollHeight);
        end.y = Math.max(end.y, 0);
      }

      // 限制选择区域不超出容器宽度，防止内容左移出现空白
      let containerWidth = areaInfo.value.width;
      if (containerWidth > 0) {
        // 检查是否有横向滚动空间
        let hasHorizontalScroll = area.scrollWidth > area.clientWidth;

        if (hasHorizontalScroll) {
          // 有横向滚动时，限制在内容范围内
          end.x = Math.min(end.x, area.scrollWidth);
          end.x = Math.max(end.x, 0);
        } else {
          // 没有横向滚动时，限制在可视范围内
          end.x = Math.min(end.x, containerWidth);
          end.x = Math.max(end.x, 0);
        }
      }

      let start = startPos.value;

      mouseSelectData.value = {
        left: Math.min(start.x, end.x) + 'px',
        top: Math.min(start.y, end.y) + 'px',
        width: Math.abs(end.x - start.x) + 'px',
        height: Math.abs(end.y - start.y) + 'px',
      };

      // 处理鼠标选择逻辑
      const data = { start, end, ctrl: ev.ctrlKey || ev.metaKey || ev.shiftKey };
      handleMouseSelectInternal(data);

      if (props.autoScrollHeight) {
        checkAutoScroll(ev);
      }
    };

    // 存储当前的滚动速度，用于平滑过渡
    const currentSpeedY = ref(0);
    const currentSpeedX = ref(0);

    const startAutoScroll = (speedY: number, speedX: number, ev: MouseEvent) => {
      // 如果已经有滚动定时器，不重新创建，只更新目标速度
      // 这样可以避免速度突变导致的抖动
      if (scrollInterval.value) {
        // 只更新目标速度，实际速度会在定时器中平滑过渡
        currentSpeedY.value = speedY;
        currentSpeedX.value = speedX;
        return;
      }

      let area = props.regionArea();
      areaInfo.value = area.getBoundingClientRect();

      // 初始化当前速度为目标速度
      currentSpeedY.value = speedY;
      currentSpeedX.value = speedX;

      // 基本的边界计算
      let scrollHeight = props.getScrollHeight();
      let containerHeight = areaInfo.value.height;
      let maxScrollTop = Math.max(0, scrollHeight - containerHeight);

      // 水平滚动边界计算
      let containerWidth = areaInfo.value.width;
      let maxScrollLeft = Math.max(0, area.scrollWidth - containerWidth);

      scrollInterval.value = setInterval(() => {
        let currentScrollTop = area.scrollTop;
        let currentScrollLeft = area.scrollLeft;
        let scrollChanged = false;

        // 垂直方向滚动
        if (currentSpeedY.value < 0 && currentScrollTop > 0) {
          area.scrollTop = Math.max(0, currentScrollTop + currentSpeedY.value);
          scrollChanged = true;
        } else if (currentSpeedY.value > 0 && currentScrollTop < maxScrollTop) {
          area.scrollTop = Math.min(maxScrollTop, currentScrollTop + currentSpeedY.value);
          scrollChanged = true;
        }

        // 水平方向滚动
        if (currentSpeedX.value < 0 && currentScrollLeft > 0) {
          area.scrollLeft = Math.max(0, currentScrollLeft + currentSpeedX.value);
          scrollChanged = true;
        } else if (currentSpeedX.value > 0 && currentScrollLeft < maxScrollLeft) {
          area.scrollLeft = Math.min(maxScrollLeft, currentScrollLeft + currentSpeedX.value);
          scrollChanged = true;
        }

        if (!scrollChanged) {
          stopAutoScroll();
          return;
        }

        let end = {
          x: ev.clientX - areaInfo.value.left + area.scrollLeft,
          y: ev.clientY - areaInfo.value.top + area.scrollTop,
        };

        // 限制选择区域边界
        if (scrollHeight > 0) {
          end.y = Math.min(end.y, scrollHeight);
          end.y = Math.max(end.y, 0);
        }

        // 限制X轴选择区域，防止内容左移
        let containerWidth = areaInfo.value.width;
        if (containerWidth > 0) {
          // 检查是否有横向滚动空间
          let hasHorizontalScroll = area.scrollWidth > area.clientWidth;

          if (hasHorizontalScroll) {
            // 有横向滚动时，限制在内容范围内
            end.x = Math.min(end.x, area.scrollWidth);
            end.x = Math.max(end.x, 0);
          } else {
            // 没有横向滚动时，限制在可视范围内
            end.x = Math.min(end.x, containerWidth);
            end.x = Math.max(end.x, 0);
          }
        }

        let start = startPos.value;

        mouseSelectData.value = {
          left: Math.min(start.x, end.x) + 'px',
          top: Math.min(start.y, end.y) + 'px',
          width: Math.abs(end.x - start.x) + 'px',
          height: Math.abs(end.y - start.y) + 'px',
        };

        // 处理鼠标选择逻辑
        const data = { start, end, ctrl: ev.ctrlKey || ev.metaKey || ev.shiftKey };
        handleMouseSelectInternal(data);
      }, 16);
    };

    const checkAutoScroll = (ev: MouseEvent) => {
      let scrollMarginY = props.autoScrollHeight || 0;
      let scrollMarginX = props.autoScrollWidth || 0;
      let baseScrollSpeed = 10;
      let maxScrollSpeed = 100;

      // 使用记录的鼠标位置，而不是事件中的位置，避免微小抖动
      const mouseY = lastMousePos.value.y - areaInfo.value.top;
      const mouseX = lastMousePos.value.x - areaInfo.value.left;

      // 垂直滚动检测和速度计算
      let speedY = 0;

      // 垂直方向滚动检测
      if (mouseY < 0) {
        // 鼠标在容器上方外部，向上滚动
        const distance = Math.abs(mouseY);
        // 平滑处理速度计算，使用Math.ceil确保有最小速度
        speedY = -Math.min(maxScrollSpeed, baseScrollSpeed + Math.ceil(distance / 10) * 10);
      } else if (mouseY < scrollMarginY) {
        // 鼠标在容器内部但接近上边缘，使用基准速度
        speedY = -baseScrollSpeed;
      } else if (mouseY > areaInfo.value.height) {
        // 鼠标在容器下方外部，向下滚动
        const distance = mouseY - areaInfo.value.height;
        // 平滑处理速度计算，使用Math.ceil确保有最小速度
        speedY = Math.min(maxScrollSpeed, baseScrollSpeed + Math.ceil(distance / 10) * 10);
      } else if (mouseY > areaInfo.value.height - scrollMarginY) {
        // 鼠标在容器内部但接近下边缘，使用基准速度
        speedY = baseScrollSpeed;
      }

      // 水平方向滚动检测
      let speedX = 0;
      if (mouseX < 0) {
        // 鼠标在容器左侧外部，向左滚动
        const distance = Math.abs(mouseX);
        // 平滑处理速度计算
        speedX = -Math.min(maxScrollSpeed, baseScrollSpeed + Math.ceil(distance / 10) * 10);
      } else if (mouseX < scrollMarginX) {
        // 鼠标在容器内部但接近左边缘，使用基准速度
        speedX = -baseScrollSpeed;
      } else if (mouseX > areaInfo.value.width) {
        // 鼠标在容器右侧外部，向右滚动
        const distance = mouseX - areaInfo.value.width;
        // 平滑处理速度计算
        speedX = Math.min(maxScrollSpeed, baseScrollSpeed + Math.ceil(distance / 10) * 10);
      } else if (mouseX > areaInfo.value.width - scrollMarginX) {
        // 鼠标在容器内部但接近右边缘，使用基准速度
        speedX = baseScrollSpeed;
      }

      if (speedY !== 0 || speedX !== 0) {
        startAutoScroll(speedY, speedX, ev);
      } else {
        stopAutoScroll();
      }
    };

    const handleMouseSelect = (event: MouseEvent) => {
      if (props.beforeMouseSelect && !props.beforeMouseSelect()) return;

      // 初始化缓存：保存拖选开始时的选中状态
      initializeCache();

      let area = props.regionArea();
      areaInfo.value = area.getBoundingClientRect();
      let start = {
        x: event.clientX - areaInfo.value.left + area.scrollLeft,
        y: event.clientY - areaInfo.value.top + area.scrollTop,
      };

      // 限制起始位置不超出内容高度
      let scrollHeight = props.getScrollHeight() || 0;
      if (scrollHeight > 0) {
        start.y = Math.min(start.y, scrollHeight);
        start.y = Math.max(start.y, 0);
      }

      // 限制起始位置不超出容器宽度
      let containerWidth = areaInfo.value.width;
      if (containerWidth > 0) {
        // 检查是否有横向滚动空间
        let hasHorizontalScroll = area.scrollWidth > area.clientWidth;

        if (hasHorizontalScroll) {
          // 有横向滚动时，限制在内容范围内
          start.x = Math.min(start.x, area.scrollWidth);
          start.x = Math.max(start.x, 0);
        } else {
          // 没有横向滚动时，限制在可视范围内
          start.x = Math.min(start.x, containerWidth);
          start.x = Math.max(start.x, 0);
        }
      }

      startPos.value = start;
      mouseSelectData.value.left = start.x.toString();
      mouseSelectData.value.top = start.y.toString();

      document.onmouseup = () => {
        stopAutoScroll();
        clearSelection();
      };

      document.onmousemove = ev => {
        if (scrollInterval.value) {
          stopAutoScroll();
        }
        handleMouseMove(ev);
      };
    };

    onMounted(() => {
      if (el.value?.parentNode) {
        el.value.parentNode.addEventListener('mousedown', handleMouseSelect as EventListener);
      }
    });

    onBeforeUnmount(() => {
      if (el.value?.parentNode) {
        el.value.parentNode.removeEventListener('mousedown', handleMouseSelect as EventListener);
      }
      if (scrollInterval.value) {
        clearInterval(scrollInterval.value);
      }
    });

    return () =>
      showMouseSelect.value &&
      h('div', {
        class: ['mouse-area', props.regionClass || 'default'],
        style: mouseSelectData.value,
      });
  },
};
//*二分搜索*/
export const binarySearch = function (list: any, value: number): number {
  let start = 0;
  let end = list.length - 1;
  let tempIndex = -1;

  while (start <= end) {
    let midIndex = Math.floor((start + end) / 2);
    let midValue = list[midIndex].bottom;

    if (midValue === value) {
      return midIndex + 1;
    } else if (midValue < value) {
      start = midIndex + 1;
    } else if (midValue > value) {
      if (tempIndex === -1 || tempIndex > midIndex) {
        tempIndex = midIndex;
      }
      end = end - 1;
    }
  }
  return tempIndex;
};
//*计算选中数组起始节点*/
export const getGroupPosition = (data: number[][], index: number): { start: boolean; end: boolean } => {
  let result = { start: false, end: false };
  for (let i = 0; i < data.length; i++) {
    let group_item = data[i];
    if (group_item.includes(index)) {
      if (group_item.length === 1) {
        result = { start: true, end: true };
        break;
      }
      let flag = group_item.indexOf(index);
      result = {
        start: flag === 0,
        end: flag === group_item.length - 1,
      };
      break;
    }
  }
  return result;
};
//*计算分组相邻数据*/
export const mergeIndex = function (arr: number[]): number[][] {
  if (arr.length === 0) return [];

  let result: any = [],
    i = 0;
  const sortedList = arr.sort((a, b) => a - b);

  sortedList.forEach((item, index) => {
    if (index === 0) {
      result[0] = [item];
    } else if (item - sortedList[index - 1] === 1) {
      result[i].push(item);
    } else {
      result[++i] = [item];
    }
  });
  return result;
};
