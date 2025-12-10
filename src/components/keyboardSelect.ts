/**
 * 虚拟列表键盘控制模块
 *
 * 功能特性：
 * - 支持方向键选择和导航
 * - 智能多选（Ctrl/Cmd + 点击）
 * - 高级范围选择（Shift + 方向键）
 * - 非连续选择的智能反方向操作
 *
 * 核心算法：
 * - 使用三阶段状态机处理反方向选择（取消 → 选择断开点 → 跳转锚点）
 * - 支持macOS风格的选择行为
 * - 自动优化单项目场景，跳过不必要取消阶段
 *
 * @author ZJINH
 * @version 2.0.0
 */
// 类型定义
import { mergeIndex } from './selectRegion';

type ShiftDirection = 'up' | 'down' | '';
type ReversePhase = 'cancel' | 'select' | 'jump';

interface SelectedRange {
  start: number;
  end: number;
}

interface ReverseState {
  phase: ReversePhase;
  gaps: number[];
  currentGapIndex: number;
  preservedItem?: number; // 跳过取消阶段时保留的项目索引
  direction: ShiftDirection; // 当前反方向操作的方向
}

// 常量定义
const INITIAL_INDEX = -1;
const ARROW_KEYS = {
  UP: ['ArrowUp', 'ArrowLeft'],
  DOWN: ['ArrowDown', 'ArrowRight'],
} as const;

// 辅助函数
const isUpDirection = (key: string): boolean => ARROW_KEYS.UP.includes(key as any);
const getDirection = (key: string): ShiftDirection => (isUpDirection(key) ? 'up' : 'down');

/**
 * 计算两个区间之间的空隙索引
 * @param startRange - 起始区间
 * @param endRange - 结束区间
 * @param reverse - 是否反向（从大到小）
 * @returns 空隙索引数组
 */
const calculateGapsBetweenRanges = (startRange: SelectedRange, endRange: SelectedRange, reverse: boolean = false): number[] => {
  const gaps: number[] = [];
  const start = startRange.end + 1;
  const end = endRange.start - 1;

  if (reverse) {
    for (let i = end; i >= start; i--) {
      gaps.push(i);
    }
  } else {
    for (let i = start; i <= end; i++) {
      gaps.push(i);
    }
  }

  return gaps;
};

/**
 * 计算所有区间之间的空隙
 * @param ranges - 选中的区间数组
 * @param direction - 方向（up为反向，down为正向）
 * @returns 空隙索引数组
 */
const calculateAllGaps = (ranges: SelectedRange[], direction: ShiftDirection): number[] => {
  const gaps: number[] = [];
  const isReverse = direction === 'up';

  if (isReverse) {
    // 向上：从后往前处理区间
    for (let i = ranges.length - 1; i > 0; i--) {
      const gapIndices = calculateGapsBetweenRanges(ranges[i - 1], ranges[i], true);
      gaps.push(...gapIndices);
    }
  } else {
    // 向下：从前往后处理区间
    for (let i = 0; i < ranges.length - 1; i++) {
      const gapIndices = calculateGapsBetweenRanges(ranges[i], ranges[i + 1]);
      gaps.push(...gapIndices);
    }
  }

  return gaps;
};

export class KeyboardSelect {
  protected selectField = '';
  protected ensureItemVisible = (_index: number) => {};
  // 记录Shift选择的锚点（固定点）和活动点（移动点）
  protected shiftSelectionAnchorIndex = INITIAL_INDEX;
  protected shiftSelectionActiveIndex = INITIAL_INDEX;
  // 记录最后一次Shift选择的方向
  protected lastShiftDirection = '';
  // 反方向操作的状态跟踪
  protected reverseState: ReverseState | null = null;
  // 方向键列表
  readonly arrowKeyList = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  // 记录上一次的选择状态，用于追踪变化
  protected previousSelectionState: Map<number, boolean> = new Map();

  constructor(ensureItemVisible: (index: number) => void, selectField: string) {
    this.ensureItemVisible = ensureItemVisible;
    this.selectField = selectField;
  }

