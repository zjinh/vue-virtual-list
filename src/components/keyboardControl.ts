import { onMounted, onBeforeUnmount, h, onActivated, onDeactivated } from 'vue';
import { isInputElement } from '../utils/coreUtils';
import { KeyboardSearch } from './keyboardSearch';
import { KeyboardSelect } from './keyboardSelect';

export default {
  name: 'keyboardControl',
  props: {
    listData: {
      type: Array,
      required: true,
    },
    selectField: {
      type: String,
      required: true,
    },
    keyBoardSearchField: {
      type: String,
      default: '',
    },
    arrowSelect: {
      type: Boolean,
      default: false,
    },
    multipleSelect: {
      type: Boolean,
      default: false,
    },
    beforeKeyDown: {
      type: Function,
      default: () => true,
    },
    colCount: {
      type: Number,
      default: 1,
    },
    isElementVisible: {
      type: Function,
      default: () => true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:listData', 'select-end', 'focus', 'ensureItemVisible', 'selection-change'],
  setup(props, { emit, expose }) {
    // 确保项目可见
    const ensureItemVisible = (index: number) => {
      emit('ensureItemVisible', index);
    };
    //初始化键盘相关功能
    const keyboardSearch = new KeyboardSearch();
    const keyboardSelect = new KeyboardSelect(ensureItemVisible, props.selectField);
    // 获取焦点
    const focus = () => {
      emit('focus');
    };

    // 处理键盘搜索功能
    const handleKeyboardSearch = (e: KeyboardEvent): boolean => {
      if (!props.keyBoardSearchField) {
        return false;
      }
      // 处理键盘搜索
      let currentSelectedIndex = -1;
      if (props.listData && props.listData.length > 0) {
        for (let i = 0; i < props.listData.length; i++) {
          if (props.listData[i][props.selectField]) {
            currentSelectedIndex = i;
            break;
          }
        }
      }
      return keyboardSearch.handleKeyboardSearch(e, props.listData, props.keyBoardSearchField, currentSelectedIndex, targetIndex => {
        // 清除所有选择
        props.listData.forEach(item => (item[props.selectField] = false));
        // 选择目标项
        props.listData[targetIndex][props.selectField] = true;
        // 确保项目可见
        ensureItemVisible(targetIndex);
        // 触发更新和选择结束事件
        emit('update:listData', props.listData);
        emit('select-end');
      });
    };

    // 快捷键操作
    const handleKeydown = (e: KeyboardEvent): void => {
      const key = e.key;
      // 检查当前焦点是否在输入元素上
      if (isInputElement()) {
        return;
      }

      if (!props.beforeKeyDown()) {
        e.preventDefault();
        return;
      }

      // 如果按下了修饰键（Ctrl、Alt、Meta），不处理
      if (isPrefixKey(e)) {
        return;
      }

      // 先尝试处理键盘搜索功能
      if (handleKeyboardSearch(e)) {
        return;
      }

      // 如果不是方向键，直接返回
      if (!keyboardSelect.arrowKeyList.includes(key)) {
        return;
      }

      // 检查listData是否存在且有长度
      if (!props.arrowSelect || !props.listData || !props.listData.length || !props.isElementVisible() || !props.active) return;

      // 阻止默认行为（如页面滚动）
      if (['ArrowUp', 'ArrowDown'].includes(key)) {
        e.preventDefault();
      } else if (['ArrowLeft', 'ArrowRight'].includes(key) && props.colCount > 1) {
        e.preventDefault();
      }

      // 如果是左右键且列数为1，不处理选择逻辑，让浏览器处理横向滚动
      if (['ArrowLeft', 'ArrowRight'].includes(key) && props.colCount === 1) {
        focus();
        return;
      }

      keyboardSelect.handleKeyboardSelect(e, props.listData, props.colCount, props.multipleSelect, (data, changes) => {
        emit('update:listData', data);
        // 如果有选择变化，触发 selection-change 事件
        if (changes && changes.length > 0) {
          emit('selection-change', changes);
        }
      });
    };

    // 键盘事件释放处理
    const handleKeyUp = (e: KeyboardEvent): void => {
      if (keyboardSelect.arrowKeyList.includes(e.key)) {
        emit('select-end');
      }

      // 处理键盘搜索的keyup事件
      if (props.keyBoardSearchField) {
        if (isPrefixKey(e)) {
          return;
        }
        keyboardSearch.handleKeyboardSearchKeyUp();
      }
    };

    const isPrefixKey = (e: KeyboardEvent): boolean => {
      // 如果按下了修饰键（Ctrl、Alt、Meta），不处理
      return e.ctrlKey || e.altKey || e.metaKey;
    };

    // 设置键盘选择的锚点
    const setSelectionAnchor = (index: number, preserveDirection: boolean = false) => {
      keyboardSelect.setSelectionAnchor(index, props.listData, preserveDirection);
    };

    const setupKeyboardEvents = () => {
      if (props.arrowSelect || props.keyBoardSearchField) {
        document.addEventListener('keydown', handleKeydown);
        document.addEventListener('keyup', handleKeyUp);
        // 自动获取焦点
        focus();
      }
    };

    const removeKeyboardEvents = () => {
      if (props.arrowSelect || props.keyBoardSearchField) {
        document.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('keyup', handleKeyUp);
      }
      keyboardSearch.reset();
    };

    onMounted(() => {
      setupKeyboardEvents();
    });

    onBeforeUnmount(() => {
      removeKeyboardEvents();
    });

    onActivated(() => {
      setupKeyboardEvents();
    });

    onDeactivated(() => {
      removeKeyboardEvents();
    });

    // 暴露方法给父组件
    expose({
      setSelectionAnchor,
    });

    return () => props.active && h('div', { class: ['keyboard-listen', { arrow: props.arrowSelect, position: props.keyBoardSearchField }], style: { display: 'none' } });
  },
};
