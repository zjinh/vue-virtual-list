
# vue-virtual-list

一个支持vue2.7/vue3.x虚拟列表组件，支持动态高度。
鼠标拖拽、方向键选择

## 安装

通过 npm:

```shell
npm install @zjinh/vue-virtual-list --save
```

```js
import virtualList from '@zjinh/vue-virtual-list';
import '@zjinh/vue-virtual-list/dist/vue-virtual-list.css';

Vue.use(virtualList);

export default {
    components:{
        virtualList
    },
    methods:{
        scrollTo(index){
            this.$virtualList.scrollTo(index)//滚动到指定下标的位置
            $refs.virtualList.scrollTo(index)
            //两种用法均可
        }
    }
}
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

## props参数

|参数|类型|  默认值  |必填| 说明                        |
|:--:|:--:|:-----:|:--:|:--------------------------|
|listData|Array|  []   |✓| 列表数据                      |
|itemWidth|Number|   0   || 元素的宽度                     |
|itemHeight|Number|   0   |✓| 元素的最小高度（支持动态高度）           |
|height|String| 100%  || 列表的高度。                    |
|absoluteHeight|Boolean| false || 绝对高度，启用后将不会出现滚动条          |
|bufferScale|Number|   1   || 可见区域外的上/下方预渲染比例，避免快速滑动时闪烁 |
|touchScale|Number|   2   || 手指移动与组件移动距离的比             |
|overFlow|String| auto  || Y轴滚动条样式，默认auto            |

|选中功能|||||
|selectField|String|isSelected||选中所使用的字段|
|mouseSelect|Boolean|false||鼠标拖拽选择|
|mouseAreaClassName|String|default||鼠标拖拽选择区域class|
|dragging|Boolean|false||是否正在拖拽，必须使用sync修饰符|
|accuratePosition|Boolean|true||拖拽时是否精确元素位置|
|calcGroupSelect|Boolean|false||计算相邻选中起始（仅在itemWidth为0的情况下有效）|
|底部加载更多|||||
|scrollEndDistance|Number|10||距离底部多少px时触发加载|

## 回调事件

|事件名称|回调参数|说明|
|:--:|:--:|:--|
|scrollIng|event,data|滚动中的回调|
|scrollEnd|event,data|停止滚动的回调|
|scrollDown||滚动到底部的回调|
|onPull|state,distance|下拉状态变更的回调|
|pullDown||下拉刷新触发的回调|
|callback|data|渲染回调|

## 方法

|方法|说明|
|:--:|:--|
|scrollTo|滚动到指定数据下标的位置|

## 插槽

|名称|说明|插槽Prop|
|:--:|:--:|:--|
|default|默认插槽|item:列表项当前数据<br>index:数据索引<br>select:数据选中的起始|
|after|底部插槽|无|