  /**
   * 获取当前选择状态的快照
   * @param listData - 列表数据
   * @returns 选择状态的Map
   */
  protected captureSelectionState(listData: any[]): Map<number, boolean> {
    const state = new Map<number, boolean>();
    listData.forEach((item, index) => {
      state.set(index, !!item[this.selectField]);
    });
    return state;
  }

  /**
   * 计算选择变化
   * @param listData - 列表数据
   * @returns 变化的项目数组
   */
  protected calculateSelectionChanges(listData: any[]): Array<{ index: number; selected: boolean }> {
    const changes: Array<{ index: number; selected: boolean }> = [];
    const currentState = this.captureSelectionState(listData);

    // 比较当前状态和之前状态
    currentState.forEach((selected, index) => {
      const previousSelected = this.previousSelectionState.get(index) || false;
      if (selected !== previousSelected) {
        changes.push({ index, selected });
      }
    });

    // 更新记录的状态
    this.previousSelectionState = currentState;

    return changes;
  }
  /**
   * 设置选择锚点和活动点的辅助函数
   * @param anchorIndex - 锚点索引
   * @param activeIndex - 活动点索引（默认与锚点相同）
   */
  protected setShiftSelection = (anchorIndex: number, activeIndex: number = anchorIndex) => {
    this.shiftSelectionAnchorIndex = anchorIndex;
    this.shiftSelectionActiveIndex = activeIndex;
  };

  /**
   * 处理取消阶段的逻辑
   * @param state - 反方向状态
   * @param listData
   * @returns 是否继续处理
   */
  protected handleCancelPhase = (state: ReverseState, listData: any[]): boolean => {
    const isUp = state.direction === 'up';
    const firstGap = state.gaps.length > 0 ? state.gaps[0] : isUp ? -Infinity : Infinity;
    const selectedIndices = this.getSelectedIndices(listData);

    // 根据方向过滤需要取消的项目
    const itemsToCancel = isUp
      ? selectedIndices.filter(index => index > firstGap).reverse() // 向上：取消断开点之后的项目，从大到小
      : selectedIndices.filter(index => index < firstGap); // 向下：取消断开点之前的项目，从小到大

    // 单项目优化：跳过取消阶段
    if (itemsToCancel.length === 1) {
      state.preservedItem = itemsToCancel[0];
      state.phase = 'select';
      return false; // 不消耗这次操作，直接进入选择阶段
    } else if (itemsToCancel.length > 1) {
      const itemToCancel = itemsToCancel[0];
      listData[itemToCancel][this.selectField] = false;
      this.ensureItemVisible(itemToCancel);
      return true;
    } else {
      state.phase = 'select';
      return false; // 没有需要取消的项目，进入选择阶段
    }
  };

  /**
   * 处理选择阶段的逻辑
   * @param state - 反方向状态
   * @param listData
   * @returns 是否继续处理
   */
  protected handleSelectPhase = (state: ReverseState, listData: any[]): boolean => {
    if (state.currentGapIndex < state.gaps.length) {
      const gapToSelect = state.gaps[state.currentGapIndex];
      listData[gapToSelect][this.selectField] = true;
      this.ensureItemVisible(gapToSelect);

      state.currentGapIndex++;

      // 如果这是最后一个空隙，设置锚点并准备跳转
      if (state.currentGapIndex >= state.gaps.length) {
        if (state.preservedItem !== undefined) {
          this.setShiftSelection(state.preservedItem, gapToSelect);
        } else {
          const firstGap = state.gaps.length > 0 ? state.gaps[0] : gapToSelect;
          this.setShiftSelection(firstGap, gapToSelect);
        }
        state.phase = 'jump';
      }
      return true;
    }
    return false;
  };

