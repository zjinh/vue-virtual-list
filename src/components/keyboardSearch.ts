/**
 * 虚拟列表键盘搜索模块
 *
 * 功能特性：
 * - 支持字符、数字、标点符号搜索
 * - 智能字符映射（支持中英文标点符号对应）
 * - 循环搜索功能
 * - 搜索高亮和定位
 *
 * @author ZJINH
 * @version 2.0.0
 */

export class KeyboardSearch {
  private searchIndices: number[] = []; // 存储所有匹配项的索引
  private currentMatchIndex = -1; // 当前匹配项在searchIndices中的位置
  private pendingMatchCallback: ((index: number) => void) | null = null; // 待执行的匹配回调
  private pendingTargetIndex: number | null = null; // 待匹配的目标索引

  // 字符映射表，用于处理特殊字符和标点符号
  private charMappings: Record<string, string[]> = {
    '.': ['。', '．', '.'], // 句号的多种形式
    ',': ['，', '、', ','], // 逗号的多种形式
    ':': ['：', ':'], // 冒号
    ';': ['；', ';'], // 分号
    '?': ['？', '?'], // 问号
    '!': ['！', '!'], // 感叹号
    '(': ['（', '('], // 左括号
    ')': ['）', ')'], // 右括号
    '[': ['【', '[', '［'], // 左方括号
    ']': ['】', ']', '］'], // 右方括号
    '{': ['｛', '{'], // 左花括号
    '}': ['｝', '}'], // 右花括号
    '/': ['／', '/'], // 斜杠
    '\\': ['＼', '\\'], // 反斜杠
    '-': ['－', '-', '—', '－'], // 连字符
    _: ['＿', '_'], // 下划线
    '+': ['＋', '+'], // 加号
    '=': ['＝', '='], // 等号
    '<': ['＜', '<', '《'], // 小于号
    '>': ['＞', '>', '》'], // 大于号
    '*': ['＊', '*', '×'], // 星号
    '&': ['＆', '&'], // 与符号
    '%': ['％', '%'], // 百分号
    $: ['＄', '$', '￥'], // 美元符号和人民币符号（Shift+4）
    '¥': ['￥', '¥', '$'], // 人民币符号和美元符号
    '#': ['＃', '#'], // 井号
    '@': ['＠', '@'], // 艾特符号
    '`': ['｀', '`', '·'], // 反引号和间隔号
    '·': ['·', '`', '~'], // 间隔号
    '~': ['～', '~'], // 波浪号
    '^': ['＾', '^', '…'], // 脱字符和省略号（Shift+6）
    '…': ['…', '＾', '^'], // 省略号和脱字符
    '"': ['"', '"', '"', '"'], // 引号
    "'": ["'", '\u2018', '\u2019'], // 单引号
  };

  // 反向映射表，用于查找字符对应的标准形式
  private reverseCharMappings: Record<string, string> = {};

  constructor() {
    this.initializeCharMappings();
  }

  /**
   * 初始化字符映射表
   */
  private initializeCharMappings() {
    // 填充反向映射表
    Object.entries(this.charMappings).forEach(([standard, variants]) => {
      variants.forEach(variant => {
        this.reverseCharMappings[variant] = standard;
      });
    });
  }

  /**
   * 获取字符的标准形式
   * @param char - 输入字符
   * @returns 标准化后的字符
   */
  private getStandardChar(char: string): string {
    // 转为小写
    const lowerChar = char.toLowerCase();
    // 如果在反向映射表中存在，返回标准形式
    return this.reverseCharMappings[lowerChar] || lowerChar;
  }

