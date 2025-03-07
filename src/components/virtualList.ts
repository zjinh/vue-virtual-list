import "./virtualList.scss"
import selectRegion from "./selectRegion"
import {
  h,
  version,
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  onUpdated,
  nextTick,
  watch,
  Ref,
  ComputedRef
} from 'vue'

interface PosData{
  index:number,
  height:number,
  top:number,
  bottom:number,
}
interface ScrollData{
  start: number,
  end:number,
  startOffset: number,
  scrollTop:number,
  direction:string
}
const _ ={
  debounce(func:Function, wait = 50, immediate = false) {
    let timer:NodeJS.Timeout|null = null;
    let result:any = null;
    return function(...args:any) {
      if (timer) {
        clearTimeout(timer)
      }
      if (immediate) {
        let callNow = !timer;
        timer = setTimeout(() => {
          timer = null;
        }, wait);
        if (callNow) {
          result = func(...args)
        }
      } else {
        timer = setTimeout(() => {
          func(...args)
        }, wait);
      }
      return result;
    }
  },
  randomString(len:number=32) {
    let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    let maxPos = $chars.length;
    let pwd = '';
    for (let i = 0; i < len; i++) {
      pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
  }
};
const isVue2=version.startsWith('2')
let scrollTopCache=0
let lastColumn=1
const renderHelper=function(attrs?:{ [key: string]: string }, listen?:{ [key: string]: Function | Array<Function> }):any {
  if (isVue2) {
    return {
      attrs: attrs,
      on: listen,
    }
  } else {
    let obj:any=attrs
    for (let key in listen) {
      obj[`on${key.charAt(0).toUpperCase() + key.slice(1)}`] = listen[key]
    }
    return obj
  }
}
const propsHelper=function (props?:any) {
  if (isVue2) {
    return {
      props
    }
  } else {
    return props
  }
}
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
    //绝对高度
    absoluteHeight: {
      type: Boolean,
      default: function () {
        return false;
      },
    },
    //缓冲区比例
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
          return true
        }
      }
    },
    //鼠标拖选计算的元素
    mouseSelectSelector: {
      type: String,
      default: function () {
        return '.virtual-item'
      },
    },
    scrollLockTime: {
      type: Number,
      default: function () {
        return 100
      }
    },
    //自动滚动距离
    autoScrollHeight: {
      type: Number,
      default: function () {
        return 0
      }
    }
  },
  setup(props:any, { slots, emit, expose }) {
    // refs
    const virtualList:Ref<HTMLElement|null> = ref(null)
    const phantom:Ref<HTMLElement|null> = ref(null)
    const content:Ref<HTMLElement|null> = ref(null)
    //data
    const screenHeight = ref(0)
    const start = ref(0)
    const end = ref(0)
    const column = ref(props.itemWidth <= 0 ? 1 : 0)
    const positions:Ref<PosData[]> = ref([])
    const startOffset = ref(0)
    const lockScroll = ref(false)
    const lockTimer:Ref<NodeJS.Timeout|null> = ref(null)
    const oldScrollTop = ref(0)
    const preventAutoScroll = ref(false)
    const lastDirection = ref('')
    const styleObj:Ref<HTMLElement|null> = ref(null)
    const randomClass = ref('virtual_' + _.randomString(5).toLowerCase())
    const ready = ref(false)
    const active = ref(true)
    let resizer:ResizeObserver|null = null

    // 生命周期钩子
    onMounted(() => {
      nextTick(() => {
        ready.value = true
        initPositions()
        if (props.itemWidth) {
          windowResize()
          checkStyleObj()
        }
        startRender()
        if (!screenHeight.value) {
          let a=setTimeout(() => {
            startRender()
            clearTimeout(a)
          }, 100)
        }
      })

      if (elm.value) {
        resizer = new ResizeObserver(windowResize)
        resizer.observe(elm.value)
      }
    })

    onBeforeUnmount(() => {
      scrollTopCache = 0
      lastColumn = 0

      if (resizer) {
        resizer.disconnect()
        resizer = null
      }

      if (lockTimer.value) {
        clearTimeout(lockTimer.value)
        lockTimer.value = null
      }

      if (styleObj.value) {
        styleObj.value.remove()
        styleObj.value = null
      }
    })

    onActivated(() => {
      if (content.value&&elm.value) {
        elm.value.scrollTop = scrollTopCache
        let lastItem = positions.value[positions.value.length - 1]
        if (lastItem) {
          let height = lastItem.bottom
          updatePhantomStyle(height + 'px')
          column.value = lastColumn
          content.value.style.transform = `translate3d(0,${startOffset.value}px,0)`
        }
      }
      active.value = true
    })

    onDeactivated(() => {
      active.value = false
      lastColumn = column.value
    })

    onUpdated(() => {
      if (!active.value) {
        return;
      }
      //列表数据长度不等于缓存长度
      if (_listData.value.length !== positions.value.length) {
        initPositions();
        unlockScroll()
      }
      afterRenderUpdated()
    })

    // computed
    const elm:ComputedRef<HTMLElement>=computed(() => {
      return virtualList.value as HTMLElement
    })

    const _listData = computed(() => {
      if (column.value === 0 || !ready.value) return []
      return props.listData.reduce((init:any, cur:any, index:number) => {
        let item = cur;
        item._index=index
        if (index % column.value === 0 || index === 0) {
          init.push({
            _key: `_${index === 0 ? 0 : index / column.value}_${index}`,
            _startIndex: index,
            value: []
          })
        }
        let dataIndex = Math.max(0, init.length - 1)
        init[dataIndex].value.push(item)
        init[dataIndex]._endIndex = index
        return init
      }, [])
    })

    const anchorPoint = computed(() =>
      positions.value.length ? positions.value[start.value] : null
    )

    const visibleCount = computed(() =>
      Math.ceil(screenHeight.value / props.itemHeight)
    )

    const aboveCount = computed(() =>
      Math.min(start.value, props.bufferScale * visibleCount.value)
    )

    const belowCount = computed(() =>
      Math.min(props.listData.length - end.value, props.bufferScale * visibleCount.value)
    )

    const renderListData = computed(() => {
      let startIndex = start.value - Math.max(0, aboveCount.value)
      let endIndex = end.value + Math.max(1, belowCount.value)
      return _listData.value.slice(startIndex, endIndex)
    })

    const virtualStyle = computed(() => {
      let item = positions.value[positions.value.length - 1]
      return `${item ? item.bottom : 0}px`
    })

    const nowSelectIndex = computed(() => {
      let data:number[] = []
      if (!props.itemWidth && props.calcGroupSelect) {
        props.listData.forEach((item:any, index:number) => {
          if (item[props.selectField]) {
            data.push(index)
          }
        })
      }
      return data
    })

    const groupByIndex = computed(() => {
      let arr = nowSelectIndex.value
      if (arr.length === 0) return []

      let result:any = [], i = 0
      const sortedList = arr.sort((a, b) => a - b)

      sortedList.forEach((item, index) => {
        if (index === 0) {
          result[0] = [item]
        } else if (item - sortedList[index - 1] === 1) {
          result[i].push(item)
        } else {
          result[++i] = [item]
        }
      })
      return result
    })

    const listHeight = computed(() => ({
      height: props.absoluteHeight ? virtualStyle.value : props.height
    }))

    // watch
    watch(() => props.itemWidth, () => {
      renderConfigChange(true)
    })

    watch(listHeight, () => {
      renderConfigChange()
    })

    // methods
    const checkStyleObj = () => {
      if (!styleObj.value) {
        styleObj.value = document.createElement('style')
        styleObj.value.style.display = 'none'
        elm.value.appendChild(styleObj.value)
      }
      styleObj.value.innerText = `.${randomClass.value} .virtual-item.w{width:${props.itemWidth}px;flex-shrink:0}`
    }

    const startRender = () => {
      getSizeInfo()
      start.value = 0
      end.value = start.value + visibleCount.value
      renderCallback()
      setStartOffset()
    }

    const handleResize = () => {
      if (!active.value || !elm.value?.offsetHeight) {
        preventAutoScroll.value = false
        return
      }

      getSizeInfo()
      renderCallback()
      nextTick(() => {
        scrollEvent({
          target: elm.value
        }, true)
      })
    }

    const windowResize = _.debounce(handleResize, 100)

    const renderConfigChange = (calcSize = false) => {
      if (!props.itemWidth) {
        column.value = 1
      }
      if (calcSize) {
        initPositions()
        checkStyleObj()
      }
      handleResize()
    }

    const getSizeInfo = () => {
      if (!elm.value) {
        return
      }

      try {
        let height = Math.max(elm.value.clientHeight, -1)
        //@ts-ignore
        screenHeight.value = height > 0 ? height : (elm.value.parentNode ? elm.value.parentNode.clientHeight : 0)
        if (props.itemWidth) {
          let count = Math.floor(elm.value.offsetWidth / props.itemWidth)
          column.value = Math.max(1, count)
        }
      } catch (e) {
        screenHeight.value = 0
      }
    }

    const getRenderItems = () => {
      return elm.value?elm.value.querySelectorAll('.virtual-item-group'):[]
    }

    //数据变更渲染后重新计算
    const afterRenderUpdated = () => {
      nextTick(() => {
        let data = getRenderItems();
        getSizeInfo()
        if (!data || !data.length) {
          updatePhantomStyle(props.absoluteHeight?virtualStyle.value:'0px')
          return;
        }
        //获取真实元素大小，修改对应的尺寸缓存
        updateItemsSize();
        let height = positions.value[positions.value.length - 1].bottom;
        updatePhantomStyle(height + 'px')
        //更新真实偏移量
        setStartOffset()
      });
    }
    //防抖处理，设置滚动状态
    const scrollEnd = _.debounce((event:MouseEvent, data:ScrollData) => {
      if (active.value) {
        emit('scrollEnd', event, data)
      }
    }, 100)

    const scrollingEvent = (event:MouseEvent, data:ScrollData) => {
      oldScrollTop.value = data.scrollTop
      if (active.value) {
        emit('scrolling', event, data)
      }
    }

    const initPositions = () => {
      let positionList:PosData[] = []
      for (let index = 0; index < _listData.value.length; index++) {
        positionList.push({
          index,
          height: props.itemHeight,
          top: index * props.itemHeight,
          bottom: (index + 1) * props.itemHeight
        })
      }
      positions.value = positionList
    }

    const getStartIndex = (scrollTop = 0) => {
      return Math.max(binarySearch(positions.value, scrollTop), 0)
    }

    const binarySearch = (list:any, value:number) => {
      let start = 0
      let end = list.length - 1
      let tempIndex = -1

      while (start <= end) {
        let midIndex = Math.floor((start + end) / 2)
        let midValue = list[midIndex].bottom

        if (midValue === value) {
          return midIndex + 1
        } else if (midValue < value) {
          start = midIndex + 1
        } else if (midValue > value) {
          if (tempIndex === -1 || tempIndex > midIndex) {
            tempIndex = midIndex
          }
          end = end - 1
        }
      }
      return tempIndex
    }

    //获取列表项的当前尺寸
    const updateItemsSize = () => {
      let renderItem=getRenderItems()
      renderItem.forEach((node:Element) => {
        let rect = node.getBoundingClientRect()
        let height = rect.height
        let index = +node.id.replace(/^_(\d+).*/, '$1')
        let oldHeight = positions.value[index]?.height

        if (!oldHeight) return

        let dValue = oldHeight - height
        if (dValue) {
          positions.value[index].bottom = positions.value[index].bottom - dValue
          positions.value[index].height = height
          for (let k = index + 1; k < positions.value.length; k++) {
            positions.value[k].top = positions.value[k - 1].bottom
            positions.value[k].bottom = positions.value[k].bottom - dValue
          }
        }
      })
    }

    const setStartOffset = () => {
      let offset = 0
      try {
        if (start.value >= 1) {
          let size = positions.value[start.value].top -
            (positions.value[start.value - aboveCount.value]?.top || 0)
          offset = positions.value[start.value - 1].bottom - size
        }
      } catch (e) {
        offset = 0
      }

      startOffset.value = offset
      if (content.value) {
        content.value.style.transform = `translate3d(0,${offset}px,0)`
      }
    }

    const getScrollHeight = () => {
      return phantom.value?.offsetHeight || 0
    }

    const scrollEvent = (e:any, force = false) => {
      if (!e?.target) return

      let element = e.target
      let scrollTop = element.scrollTop

      if (scrollTopCache !== scrollTop && active.value) {
        emit('scroll', e)
      }

      scrollTopCache = scrollTop
      let scrollHeight = getScrollHeight()

      if (force || !anchorPoint.value ||
        scrollTop > anchorPoint.value.bottom ||
        scrollTop < anchorPoint.value.top) {
        start.value = getStartIndex(scrollTop)
        end.value = start.value + visibleCount.value
        setStartOffset()
      }

      //触发外部滚动事件
      let direction = (scrollTop - oldScrollTop.value >= 0) ? 'down' : 'up'
      let data:ScrollData = {
        start: start.value * column.value,
        end: Math.min(end.value * column.value, props.listData.length - 1),
        startOffset: startOffset.value,
        scrollTop,
        direction
      }

      if (oldScrollTop.value && lastDirection.value &&
        lastDirection.value !== direction) {
        preventAutoScroll.value = true
        unlockScroll()
      }

      lastDirection.value = direction
      scrollingEvent(e, data)
      scrollEnd(e, data)

      if (scrollHeight <= element.clientHeight) return
      if (lockScroll.value) return

      if (((scrollHeight - scrollTop - props.scrollEndDistance) <= element.clientHeight) &&
        direction === 'down') {
        lockScroll.value = true
        scrollDownEvent(scrollHeight)
        unlockScroll()
      }
    }

    const scrollDownEvent = _.debounce((scrollHeight:number) => {
      if (scrollHeight === getScrollHeight()) {
        emit('scrollDown')
      }
    }, 100)

    const unlockScroll = () => {
      if (!props.scrollLockTime) {
        lockScroll.value = false
        preventAutoScroll.value = false
        return
      }

      if (lockTimer.value) {
        clearTimeout(lockTimer.value)
        lockTimer.value = null
      }

      lockTimer.value = setTimeout(() => {
        lockScroll.value = false
        preventAutoScroll.value = false
        if (lockTimer.value) {
          clearTimeout(lockTimer.value)
          lockTimer.value = null
        }
      }, props.scrollLockTime)
    }

    //鼠标框选
    const handleMouseSelect = (data:any) => {
      let start = data.start
      let end = data.end
      let area_data = {
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y) - startOffset.value,
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
      }

      let selList:NodeListOf<HTMLElement> = elm.value.querySelectorAll(props.mouseSelectSelector + '[data-index]')

      for (let i = 0; i < selList.length; i++) {
        let elm = selList[i]
        let index = Number(elm.dataset.index)
        if (props.accuratePosition) {
          //@ts-ignore
          elm = elm.children[0] || elm
        }

        let item = props.listData[index]
        if (!item) break

        let rect = elm.getBoundingClientRect()
        let sl = rect.width + elm.offsetLeft,
          st = rect.height + elm.offsetTop
        let area_l = area_data.left + area_data.width
        let area_t = area_data.top + area_data.height

        if (sl > area_data.left && st > area_data.top &&
          elm.offsetLeft < area_l && elm.offsetTop < area_t) {
          if (item[props.selectField] !== true) {
            item[props.selectField] = true
          }
        } else {
          if (item[props.selectField]) {
            item[props.selectField] = false
          }
        }
      }

      emit('update:listData', props.listData)
    }

    const handleDragEnd = () => {
      emit('select-end')
    }

    const handleDragging = (state:boolean) => {
      emit('update:dragging', state)
    }

    //计算当前节点的选中
    const activeGroupPosition = (item:any, index:number) => {
      let data = groupByIndex.value
      let result = { start: false, end: false }

      if (!props.calcGroupSelect || data.length === 0 ||
        !item[props.selectField] || props.itemWidth) {
        return result
      }

      for (let i = 0; i < data.length; i++) {
        let group_item = data[i]
        if (group_item.includes(index)) {
          if (group_item.length === 1) {
            result = { start: true, end: true }
            break
          }
          let flag = group_item.indexOf(index)
          result = {
            start: flag === 0,
            end: flag === group_item.length - 1
          }
          break
        }
      }
      return result
    }

    const scrollTo = async (index = 0, anim = true, first = true) => {
      if (index < 0 || preventAutoScroll.value) return

      if (first) {
        await nextTick()
      }

      let listIndex: number
      let scrollTop = 0
      let currentScrollHeight = getScrollHeight()

      if (props.itemWidth) {
        listIndex = Math.floor(Math.max(Math.abs(index / column.value), 0))
      } else {
        listIndex = Math.min(index, _listData.value.length - 1)
      }

      try {
        scrollTop = positions.value[listIndex].top
        scrollTop = Math.floor(scrollTop)
      } catch (e) {
        scrollTop = 0
      }

      if (scrollTop === 0) {
        elm.value.scrollTo({
          left: 0,
          top: scrollTop,
          behavior: anim ? 'smooth' : 'auto'
        })
        return
      }

      if (elm.value.offsetHeight && scrollTop <= elm.value.offsetHeight) {
        return
      }

      await nextTick()
      elm.value.scrollTo({
        left: 0,
        top: scrollTop,
        behavior: anim ? 'smooth' : 'auto'
      })

      scrollEvent({
        target: elm.value
      }, true)

      if (getScrollHeight() !== currentScrollHeight) {
        await scrollTo(index, anim, false)
        return
      }

      let currentScrollTop = Math.floor(elm.value.scrollTop)
      let diff = Math.abs(currentScrollTop - scrollTop) > (props.itemHeight / 2)

      let a=setTimeout(async () => {
        clearTimeout(a)
        if (currentScrollTop !== scrollTop && !lockScroll.value) {
          if (diff) {
            await scrollTo(index, anim, false)
          }
        } else if (currentScrollTop === scrollTop) {
          unlockScroll()
        }
      }, 100)
    }

    const renderCallback = () => {
      emit("callback", {
        columns: column.value,
        end: end.value,
        start: start.value
      })
    }

    const updatePhantomStyle = (height:string) => {
      if (phantom.value) {
        phantom.value.style.height = height
      }
    }

    // 暴露方法
    expose({
      scrollTo,
    })

    // render 函数
    return () => h('section', {
      ref: virtualList,
      class: ['virtual-list', randomClass.value],
      style: listHeight.value,
      ...renderHelper({
        'data-w': props.itemWidth,
        'data-h': props.itemHeight,
      }, { scroll: scrollEvent })
    }, [
      //撑起列表高度
      h('div', {
        ref: phantom,
        class: 'virtual-list-phantom'
      }),
      //渲染容器
      h('div', {
        ref: content,
        class: 'virtual-list-container',
        style: { transform: `translate3d(0,${startOffset.value}px,0)` }
      }, renderListData.value.map((row:any) => {
        //渲染组
        return h('div', {
          class: ['virtual-item-group', { flex: column.value !== 1 }],
          ...renderHelper({
            id: row._key,
          }),
          key: row._key
        }, row.value.map((item:any) =>
          h('div', {
            class: 'virtual-item w',
            key: `${row._key}-${item._index}`,
            ...renderHelper({
              'data-index': item._index
            })
          }, [
            slots.default?.({
              item: item,
              index: item._index,
              select: activeGroupPosition(item, item._index)
            })
          ])
        ))
      })),
      slots.after?.(),
      props.mouseSelect && elm.value && h(selectRegion, {
        ...propsHelper({
          itemHeight: props.itemHeight,
          autoScrollHeight: props.autoScrollHeight,
          getScrollHeight: getScrollHeight,
          regionArea: () => {
            return elm.value
          },
          regionClass: props.mouseAreaClassName,
          beforeMouseSelect: props.beforeMouseSelect,
        }),
        ...renderHelper({}, {
          selectEnd: handleDragEnd,
          dragging: handleDragging,
          select: handleMouseSelect
        })
      })
    ])
  }
}