  /**
   * 处理跳转阶段的逻辑
   * @param state - 反方向状态
   * @param colCount - 列数
   * @param listData
   * @returns 是否继续处理
   */
  protected handleJumpPhase = (state: ReverseState, colCount: number, listData: any[]): boolean => {
    const updatedRanges = this.getSelectedRanges(listData);
    const isUp = state.direction === 'up';

    const targetRange = isUp ? updatedRanges[0] : updatedRanges[updatedRanges.length - 1];
    const targetIndex = isUp ? targetRange.start : targetRange.end;
    const nextIndex = isUp ? Math.max(0, targetIndex - colCount) : Math.min(listData.length - 1, targetIndex + colCount);

    const canContinue = isUp ? nextIndex >= 0 && nextIndex < listData.length && nextIndex < targetIndex : nextIndex < listData.length && nextIndex > targetIndex;

    if (canContinue) {
      listData[nextIndex][this.selectField] = true;
      this.setShiftSelection(nextIndex);
      this.reverseState = null; // 清除反向状态
      this.ensureItemVisible(nextIndex);
      return true;
    } else {
      // 到达边界
      this.setShiftSelection(targetIndex);
      this.reverseState = null;
      this.ensureItemVisible(targetIndex);
      return true;
    }
  };

  // 获取所有选中项的索引
  protected getSelectedIndices = (listData: any[]): number[] => {
    const selectedIndices: number[] = [];
    for (let i = 0; i < listData.length; i++) {
      if (listData[i][this.selectField]) {
        selectedIndices.push(i);
      }
    }
    return selectedIndices;
  };

  // 获取所有选中项的连续区间
  protected getSelectedRanges = (listData: any[]): SelectedRange[] => {
    const selectedIndices = this.getSelectedIndices(listData);
    // 使用mergeIndex函数获取连续区间
    const mergedRanges = mergeIndex(selectedIndices);
    // 转换为我们需要的格式
    return mergedRanges.map(range => ({
      start: range[0],
      end: range[range.length - 1],
    }));
  };

  /**
   * 处理非连续选择的智能方向键逻辑
   *
   * 核心逻辑：
   * - 同方向：继续选择
   * - 反方向：执行三阶段操作（取消 → 选择断开点 → 跳转锚点）
   *
   * @param key - 按键名称
   * @param colCount - 列数（用于计算移动距离）
   * @param listData
   * @returns 是否处理了该操作
   */
  protected handleDiscontinuousSelection = (key: string, colCount: number, listData: any[]): boolean => {
    const ranges = this.getSelectedRanges(listData);
    if (ranges.length <= 1) return false; // 只有一个连续区间，使用普通逻辑

    const currentDirection: ShiftDirection = getDirection(key);

    // 如果没有记录的方向，说明这是第一次Shift操作，从边界开始选择
    if (!this.lastShiftDirection) {
      return this.expandBoundarySelection(ranges, currentDirection, colCount, listData);
    }

    const isSameDirection = this.lastShiftDirection === currentDirection;

    if (isSameDirection) {
      // 同方向：清除反向状态，继续在边界扩展选择
      this.reverseState = null;
      return this.expandBoundarySelection(ranges, currentDirection, colCount, listData);
    } else {
      // 反方向：执行复杂的取消和重新选择逻辑
      return this.handleReverseDirection(ranges, currentDirection, colCount, listData);
    }
  };

  /**
   * 扩展边界选择的通用方法
   * @param ranges - 选中的区间数组
   * @param direction - 选择方向
   * @param colCount - 列数
   * @param listData - 列表数据
   * @returns 是否成功扩展选择
   */
  private expandBoundarySelection = (ranges: SelectedRange[], direction: ShiftDirection, colCount: number, listData: any[]): boolean => {
    if (direction === 'up') {
      // 向上：从第一个区间的开始继续向上选择
      const firstRange = ranges[0];
      const nextIndex = Math.max(0, firstRange.start - colCount);

      if (nextIndex >= 0 && nextIndex < listData.length) {
        listData[nextIndex][this.selectField] = true;
        // 更新锚点和活动点
        this.shiftSelectionAnchorIndex = nextIndex;
        this.shiftSelectionActiveIndex = ranges[ranges.length - 1].end;
        this.ensureItemVisible(nextIndex);
        return true;
      }
    } else {
      // 向下：从最后一个区间的结束继续向下选择
      const lastRange = ranges[ranges.length - 1];
      const nextIndex = Math.min(listData.length - 1, lastRange.end + colCount);

      if (nextIndex >= 0 && nextIndex < listData.length) {
        listData[nextIndex][this.selectField] = true;
        // 更新锚点和活动点
        this.shiftSelectionAnchorIndex = ranges[0].start;
        this.shiftSelectionActiveIndex = nextIndex;
        this.ensureItemVisible(nextIndex);
        return true;
      }
    }
    return false;
  };

