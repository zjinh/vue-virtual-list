
# vue-virtual-list

一个支持 `vue2.x`、`vue3.x` 的高性能虚拟列表组件，支持动态高度、鼠标拖拽选择、方向键选择等功能。

## 特性

- ✅ 支持 Vue 2.x 和 Vue 3.x
- ✅ 支持动态高度
- ✅ 支持多列布局
- ✅ 支持鼠标拖拽选择
- ✅ 支持键盘方向键选择
- ✅ 支持键盘快捷搜索定位
- ✅ 支持滚动到底部加载更多
- ✅ 支持数据不满一屏时自动加载
- ✅ 支持元素可见性监听

## 引入使用

```shell
npm install @zjinh/vue-virtual-list --save
```
```

## 基本使用

```html
<template>
    <virtualList 
        :listData="dataList.list"
        :item-height="50" 
        :item-width="200"
        @scrollDown="loadMore"
    >
        <template v-slot="{ item, index, select }">
            <span class="count">{{ index }}</span>
            <img src="../assets/logo.png" :class="{ active: item.isSelected }" alt="" />
        </template>
    </virtualList>
</template>
```

## Props 参数

### 基础参数

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|:--:|:--------:|:-------------:|:--:|:------------------------------|
| listData | Array | `[]` | ✓ | 列表数据 |
| itemHeight | Number | - | ✓ | 元素的最小高度（支持动态高度） |
| itemWidth | Number | `0` | | 元素的宽度（设置后启用多列布局） |
| height | String | `100%` | | 列表容器的高度 |
| bufferScale | Number | `1` | | 可见区域外的上/下方预渲染比例（已废弃） |

### 选中功能

| 参数 | 类型 | 默认值 | 说明 |
|:--:|:--------:|:-------------:|:------------------------------|
| selectField | String | `isSelected` | 选中状态所使用的字段名 |
| mouseSelect | Boolean | `false` | 是否启用鼠标拖拽选择 |
| mouseAreaClassName | String | - | 鼠标拖拽选择区域的 class |
| dragging | Boolean | `false` | 是否正在拖拽（需使用 `.sync` 或 `v-model:dragging`） |
| accuratePosition | Boolean | `true` | 拖拽时是否精确计算元素位置 |
| calcGroupSelect | Boolean | `false` | 计算相邻选中项的起始位置（仅单列布局有效） |
| beforeMouseSelect | Function | `()=>true` | 拖拽前的判断函数，返回 false 则不可拖拽 |
| mouseSelectSelector | String | `.virtual-item` | 拖选计算的元素选择器（必须含有 data-index 属性） |
| arrowSelect | Boolean | `false` | 是否启用方向键选择功能 |
| keyBoardSearchField | String | `''` | 快捷搜索定位所使用的字段名 |
| beforeKeyDown | Function | `()=>true` | 按键操作前的判断函数，返回 false 则不可操作 |
| multipleSelect | Boolean | `false` | 方向键选择是否支持多选 |
| autoScrollHeight | Number | `0` | 鼠标拖选时触发自动滚动的距离区间 |

### 滚动加载

| 参数 | 类型 | 默认值 | 说明 |
|:--:|:--------:|:-------------:|:------------------------------|
| scrollEndDistance | Number | `10` | 距离底部多少 px 时触发 scrollDown 事件 |
| scrollLockTime | Number | `100` | 滚动到底部触发加载后的锁定时间（ms） |
| autoTriggerScrollDown | Boolean | `false` | 数据不满一屏时自动触发 scrollDown 事件<br>⚠️ 配合 `listenVisible` 使用时，仅在元素可见时触发 |

### 其他配置

| 参数 | 类型 | 默认值 | 说明 |
|:--:|:--------:|:-------------:|:------------------------------|
| listenVisible | Boolean | `false` | 是否监听列表可见性变化并重新渲染 |


## 事件

| 事件名称 | 回调参数 | 说明 |
|:--:|:----------|:---------------|
| scrolling | `(event, data)` | 滚动中的回调<br>`data: { start, end, startOffset, scrollTop, direction }` |
| scrollEnd | `(event, data)` | 滚动停止的回调<br>`data: { start, end, startOffset, scrollTop, direction }` |
| scrollDown | `({ autoTrigger })` | 滚动到底部的回调<br>`autoTrigger`: 是否为自动触发（数据不满一屏时） |
| callback | `(data)` | 渲染完成的回调<br>`data: { columns, end, start }` |
| select-end | `(type)` | 选择操作结束<br>`type`: 触发方式（`'mouse'` 或 `'keyboard'`） |
| selection-change | `(changes)` | 鼠标选择状态变化<br>`changes`: 变化的数据集 `Array<{ index: number, selected: boolean }>` |
| keyboard-selection-change | `(changes)` | 键盘选择状态变化<br>`changes`: 变化的数据集 `Array<{ index: number, selected: boolean }>` |
| scroll | `(event)` | 原生滚动事件 |
| update:listData | `(newData)` | 列表数据更新（双向绑定） |
| update:dragging | `(state)` | 拖拽状态更新（双向绑定） |

## 方法

通过 ref 调用组件方法：

| 方法名 | 参数                     | 说明                                                                                     |
|:--:|:-----------------------|:---------------------------------------------------------------------------------------|
| scrollTo | `(index, anim, first)` | 滚动到指定数据索引的位置<br>`index`: 数据索引<br>`anim`: 是否使用动画，默认 `true`<br>`first`: 是否首次调用，默认 `true` |
| setSelectionAnchor | `(index, reset)`       | 设置方向键开始索引，重置方向，默认不重置                                                                   |


### 使用示例

```vue
<template>
  <virtualList ref="listRef" :listData="data" :item-height="50">
    <template v-slot="{ item }">
      {{ item.name }}
    </template>
  </virtualList>
