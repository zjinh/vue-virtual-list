<template>
  <div class="mouse-area" :class="regionClass ? regionClass : 'default'" :style="mouseSelectData" />
</template>

<script>
export default {
  name: 'selectRegion',
  props: {
    regionArea: {
      //父级元素传进来, 用于获取父级元素的scrollTop/scrollLeft
      type: HTMLElement,
      default: null
    },
    //鼠标选择class
    regionClass: {
      type: String,
      default: function () {
        return 'default';
      },
    },
  },
  data() {
    return {
      mouseSelectData: {
        left: '0',
        top: '0',
        width: '0',
        height: '0',
      },
      dragging: false,
      areaInfo: {}
    };
  },
  mounted() {
    document.documentElement.addEventListener('mousedown', this.handleMouseSelect, true)
  },
  beforeDestroy: function() {
    document.documentElement.removeEventListener('mousedown', this.handleMouseSelect, true)
  },
  methods: {
    handleMouseSelect(event) {
      let area = this.regionArea;
      this.areaInfo=area.getBoundingClientRect()
      let start = {
        x: event.clientX - this.areaInfo.left + area.scrollLeft,
        y: event.clientY - this.areaInfo.top + area.scrollTop,
      };
      this.mouseSelectData.left = start.x.toString();
      this.mouseSelectData.top = start.y.toString();
      document.onmouseup = () => {
        this.mouseSelectData = {
          left: '0',
          top: '0',
          width: '0',
          height: '0',
        };
        document.onmousemove = null;
        document.onmousewheel=null
        document.onmousedown = null;
        this.showMouseSelect = false;
        let a = setTimeout(() => {
          this.dragging=false
          this.$emit('dragging', false)
          clearTimeout(a)
        }, 200)
      };
      document.onmousemove = (ev) => {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.buttons === 2) return;
        if (!this.dragging) {
          this.dragging=true
          this.$emit('dragging', true)
        }
        this.showMouseSelect = true;
        let end = {
          x: ev.clientX - this.areaInfo.left + area.scrollLeft,
          y: ev.clientY - this.areaInfo.top + area.scrollTop,
        };
        this.mouseSelectData = {
          left: Math.min(start.x, end.x) + 'px',
          top: Math.min(start.y, end.y) + 'px',
          width: Math.abs(end.x - start.x) + 'px',
          height: Math.abs(end.y - start.y) + 'px',
        };
        this.$emit('select', {
          start,
          end,
        })
      };
    },
  }
};
</script>

<style scoped>
.mouse-area {
  position: absolute;
  z-index: 2;
}
.mouse-area.default {
  background-color: #3388ff94;
  border: 1px solid #38f;
}
</style>