  private clearAllSelection(listData: any[]): void {
    for (let i = 0; i < listData.length; i++) {
      listData[i][this.selectField] = false;
    }
  }
  /**
   * 统一的反方向处理函数
   *
   * 使用三阶段状态机处理反方向选择：
   * 1. Cancel 阶段：取消指定方向的选中项目
   * 2. Select 阶段：依次选择断开点
   * 3. Jump 阶段：跳转锚点并继续选择
   *
   * @param ranges - 当前选中的连续区间
   * @param direction - 当前操作方向
   * @param colCount - 列数
   * @param listData
   * @returns 是否处理了该操作
   */
  protected handleReverseDirection = (ranges: SelectedRange[], direction: ShiftDirection, colCount: number, listData: any[]): boolean => {
    // 初始化反向状态
    if (!this.reverseState) {
      const gaps = calculateAllGaps(ranges, direction);
      this.reverseState = {
        phase: 'cancel',
        gaps: gaps,
        currentGapIndex: 0,
        direction: direction,
      };
    }

    const state = this.reverseState;

    // 根据当前阶段执行相应逻辑
    switch (state.phase) {
      case 'cancel': {
        const shouldContinue = this.handleCancelPhase(state, listData);
        if (shouldContinue) return true;
        // 如果不需要继续（跳过或完成取消），继续到下一阶段
        // fall through to select phase
      }
      case 'select':
        return this.handleSelectPhase(state, listData);
      case 'jump':
        return this.handleJumpPhase(state, colCount, listData);
      default:
        return false;
    }
  };
  // 设置键盘选择的锚点
  setSelectionAnchor = (index: number, listData: any[], preserveDirection: boolean = false) => {
    if (index >= 0 && index < listData.length) {
      this.shiftSelectionAnchorIndex = index;
      this.shiftSelectionActiveIndex = index;
      // 只有在非保持方向模式下才重置方向记录
      if (!preserveDirection) {
        this.lastShiftDirection = '';
      }
      // 清除反向状态
      this.reverseState = null;
    }
  };