</template>

<script>
export default {
  methods: {
    jumpToIndex(index) {
      this.$refs.listRef.scrollTo(index);
    }
  }
}
</script>
```

## 插槽

| 名称 | 说明 | 插槽 Props |
|:--:|:--:|:--|
| default | 默认插槽（列表项内容） | `item`: 列表项当前数据<br>`index`: 数据索引<br>`select`: 选中状态信息 `{ start, end }` |
| after | 底部插槽 | 无 |

## 使用示例

### 基础用法

```vue
<template>
  <virtualList 
    :listData="list"
    :item-height="50"
    height="500px"
  >
    <template v-slot="{ item, index }">
      <div class="list-item">
        {{ index }} - {{ item.name }}
      </div>
    </template>
  </virtualList>
</template>

<script>
export default {
  data() {
    return {
      list: [
        { name: 'Item 1' },
        { name: 'Item 2' },
        // ...
      ]
    }
  }
}
</script>
```

### 多列布局

```vue
<template>
  <virtualList 
    :listData="list"
    :item-height="200"
    :item-width="150"
  >
    <template v-slot="{ item }">
      <div class="grid-item">
        <img :src="item.image" />
        <p>{{ item.name }}</p>
      </div>
    </template>
  </virtualList>
</template>
```

### 滚动加载更多

```vue
<template>
  <virtualList 
    :listData="list"
    :item-height="50"
    :scrollEndDistance="10"
    :autoTriggerScrollDown="true"
    :listenVisible="true"
    @scrollDown="handleLoadMore"
  >
    <template v-slot="{ item }">
      <div>{{ item.name }}</div>
    </template>
  </virtualList>
</template>

