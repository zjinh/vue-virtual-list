import {h, ref, onMounted, onBeforeUnmount, getCurrentInstance, computed, ComputedRef, Ref} from 'vue'
export default {
  name: 'selectRegion',
  props: {
    regionArea: {
      //父级元素传进来, 用于获取父级元素的scrollTop/scrollLeft
      type: Function,
      default: null
    },
    //鼠标选择class
    regionClass: {
      type: String,
      default: 'default'
    },
    autoScrollHeight: {
      type: Number,
      default: 0
    },
    getScrollHeight: {
      type: Function,
      default: () => '0px'
    },
    beforeMouseSelect: {
      type: Function,
      default: () => true
    }
  },

  setup(props:any, { emit }) {
    const instance = getCurrentInstance();
    const mouseSelectData = ref({
      left: '0',
      top: '0',
      width: '0',
      height: '0'
    })

    const startPos = ref({
      x: 0,
      y: 0
    })

    const showMouseSelect = ref(false)
    const dragging = ref(false)
    const areaInfo:Ref<{ height: number; width: number; top: number; left: number }> = ref({
      height: 0,
      width: 0,
      top: 0,
      left: 0
    })
    const scrollInterval:Ref<NodeJS.Timeout|null> = ref(null)
    const el:ComputedRef<HTMLElement> = computed(() => {
      return instance!.proxy.$el as HTMLElement
    })

    const clearSelection = () => {
      mouseSelectData.value = {
        left: '0',
        top: '0',
        width: '0',
        height: '0'
      }
      document.onmousemove = null
      //@ts-ignore
      document.onmousewheel = null
      document.onmousedown = null
      showMouseSelect.value = false
      if (dragging.value) {
        emit('selectEnd')
      }
      dragging.value = false
      setTimeout(() => {
        dragging.value = false
        emit('dragging', false)
      }, 200)
    }

    const stopAutoScroll = () => {
      if (scrollInterval.value) {
        clearInterval(scrollInterval.value)
        scrollInterval.value = null
      }
    }

    const handleMouseMove = (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.buttons === 2) {
        return
      }
      if (!dragging.value) {
        dragging.value = true
        emit('dragging', true)
      }

      let area = props.regionArea()
      showMouseSelect.value = true
      let end = {
        x: ev.clientX - areaInfo.value.left + area.scrollLeft,
        y: ev.clientY - areaInfo.value.top + area.scrollTop
      }
      let start = startPos.value

      mouseSelectData.value = {
        left: Math.min(start.x, end.x) + 'px',
        top: Math.min(start.y, end.y) + 'px',
        width: Math.abs(end.x - start.x) + 'px',
        height: Math.abs(end.y - start.y) + 'px'
      }

      emit('select', { start, end })

      if (props.autoScrollHeight) {
        checkAutoScroll(ev)
      }
    }

    const startAutoScroll = (speed, ev) => {
      if (scrollInterval.value) return

      let area = props.regionArea()
      areaInfo.value = area.getBoundingClientRect()
      let maxScrollTop = props.getScrollHeight() - areaInfo.value.height

      scrollInterval.value = setInterval(() => {
        if (speed < 0 && area.scrollTop > 0) {
          area.scrollTop = Math.max(0, area.scrollTop + speed)
        } else if (speed > 0 && area.scrollTop < maxScrollTop) {
          area.scrollTop = Math.min(maxScrollTop, area.scrollTop + speed)
        } else {
          stopAutoScroll()
        }

        let end = {
          x: ev.clientX - areaInfo.value.left + area.scrollLeft,
          y: ev.clientY - areaInfo.value.top + area.scrollTop
        }
        let start = startPos.value

        mouseSelectData.value = {
          left: Math.min(start.x, end.x) + 'px',
          top: Math.min(start.y, end.y) + 'px',
          width: Math.abs(end.x - start.x) + 'px',
          height: Math.abs(end.y - start.y) + 'px'
        }

        emit('select', { start, end })
      }, 16)
    }

    const checkAutoScroll = (ev) => {
      let scrollMargin = props.autoScrollHeight
      let autoScrollSpeed = 10

      if (ev.clientY - areaInfo.value.top < scrollMargin) {
        startAutoScroll(-autoScrollSpeed, ev)
      } else if (areaInfo.value.height - (ev.clientY - areaInfo.value.top) < scrollMargin) {
        startAutoScroll(autoScrollSpeed, ev)
      } else {
        stopAutoScroll()
      }
    }

    const handleMouseSelect = (event) => {
      if (!props.beforeMouseSelect()) return

      let area = props.regionArea()
      areaInfo.value = area.getBoundingClientRect()
      let start = {
        x: event.clientX - areaInfo.value.left + area.scrollLeft,
        y: event.clientY - areaInfo.value.top + area.scrollTop
      }
      startPos.value = start
      mouseSelectData.value.left = start.x.toString()
      mouseSelectData.value.top = start.y.toString()

      document.onmouseup = () => {
        stopAutoScroll()
        clearSelection()
      }

      document.onmousemove = (ev) => {
        if (scrollInterval.value) {
          stopAutoScroll()
        }
        handleMouseMove(ev)
      }
    }

    onMounted(() => {
      if (el.value?.parentNode) {
        el.value.parentNode.addEventListener('mousedown', handleMouseSelect)
      }
    })

    onBeforeUnmount(() => {
      if (el.value?.parentNode) {
        el.value.parentNode.removeEventListener('mousedown', handleMouseSelect)
      }
      if (scrollInterval.value) {
        clearInterval(scrollInterval.value)
      }
    })

    return () => showMouseSelect.value && h('div', {
      class: ['mouse-area', props.regionClass || 'default'],
      style: mouseSelectData.value
    })
  }
}