  handleKeyboardSelect(e: KeyboardEvent, listData: any[], colCount: number, multipleSelect: boolean, onSelect: (data: any[], changes: Array<{ index: number; selected: boolean }>) => void): void {
    const key = e.key;

    const ctrlKey = e.ctrlKey;
    const shiftKey = e.shiftKey;

    // 获取当前选中的项目索引
    let currentSelectedIndex = -1;
    let lastSelectedIndex = -1;
    let firstSelectedIndex = -1;

    // 找出第一个和最后一个选中的项目
    if (listData && listData.length > 0) {
      for (let i = 0; i < listData.length; i++) {
        if (listData[i][this.selectField]) {
          if (currentSelectedIndex === -1) {
            currentSelectedIndex = i;
            firstSelectedIndex = i;
          }
          lastSelectedIndex = i;
        }
      }
    }

    // 如果没有选中项，默认选择第一项
    if (currentSelectedIndex === -1) {
      currentSelectedIndex = 0;
      firstSelectedIndex = 0;
      lastSelectedIndex = 0;
    }

    // 计算下一个选中项的索引
    let nextIndex = currentSelectedIndex;

    // 处理方向键
    if (key === 'ArrowUp') {
      // 如果是Shift选择，需要判断是从起始点向上还是从终点向上
      if (shiftKey && multipleSelect && this.shiftSelectionAnchorIndex !== -1) {
        // 如果起始点在当前选择范围的上方，则从下方边界向上移动
        if (this.shiftSelectionAnchorIndex <= firstSelectedIndex) {
          nextIndex = Math.max(0, lastSelectedIndex - colCount);
        } else {
          // 否则从上方边界向上移动
          nextIndex = Math.max(0, firstSelectedIndex - colCount);
        }
      } else {
        nextIndex = Math.max(0, currentSelectedIndex - colCount);
      }
    } else if (key === 'ArrowDown') {
      // 如果是Shift选择，需要判断是从起始点向下还是从终点向下
      if (shiftKey && multipleSelect && this.shiftSelectionAnchorIndex !== -1) {
        // 如果起始点在当前选择范围的下方，则从上方边界向下移动
        if (this.shiftSelectionAnchorIndex >= lastSelectedIndex) {
          nextIndex = Math.min(listData.length - 1, firstSelectedIndex + colCount);
        } else {
          // 否则从下方边界向下移动
          nextIndex = Math.min(listData.length - 1, lastSelectedIndex + colCount);
        }
      } else {
        nextIndex = Math.min(listData.length - 1, currentSelectedIndex + colCount);
      }
    } else if (key === 'ArrowLeft' && colCount > 1) {
      // 如果是Shift选择，需要判断是从起始点向左还是从终点向左
      if (shiftKey && multipleSelect && this.shiftSelectionAnchorIndex !== -1) {
        // 如果起始点在当前选择范围的左侧，则从右侧边界向左移动
        if (this.shiftSelectionAnchorIndex <= firstSelectedIndex) {
          nextIndex = Math.max(0, lastSelectedIndex - 1);
        } else {
          // 否则从左侧边界向左移动
          nextIndex = Math.max(0, firstSelectedIndex - 1);
        }
      } else {
        nextIndex = Math.max(0, currentSelectedIndex - 1);
      }
    } else if (key === 'ArrowRight' && colCount > 1) {
      // 如果是Shift选择，需要判断是从起始点向右还是从终点向右
      if (shiftKey && multipleSelect && this.shiftSelectionAnchorIndex !== -1) {
        // 如果起始点在当前选择范围的右侧，则从左侧边界向右移动
        if (this.shiftSelectionAnchorIndex >= lastSelectedIndex) {
          nextIndex = Math.min(listData.length - 1, firstSelectedIndex + 1);
        } else {
          // 否则从右侧边界向右移动
          nextIndex = Math.min(listData.length - 1, lastSelectedIndex + 1);
        }
      } else {
        nextIndex = Math.min(listData.length - 1, currentSelectedIndex + 1);
      }
    } else {
      return;
    }

    // 如果按住Shift键，扩展选择范围
    if (shiftKey && multipleSelect) {
      // 记录当前方向
      const currentDirection = key === 'ArrowUp' || key === 'ArrowLeft' ? 'up' : 'down';

      // 先尝试处理非连续选择的智能逻辑
      if (this.handleDiscontinuousSelection(key, colCount, listData)) {
        // 如果智能处理成功，只有在没有记录方向时才设置方向
        // 如果已经有方向记录，说明这是反方向操作，不应该覆盖原方向
        if (!this.lastShiftDirection) {
          this.lastShiftDirection = currentDirection;
        }
        // 计算选择变化并通知
        const changes = this.calculateSelectionChanges(listData);
        onSelect(listData, changes);
        return;
      }

      // 记录Shift选择的方向
      this.lastShiftDirection = currentDirection;

      // 如果锚点未设置，使用当前选中项作为锚点
      if (this.shiftSelectionAnchorIndex === -1) {
        this.shiftSelectionAnchorIndex = currentSelectedIndex;
        this.shiftSelectionActiveIndex = currentSelectedIndex;

        // 清除所有选择
        this.clearAllSelection(listData);

        // 选中锚点
        if (currentSelectedIndex >= 0 && currentSelectedIndex < listData.length) {
          listData[currentSelectedIndex][this.selectField] = true;
        }
      }

      // 更新活动点
      this.shiftSelectionActiveIndex = nextIndex;

      // 清除所有选择
      this.clearAllSelection(listData);

      // 计算新的选择范围
      const start = Math.min(this.shiftSelectionAnchorIndex, this.shiftSelectionActiveIndex);
      const end = Math.max(this.shiftSelectionAnchorIndex, this.shiftSelectionActiveIndex);

      // 选择范围内的所有项
      for (let i = start; i <= end; i++) {
        if (i >= 0 && i < listData.length) {
          listData[i][this.selectField] = true;
        }
      }

      // 确保新选中的项可见
      this.ensureItemVisible(nextIndex);

      // 计算选择变化并通知
      const changes = this.calculateSelectionChanges(listData);
      onSelect(listData, changes);
      return;
    }
    // Ctrl键按下时，保持当前选择，移动焦点
    else if (ctrlKey && multipleSelect) {
      // 重置Shift选择的锚点和活动点
      this.shiftSelectionAnchorIndex = -1;
      this.shiftSelectionActiveIndex = -1;
    }
    // 普通方向键，单选模式
    else {
      // 优先使用锚点索引作为起点（鼠标点击时会设置锚点）
      if (this.shiftSelectionAnchorIndex !== -1 && this.shiftSelectionAnchorIndex >= 0 && this.shiftSelectionAnchorIndex < listData.length) {
        // 从锚点开始计算下一个索引
        const anchorIndex = this.shiftSelectionAnchorIndex;
        if (key === 'ArrowUp') {
          nextIndex = Math.max(0, anchorIndex - colCount);
        } else if (key === 'ArrowDown') {
          nextIndex = Math.min(listData.length - 1, anchorIndex + colCount);
        } else if (key === 'ArrowLeft' && colCount > 1) {
          nextIndex = Math.max(0, anchorIndex - 1);
        } else if (key === 'ArrowRight' && colCount > 1) {
          nextIndex = Math.min(listData.length - 1, anchorIndex + 1);
        }
      }
      // 如果锚点无效，且有多个选中项，根据最后一次Shift选择的方向选择起点
      else if (lastSelectedIndex !== firstSelectedIndex) {
        // 根据最后一次Shift选择的方向和当前按键方向决定使用哪个选中项作为起点
        if (this.lastShiftDirection === 'up') {
          // 如果之前是向上选择的
          if (key === 'ArrowUp' || key === 'ArrowLeft') {
            // 向上或向左移动时，从第一个选中项开始
            nextIndex = Math.max(0, firstSelectedIndex - (key === 'ArrowUp' ? colCount : 1));
          } else {
            // 向下或向右移动时，也从第一个选中项开始
            nextIndex = Math.min(listData.length - 1, firstSelectedIndex + (key === 'ArrowDown' ? colCount : 1));
          }
        } else {
          // 如果之前是向下选择的或没有记录方向
          if (key === 'ArrowDown' || key === 'ArrowRight') {
            // 向下或向右移动时，从最后一个选中项开始
            nextIndex = Math.min(listData.length - 1, lastSelectedIndex + (key === 'ArrowDown' ? colCount : 1));
          } else {
            // 向上或向左移动时，也从最后一个选中项开始
            nextIndex = Math.max(0, lastSelectedIndex - (key === 'ArrowUp' ? colCount : 1));
          }
        }
      }

      // 清除所有选择
      this.clearAllSelection(listData);

      // 选中新项
      if (nextIndex >= 0 && nextIndex < listData.length) {
        listData[nextIndex][this.selectField] = true;
      }

      // 确保新选中的项可见
      this.ensureItemVisible(nextIndex);

      // 重置Shift选择的锚点和活动点
      this.shiftSelectionAnchorIndex = nextIndex;
      this.shiftSelectionActiveIndex = nextIndex;
    }

    // 计算选择变化并通知外部
    const changes = this.calculateSelectionChanges(listData);
    onSelect(listData, changes);
  }
}