<script>
export default {
  data() {
    return {
      list: [],
      page: 1,
      loading: false
    }
  },
  methods: {
    handleLoadMore({ autoTrigger }) {
      if (this.loading) return;
      
      if (autoTrigger) {
        console.log('数据不满一屏，自动加载');
      } else {
        console.log('滚动到底部加载');
      }
      this.loadData();
    },
    async loadData() {
      this.loading = true;
      try {
        const newData = await fetchData(this.page);
        this.list.push(...newData);
        this.page++;
      } finally {
        this.loading = false;
      }
    }
  },
  mounted() {
    // 初始加载
    this.loadData();
  }
}
</script>
```

> **提示**：
> - 设置 `autoTriggerScrollDown` 后，初始数据不满一屏时会自动加载更多
> - 配合 `listenVisible` 使用，可避免在列表不可见时触发加载，优化性能
> - 建议添加 loading 状态避免重复加载

### 鼠标拖拽选择

```vue
<template>
  <virtualList 
    :listData="list"
    :item-height="50"
    :mouseSelect="true"
    :multipleSelect="true"
    selectField="selected"
    @selection-change="handleSelectionChange"
    @select-end="handleSelectEnd"
  >
    <template v-slot="{ item, index }">
      <div :class="{ active: item.selected }">
        {{ item.name }}
      </div>
    </template>
  </virtualList>
</template>

<script>
export default {
  data() {
    return {
      list: [
        { name: 'Item 1', selected: false },
        { name: 'Item 2', selected: false },
        // ...
      ]
    }
  },
  methods: {
    handleSelectionChange(changes) {
      console.log('选择变化:', changes);
    },
    handleSelectEnd(type) {
      console.log('选择结束，触发方式:', type);
    }
  }
}
</script>
```

### 键盘方向键选择

```vue
<template>
  <virtualList 
    :listData="list"
    :item-height="50"
    :arrowSelect="true"
    :multipleSelect="true"
    keyBoardSearchField="name"
    selectField="selected"
    @keyboard-selection-change="handleKeyboardSelectionChange"
    @select-end="handleSelectEnd"
  >
    <template v-slot="{ item }">
      <div :class="{ active: item.selected }">
        {{ item.name }}
      </div>
    </template>
  </virtualList>
</template>

<script>
export default {
  data() {
    return {
      list: [
        { name: 'Apple', selected: false },
        { name: 'Banana', selected: false },
        { name: 'Cherry', selected: false },
        // ...
      ]
    }
  },
  methods: {
    handleKeyboardSelectionChange(changes) {
      // changes: [{ index: 0, selected: true }, { index: 1, selected: false }]
      console.log('键盘选择变化:', changes);
      changes.forEach(change => {
        console.log(`索引 ${change.index} 的选中状态变为: ${change.selected}`);
      });
    },
    handleSelectEnd(type) {
      console.log('选择结束，触发方式:', type); // 'keyboard'
    }
  }
}
</script>
```

**键盘操作说明：**

- **方向键（↑ ↓ ← →）**：单列布局仅支持上下键，多列布局支持四个方向键
- **Shift + 方向键**：开启 `multipleSelect` 后，范围选择
- **Ctrl/Cmd + 点击**：开启 `multipleSelect` 后，多选模式
- **字母键**：配置 `keyBoardSearchField` 后，快速搜索定位

**高级特性：**

- 智能的非连续选择处理
- Shift 反方向选择的三阶段状态机
- 支持 macOS 风格的选择行为
- 自动滚动确保选中项可见

> 提示：启用键盘搜索后，输入字母可快速定位到对应项

## 注意事项

1. **动态高度**：组件支持动态高度，但需要设置合理的 `itemHeight` 作为预估值
2. **可视检测**：在`选项卡`/`可视切换`场景时建议启用 `listenVisible` 以避免出现白屏
3. **多列布局**：设置 `itemWidth` 后自动启用多列布局，组件会根据容器宽度自动计算列数
4. **选择功能**：鼠标选择和键盘选择可以同时启用
5. **自动加载与可见性监听**：
    - 启用 `autoTriggerScrollDown` 后，数据不满一屏时会自动触发加载，适合初始化场景
    - 当 `listenVisible` 为 `true` 时，自动加载仅在元素可见时触发
    - 元素从不可见变为可见时，会自动检测并触发加载（如果数据仍不满一屏）
    - 建议同时启用两个参数以获得更好的性能和用户体验