  /**
   * 判断是否为可搜索的字符
   * @param e - 键盘事件
   * @returns 是否为可搜索字符
   */
  private isSearchableKey(e: KeyboardEvent): boolean {
    const originalKey = e.key;
    // 忽略控制键和功能键
    return !(originalKey.length > 1 && !['Period', 'Comma', 'Semicolon', 'Quote', 'Backquote', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Slash', 'Digit4'].includes(e.code));
  }

  /**
   * 在列表数据中搜索匹配项
   * @param listData - 列表数据
   * @param searchField - 搜索字段
   * @param searchChar - 搜索字符
   * @returns 匹配的索引数组
   */
  private findMatches(listData: any[], searchField: string, searchChar: string): number[] {
    const matches: number[] = [];
    const standardChar = this.getStandardChar(searchChar);

    for (let i = 0; i < listData.length; i++) {
      const item = listData[i];
      if (item && item[searchField]) {
        const fieldValue = item[searchField].toString().toLowerCase();
        const standardFieldValue = this.getStandardChar(fieldValue.charAt(0));

        if (standardFieldValue === standardChar) {
          matches.push(i);
        }
      }
    }

    return matches;
  }

  /**
   * 处理键盘搜索（keydown阶段）
   * @param e - 键盘事件
   * @param listData - 列表数据
   * @param searchField - 搜索字段
   * @param currentSelectedIndex - 当前选中索引
   * @param onMatch - 匹配回调函数
   * @returns 是否处理了搜索
   */
  handleKeyboardSearch(e: KeyboardEvent, listData: any[], searchField: string, currentSelectedIndex: number, onMatch: (index: number) => void): boolean {
    // 如果没有设置搜索字段，则不执行搜索
    if (!searchField) {
      return false;
    }

    // 检查是否为可搜索的按键
    if (!this.isSearchableKey(e)) {
      return false;
    }

    // 只有在没有按下修饰键（Ctrl、Alt、Meta）的情况下才阻止默认行为
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
    }

    const searchChar = e.key;
    let targetIndex: number | null = null;

    // 如果按下的是相同的字符，则在匹配结果中循环
    if (this.searchIndices.length > 0 && this.getStandardChar(searchChar) === this.getStandardChar(this.lastSearchChar || '')) {
      // 找到当前选中项在匹配结果中的位置
      const currentIndexInMatches = this.searchIndices.indexOf(currentSelectedIndex);

      if (currentIndexInMatches !== -1) {
        // 如果当前选中项在匹配结果中，移动到下一个匹配项
        this.currentMatchIndex = (currentIndexInMatches + 1) % this.searchIndices.length;
      } else {
        // 如果当前选中项不在匹配结果中，从第一个匹配项开始
        this.currentMatchIndex = 0;
      }

      targetIndex = this.searchIndices[this.currentMatchIndex];
    } else {
      // 搜索新的字符
      this.searchIndices = this.findMatches(listData, searchField, searchChar);
      this.lastSearchChar = searchChar;

      if (this.searchIndices.length > 0) {
        // 找到匹配项，定位到第一个
        this.currentMatchIndex = 0;
        targetIndex = this.searchIndices[0];
      }
    }

    // 如果找到了匹配项，保存待执行的匹配回调，在keyup时执行
    if (targetIndex !== null) {
      this.pendingMatchCallback = onMatch;
      this.pendingTargetIndex = targetIndex;
      return true;
    }

    return false;
  }

  /**
   * 处理键盘搜索（keyup阶段）
   * 执行在keydown阶段保存的匹配回调
   */
  handleKeyboardSearchKeyUp(): void {
    if (this.pendingMatchCallback && this.pendingTargetIndex !== null) {
      this.pendingMatchCallback(this.pendingTargetIndex);
      // 清除待执行的回调
      this.pendingMatchCallback = null;
      this.pendingTargetIndex = null;
    }
  }

  // 记录最后搜索的字符，用于循环搜索
  private lastSearchChar: string | null = null;

  /**
   * 重置搜索状态
   */
  reset() {
    this.searchIndices = [];
    this.currentMatchIndex = -1;
    this.lastSearchChar = null;
    this.pendingMatchCallback = null;
    this.pendingTargetIndex = null;
  }

  /**
   * 获取当前搜索结果
   */
  getSearchResults() {
    return {
      indices: this.searchIndices,
      currentIndex: this.currentMatchIndex,
      lastSearchChar: this.lastSearchChar,
    };
  }
}
