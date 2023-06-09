<template>
  <section ref="list" :data-version="version" :data-w="itemWidth" :data-h="itemHeight" :style="listHeight" class="virtual-list" @scroll="scrollEvent($event)">
    <!--撑开滚动条的容器-->
    <div ref="phantom" class="virtual-list-phantom"></div>
    <!--顶部下拉区域-->
    <div
        ref="top"
        class="virtual-top-container"
        v-if="enablePullDown"
        v-show="dragState !== 'none' && touchDistance >= 20"
    >
      <slot name="before" :state="dragState" :distance="touchDistance">
        <div class="pull-down" :style="{ color: pullTextColor }">
					<span class="pull-down-icon icon-arrow" :class="{ reverse: dragState === 'drop' }" v-if="dragState === 'pull' || dragState === 'drop'">
						<svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
							<path
                  d="M548.352 241.152L716.8 409.6a32.768 32.768 0 0 1 0 46.592 30.72 30.72 0 0 1-45.568 0l-116.736-115.2v464.896a32.768 32.768 0 1 1-65.024 0V340.992L372.736 460.8a39.424 39.424 0 0 1-45.568-6.656 32.768 32.768 0 0 1 0-46.592l162.816-166.4a35.328 35.328 0 0 1 58.368 0z"
                  :fill="pullTextColor"
              ></path>
						</svg>
					</span>
          <span class="loader" v-if="dragState === 'loading'"> </span>
          <span class="pull-down-title">
						{{ dragStateTitle }}
					</span>
        </div>
      </slot>
    </div>
    <!--内容区域-->
    <div ref="content" class="virtual-list-container">
      <div ref="items" class="virtual-item-group" :class="{flex:column!==1}" :id="row._key" :key="row._key" v-for="(row) in renderListData">
        <template v-for="(item, col_index) in row.value">
          <div class="virtual-item" :key="row._key + '-' + col_index" :data-index="item._index" :data-show="row._index>=start&&row._index<=end">
            <slot name="default" :item="item" :index="item._index" :select="activeGroupPosition(item, item._index)"></slot>
          </div>
        </template>
        <!--空占位-->
        <template v-if="row.value.length < column">
          <div v-for="index in column - (row.value.length % column)" class="virtual-item" :key="'empty-' + index"></div>
        </template>
      </div>
    </div>
    <!--底部插槽-->
    <slot name="after"></slot>
    <selectRegion v-if="mouseSelect" :regionArea="$refs.list" :regionClass="mouseAreaClassName" @dragging="handleDragging" @select="handleMouseSelect"></selectRegion>
  </section>
</template>

<script>
import Vue from "vue"
import selectRegion from "./selectRegion.vue";
if(!window.sleep){
  window.sleep=function (time=1000){
    return new Promise((resolve) => {
      let a=setTimeout(() => {
        resolve(1)
        clearTimeout(a)
      }, time)
    })
  }
}
const _ ={
  debounce(func, wait = 50, immediate = false) {
    let timer = null;
    let result;
    let debounced = function(...args) {
      if (timer) {
        clearTimeout(timer)
      }
      if (immediate) {
        let callNow = !timer;
        timer = setTimeout(() => {
          timer = null;
        }, wait);
        if (callNow) {
          result = func.apply(this, args)
        }
      } else {
        timer = setTimeout(() => {
          func.apply(this, args);
        }, wait);
      }
      return result;
    }
    debounced.cancel = function() {
      clearTimeout(timer);
      timer = null;
    };
    return debounced;
  }
};
export default {
  name: 'virtualList',
  components: {
    selectRegion
  },
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
    //绝对高度
    absoluteHeight: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    //滚动条模式
    overFlow:{
      type:String,
      default:function (){
        return 'auto'
      }
    },
    //缓冲区比例
    bufferScale: {
      type: Number,
      default: 1,
    },
    //滑动距离与真实距离比值
    touchScale: {
      type: Number,
      default: 2,
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
    //是否多选
    multipleSelect: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    //是否开启下拉刷新
    enablePullDown: {
      type: Boolean,
      default: false,
    },
    //滑动距离阈值，超过阈值回调
    pullDistance: {
      type: Number,
      default: 70,
    },
    //最大滑动距离
    maxDistance: {
      type: Number,
      default: 70,
    },
    pullTextColor: {
      type: String,
      default: '#000000',
    },
    pullingText: {
      type: String,
      default: '下拉刷新',
    },
    pullDropText: {
      type: String,
      default: '松开刷新',
    },
    pullLoadingText: {
      type: String,
      default: '刷新中...',
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
  },
  data() {
    return {
      version,
      //拖拽状态
      dragState: 'none',
      //当前下拉距离
      touchDistance: 0,
      //可视区域高度
      screenHeight: 0,
      //起始索引
      start: 0,
      //结束索引
      end: 0,
      //多少列
      column: 1,
      //位置信息
      positions: [],
      //偏移量
      startOffset: 0,
      //预设偏移量
      prevPos: 0,
      //滚动条加载锁
      lockScroll: false,
      lockTimer: null,
      oldScrollTop: 0,
      preventAutoScroll: false,
      lastDirection: ''
    };
  },
  computed: {
    _listData() {
      return this.listData.reduce((init, cur, index) => {
        let item = cur;
        item._index = index;
        if (index % this.column === 0) {
          init.push({
            // _转换后的索引_第一项在原列表中的索引_本行包含几列
            _key: `_${index / this.column}_${index}_${this.column}`,
            _startIndex: index,
            _index: init.length,
            value: [item],
          });
        } else {
          let dataIndex=Math.max(0, init.length - 1)
          if (init[dataIndex]) {
            init[dataIndex].value.push(item);
          } else {
            init[dataIndex]={
              value: []
            }
            init[dataIndex].value.push(item);
          }
          init[dataIndex]._endIndex=index;
        }
        return init;
      }, []);
    },
    anchorPoint() {
      return this.positions.length ? this.positions[this.start] : null;
    },
    visibleCount() {
      return Math.ceil(this.screenHeight / this.itemHeight);
    },
    aboveCount() {
      return Math.min(this.start, this.bufferScale * this.visibleCount);
    },
    belowCount() {
      return Math.min(this.listData.length - this.end, this.bufferScale * this.visibleCount);
    },
    renderListData() {
      let start = this.start - this.aboveCount;
      let end = this.end + this.belowCount;
      return this._listData.slice(start, end);
    },
    dragStateTitle() {
      let state = this.dragState;
      if (state === 'pull') {
        return this.pullingText;
      } else if (state === 'drop') {
        return this.pullDropText;
      } else if (state === 'loading') {
        return this.pullLoadingText;
      }
      return this.pullLoadingText;
    },
    virtualStyle() {
      let item = this.positions[this.positions.length - 1];
      return `${item ? item.bottom : 0}px`
    },
    nowSelectIndex: function () {
      let data = [];
      if (!this.itemWidth && this.calcGroupSelect) {
        this.listData.forEach((item, index) => {
          if (item[this.selectField]) {
            data.push(index);
          }
        });
      }
      return data;
    },
    groupByIndex: function () {
      let arr = this.nowSelectIndex;
      if (arr.length === 0) {
        return [];
      }
      let result = [],
          i = 0;
      const list = arr.sort((a, b) => a - b);
      list.forEach((item, index) => {
        if (index === 0) {
          result[0] = [item];
        } else if (item - list[index - 1] === 1) {
          // 判断当前值 和 前一个值是否相差1
          result[i].push(item);
        } else {
          result[++i] = [item]; // 开辟新空间。
        }
      });
      return result;
    },
    listHeight: function () {
      return {
        height: this.absoluteHeight?this.virtualStyle:this.height,
      }
    },
  },
  created() {
    this.initPositions();
    this.scrollEnd = _.debounce((event, data) => {
      this.$emit('scrollEnd', event, data);
    }, 100);
    this.windowResize= _.debounce(() => {
        this.handleResize()
    })
  },
  mounted() {
    this.$nextTick(() => {
      Vue.prototype.$virtualList=this
      if (this.itemWidth) {
        this.windowResize();
      }
      this.startRender()
      if (!this.screenHeight) {
        let a=setTimeout(() => {
          this.startRender()
          clearTimeout(a)
        }, 100)
      }
    })
    window.addEventListener('resize', this.windowResize);
    //添加拖拽事件
    if (this.enablePullDown) {
      let list = this.$refs.list;
      list.addEventListener('touchstart', this.touchStartEvent);
      list.addEventListener('touchmove', this.touchMoveEvent);
      list.addEventListener('touchend', this.touchEndEvent);
    }
    //方向键选择
    if (this.arrowSelect) {
    }
  },
  beforeDestroy() {
    Vue.prototype.$virtualList=null
    window.removeEventListener('resize', this.windowResize);
    if (this.enablePullDown) {
      let list = this.$refs.list;
      list.removeEventListener('touchstart', this.touchStartEvent);
      list.removeEventListener('touchmove', this.touchMoveEvent);
      list.removeEventListener('touchend', this.touchEndEvent);
    }
    if (this.arrowSelect) {
    }
  },
  updated() {
    if (this.dragState !== 'none') {
      return;
    }
    //列表数据长度不等于缓存长度
    if (this._listData.length !== this.positions.length) {
      this.initPositions();
      this.lockScroll=false
      if (this.lockTimer) {
        clearTimeout(this.lockTimer)
      }
    }
    this.$nextTick(function () {
      let items = this.$refs.items;
      if (!items || !items.length) {
        this.$refs.phantom.style.height = this.absoluteHeight?this.virtualStyle:'0px'
        return;
      }
      this.getSizeInfo()
      //获取真实元素大小，修改对应的尺寸缓存
      this.updateItemsSize();
      let height = this.positions[this.positions.length - 1].bottom;
      this.$refs.phantom.style.height = height + 'px'
      //更新真实偏移量
      this.setStartOffset()
    });
  },
  watch: {
    itemWidth: function() {
      this.renderConfigChange(true)
    },
    listHeight: function () {
      this.renderConfigChange()
    },
  },
  methods: {
    startRender() {
      this.getSizeInfo()
      this.start = 0;
      this.end = this.start + this.visibleCount;
      this.renderCallback()
      this.setStartOffset();
    },
    windowResize() {},
    handleResize() {
        this.getSizeInfo()
        if (this.itemWidth) {
            let count = Math.floor(this.$el.offsetWidth / this.itemWidth);
            this.column = Math.max(1, count);
        }
        this.renderCallback()
        this.$nextTick(() => {
            this.scrollEvent({
                target: this.$el
            }, true)
        })
    },
    renderConfigChange(calcSize=false) {
      if (!this.itemWidth) {
        this.column=1;
      }
      if (calcSize) {
        this.initPositions()
      }
      this.handleResize()
    },
    getSizeInfo() {
        try {
            let height=Math.max(this.$el.clientHeight, -1)
            this.screenHeight = height>0?height:(this.$el.parentNode?this.$el.parentNode.clientHeight:0)//||this.absoluteHeight?parseInt(this.virtualStyle):this.height;
        } catch (e) {
            this.screenHeight=0
        }
    },
    //防抖处理，设置滚动状态
    scrollEnd(event, data) {
    },
    scrollingEvent(event, data) {
      this.oldScrollTop=data.scrollTop
      this.$emit('scrolling', event, data);
    },
    //初始化缓存
    initPositions() {
      this.positions = this._listData.map((d, index) => ({
        index,
        height: this.itemHeight,
        top: index * this.itemHeight,
        bottom: (index + 1) * this.itemHeight,
      }));
    },
    //获取列表起始索引
    getStartIndex(scrollTop = 0) {
      return Math.max(this.binarySearch(this.positions, scrollTop), 0);
    },
    //二分法查找
    binarySearch(list, value) {
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
    },
    //获取列表项的当前尺寸
    updateItemsSize() {
      let nodes = this.$refs.items;
      nodes.forEach((node) => {
        let rect = node.getBoundingClientRect();
        let height = rect.height;
        let index = +node.id.replace(/^_(\d+).*/, '$1');
        let oldHeight = this.positions[index].height;
        let dValue = oldHeight - height;
        //存在差值
        if (dValue) {
          this.positions[index].bottom = this.positions[index].bottom - dValue;
          this.positions[index].height = height;
          for (let k = index + 1; k < this.positions.length; k++) {
            this.positions[k].top = this.positions[k - 1].bottom;
            this.positions[k].bottom = this.positions[k].bottom - dValue;
          }
        }
      });
    },
    //更新偏移量
    setStartOffset() {
      let startOffset;
      if (this.start >= 1) {
        let size = this.positions[this.start].top - (this.positions[this.start - this.aboveCount] ? this.positions[this.start - this.aboveCount].top : 0);
        startOffset = this.positions[this.start - 1].bottom - size;
      } else {
        startOffset = 0;
      }
      this.startOffset = startOffset;
      if (this.$refs.content) {
        this.$refs.content.style.transform = `translate3d(0,${startOffset}px,0)`
      }
    },
    //滚动事件
    scrollEvent(event, force=false) {
      let element = event.target;
      //当前滚动位置
      let scrollTop = event.target.scrollTop;
      let scrollHeight= Math.max(element.scrollHeight, parseInt(this.$refs.phantom?this.$refs.phantom.style.height:'0px'))
      //排除不需要计算的情况
      if (force||!this.anchorPoint || scrollTop > this.anchorPoint.bottom || scrollTop < this.anchorPoint.top) {
        //此时的开始索引
        this.start = this.getStartIndex(scrollTop);
        //此时的结束索引
        this.end = this.start + this.visibleCount;
        //更新偏移量
        this.setStartOffset();
      }
      //触发外部滚动事件
      let direction=(scrollTop-this.oldScrollTop>=0)?'down':'up'
      let data = {
        start: this.start * this.column,
        end: Math.min(this.end * this.column, this.listData.length - 1),
        startOffset: this.startOffset,
        scrollTop,
        direction
      };
      if (this.oldScrollTop&&this.lastDirection&&this.lastDirection!==direction) {
          this.preventAutoScroll=true//忽略自动滚动
      }
      this.lastDirection=direction
      this.scrollingEvent(event, data);
      //防抖处理滚动结束
      this.scrollEnd(event, data);
      if (scrollHeight<=this.$el.clientHeight) {
        return;
      }
      if (this.lockScroll) {
        return
      }
      if (((scrollHeight - scrollTop - this.scrollEndDistance) <= element.clientHeight)&&direction==='down') {
        this.$emit('scrollDown');
        this.lockScroll=true
        this.unlockScroll()
      }
    },
    unlockScroll() {
      this.lockTimer = setTimeout(() => {
        this.lockScroll = false;//等待数据更新1000ms后解锁
        this.preventAutoScroll=false
        if (this.lockTimer) {
          clearTimeout(this.lockTimer)
        }
      }, 1000)
    },
    //下拉加载更多
    touchStartEvent(event) {
      if (!this.enablePullDown) {
        return;
      }
      //记录当前起始Y坐标
      this.prevPos = event.touches[0].pageY;
    },
    touchMoveEvent(event) {
      if (!this.enablePullDown) {
        return;
      }
      //暂时这样处理 loading 中不可滚动
      if (this.dragState === 'loading') {
        event.preventDefault();
        return;
      }
      //当前Y坐标
      let curPos = event.touches[0].pageY;
      let scrollTop=this.$refs.list.scrollTop
      //下拉 且 不在顶部
      if (curPos > this.prevPos && scrollTop !== 0) {
        return;
      }
      //下拉 且 在顶部
      if (curPos > this.prevPos && scrollTop === 0) {
        // event.preventDefault();
        this.touchDistance = Math.max(this.touchDistance + curPos - this.prevPos, 0);

        let distance = ~~(this.touchDistance / this.touchScale);
        //未达到阈值
        if (distance < this.pullDistance) {
          this.dragState = 'pull';
          this.$emit('onPull', this.dragState, distance);
        }
        //已达到阈值
        if (distance >= this.pullDistance) {
          this.dragState = 'drop';
          this.$emit('onPull', this.dragState, distance);
        }
        //设定偏移距离
        if (distance <= this.maxDistance || !this.maxDistance) {
          let d = this.maxDistance ? Math.min(distance, this.maxDistance) : distance;
          setTimeout(() => {
            this.$refs.content.style.transform = `translate3d(0,${d}px,0)`
            this.$refs.top.style.height = `${d}px`
          }, 0);
        }
      }
      //上划 且 没有拖拽距离
      if (curPos < this.prevPos && !this.touchDistance) {
        return;
      }
      //上划 且 有拖拽距离
      if (curPos < this.prevPos && this.touchDistance) {
        this.touchDistance = Math.max(this.touchDistance + curPos - this.prevPos, 0);
        let distance = ~~(this.touchDistance / this.touchScale);
        //未达到阈值
        if (distance < this.pullDistance) {
          this.dragState = 'pull';
          this.$emit('onPull', this.dragState, distance);
        }
        //已达到阈值
        if (distance >= this.pullDistance) {
          this.dragState = 'drop';
          this.$emit('onPull', this.dragState, distance);
        }
        //设定偏移距离
        if (distance <= this.maxDistance || !this.maxDistance) {
          let d = this.maxDistance ? Math.min(distance, this.maxDistance) : distance;
          setTimeout(() => {
            this.$refs.content.style.transform = `translate3d(0,${d}px,0)`
            this.$refs.top.style.height = `${d}px`
          }, 0);
        }
        event.preventDefault();
      }
      this.prevPos = curPos;
    },
    touchEndEvent() {
      if (!this.enablePullDown) {
        return;
      }
      if (this.dragState !== 'pull' && this.dragState !== 'drop') {
        return;
      }
      if (this.dragState === 'pull') {
        setTimeout(() => {
          this.dragState = 'none';
        }, 300);
        this.touchDistance = 0;
      }
      if (this.dragState === 'drop') {
        setTimeout(() => {
          this.dragState = 'loading';
        }, 300);
        //将距离变更为阈值点 - 20
        this.touchDistance = (this.pullDistance - 20) * this.touchScale;
        this.$emit('pullDown');
      }
      this.$emit('onPull', this.dragState, ~~(this.touchDistance / this.touchScale));
      this.$refs.content.style.transition = `transform 0.3s`
      this.$refs.content.style.transform = `translate3d(0,${~~(this.touchDistance / this.touchScale)}px,0)`
      this.$refs.top.style.transition = `height 0.3s`
      this.$refs.top.style.height = `${~~(this.touchDistance / this.touchScale)}px`
      setTimeout(() => {
        this.$refs.content.style.transition = ``
        this.$refs.top.style.transition = ``
      }, 350);
    },
    //鼠标框选
    handleMouseSelect(data) {
      let start=data.start
      let end=data.end
      let area_data = {
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y) - this.startOffset,
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };
      let selList = this.$el.querySelectorAll('.virtual-item[data-index]');
      for (let i = 0; i < selList.length; i++) {
        let elm = selList[i];
        let index = elm.dataset.index;
        if (this.accuratePosition) {
          elm=elm.children[0]||elm
        }
        let item = this.listData[index];
        if (!item) {
          break;
        }
        let rect = elm.getBoundingClientRect();
        let sl = rect.width + elm.offsetLeft,
            st = rect.height + elm.offsetTop;
        let area_l = area_data.left + area_data.width;
        let area_t = area_data.top + area_data.height;
        if (sl > area_data.left && st > area_data.top && elm.offsetLeft < area_l && elm.offsetTop < area_t) {
          if (item[this.selectField] !== true) {
            item[this.selectField] = true;
          }
        } else {
          if (item[this.selectField]) {
            item[this.selectField] = false;
          }
        }
      }
      this.$emit('update:listData', this.listData)
    },
    handleDragging(state) {
      this.$emit('update:dragging', state)
    },
    //计算当前节点的选中
    activeGroupPosition(item, index) {
      let data = this.groupByIndex;
      let result = {
        start: false,
        end: false,
      };
      if (!this.calcGroupSelect || data.length === 0 || !item[this.selectField] || this.itemWidth) {
        return result;
      }
      for (let i = 0, len = data.length; i < len; i++) {
        let group_item = data[i];
        if (group_item.includes(index)) {
          if (group_item.length === 1) {
            result = {
              start: true,
              end: true,
            };
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
    },
    //滚动到指定位置
    async scrollTo(index = 0, first=true) {
      if (index<0) {
        return
      }
      if (this.preventAutoScroll) {
        return;
      }
      if (first) {
          await sleep(200)
      }
      let listIndex = index
      let scrollTop=0
      if (this.itemWidth) {
        listIndex = Math.floor(Math.max(Math.abs(index / this.column), 0))
      } else {
        listIndex = Math.min(index, this._listData.length-1)
      }
      scrollTop=this.positions[listIndex].top
      scrollTop=Math.floor(scrollTop)
      this.$nextTick(async () => {
        this.$el.scrollTo({
          left: 0,
          top: scrollTop,
          behavior: 'smooth'
        })
        this.scrollEvent({
            target: this.$el
        }, true)
        await sleep(500)
        let currentScrollTop=Math.floor(this.$el.scrollTop)
        let diff=Math.abs(currentScrollTop-scrollTop)>2
        if (currentScrollTop!==scrollTop&&!this.lockScroll) {
            if (diff) {
                this.scrollTo(index, false)
            }
        }
      })
    },
    renderCallback() {
      this.$emit("callback", {
        columns: this.column,
        end: this.end,
        start: this.start
      })
    }
  },
};
</script>

<style scoped>
.pull-down {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.pull-down-icon {
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}
.icon-arrow {
  transform: rotate(180deg);
}
.pull-down-icon.reverse {
  transform: rotate(360deg);
}
.loader {
  width: 20px;
  height: 20px;
  position: relative;
  border-top: 2px solid rgba(0, 0, 0, 0.1);
  border-right: 2px solid rgba(0, 0, 0, 0.1);
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
  border-left: 2px solid #38f;
  -webkit-animation: spin 1s infinite linear;
  animation: spin 1s infinite linear;
  border-radius: 50%;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.pull-down-title {
  font-size: 14px;
  padding-left: 10px;
}
.virtual-top-container {
  transform: translateZ(0);
  position: relative;
  z-index: 2;
}
.virtual-list {
  overflow-x: hidden;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
}
.virtual-list-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  z-index: -1;
}
.virtual-list-container {
  left: 0;
  right: 0;
  top: 0;
  z-index: 0;
  position: absolute;
}
.virtual-item-group.flex {
  display: flex;
}
.virtual-item-group > .virtual-item {
  margin-right: auto;
}
.virtual-item {
  flex: 1;
}
</style>
