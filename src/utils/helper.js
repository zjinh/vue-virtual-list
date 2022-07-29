const helper={
    oldSelectIndex:-1,
    lastActionIndex:-1,
    selectField:'isSelected',
    multipleSelect:false,
    itemHeight:0,
    isBlockMap:false, //是否是缩略图模式
    //防抖
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
    },
    //方向键选择
    initArrowSelect(config){
        this.selectField=config.selectField
        this.multipleSelect=config.multipleSelect
        this.itemHeight=config.itemHeight
        this.isBlockMap=config.itemWidth&&config.itemWidth!==0
        this.getData=config.getData
        document.addEventListener('keydown', this.handleArrowSelect);
        document.addEventListener('keyup', this.keyUpHandler);
    },
    removeArrowSelect(){
        document.removeEventListener('keydown', this.handleArrowSelect);
        document.removeEventListener('keyup', this.keyUpHandler);
    },
    getData:()=>{
        return []
    },
    getSelectIndex(data,last = false) {
        if (last) {
            for (let index = data.length - 1; index >= 0; index--) {
                const element = data[index];
                if (element[this.selectField]) return index;
            }
        } else {
            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                if (element[this.selectField]) return index;
            }
        }
        return 0;
    },
    setSelectState(data,aIndex, shiftMode = false) {
        this.lastActionIndex = -1;
        let item = {};
        for (let index = 0, len = data.length; index < len; index++) {
            item = data[index];
            item[this.selectField] = false;
        }
        if (shiftMode) {
            this.oldSelectIndex = this.oldSelectIndex === -1 ? aIndex : this.oldSelectIndex;
            let startIndex = this.oldSelectIndex > aIndex ? aIndex : this.oldSelectIndex;
            let endIndex = this.oldSelectIndex + aIndex - startIndex;
            let isToMore = startIndex < this.oldSelectIndex;
            if (!isToMore) {
                this.lastActionIndex = endIndex;
            } else {
                this.lastActionIndex = startIndex;
            }
            for (let index = startIndex, len = endIndex; index <= len; index++) {
                item = data[index];
                item[this.selectField] = true;
            }
        } else {
            data[aIndex][this.selectField] = true;
        }
        return data;
    },
    //方向键选择
    keyUpHandler(e) {
        if (!e.shiftKey) {
            this.oldSelectIndex = -1;
            this.lastActionIndex = -1;
        }
    },
    handleArrowSelect(e,data) {
        data=this.getData()
        if (this.isBlockMap) {
            return;
        }
        if (data.length < 2) {
            return;
        }
        let shiftHold = e.shiftKey && this.multipleSelect; //是否按住shift
        let actionDirection = e.key; //操作方向
        let firstSelectIndex = Math.max(this.lastActionIndex, this.getSelectIndex(data));
        if (shiftHold && this.oldSelectIndex === -1) {
            this.oldSelectIndex = firstSelectIndex;
        }
        let actionIndex = firstSelectIndex; //当前选中的下标
        let isDirection = actionDirection.includes('Arrow');
        if (isDirection) {
            e.preventDefault();
        }
        //计算新的index
        switch (actionDirection) {
            case 'ArrowUp':
                if (firstSelectIndex === 0) {
                    return;
                }
                if (this.isBlockMap) {
                    actionIndex = Math.max(firstSelectIndex - this.column, 0);
                } else {
                    actionIndex = firstSelectIndex - 1;
                }
                break;
            case 'ArrowDown':
                if (firstSelectIndex === data.length - 1) {
                    return;
                }
                if (this.isBlockMap) {
                    actionIndex = firstSelectIndex + this.column;
                    if (actionIndex >= data.length) {
                        if (Math.floor(firstSelectIndex / this.column) === Math.floor(data.length / this.column)) {
                            //判断当前选择的和最后一列是不是同一列
                            return;
                        }
                        actionIndex = data.length - 1;
                    }
                } else {
                    actionIndex = firstSelectIndex + 1;
                }
                break;
            case 'ArrowLeft':
                if (this.isBlockMap) {
                    actionIndex = firstSelectIndex - 1;
                }
                break;
            case 'ArrowRight':
                if (this.isBlockMap) {
                    actionIndex = firstSelectIndex + 1;
                }
                break;
        }
        if (!data[actionIndex] || actionIndex === firstSelectIndex) {
            return;
        }
        //更新滚动条位置
        if (this.isBlockMap) {
            //结束点计算
            /*let endIndex=this.end;
            let endRow=this.positions[endIndex]
            if (!endRow) {
              endIndex--
              endRow=this.positions[endIndex]
            }
            let isOverFlow=endRow.bottom> this.screenHeight;
            if (isOverFlow) {
              while (isOverFlow) {
                endIndex--
                endRow=this.positions[endIndex]
                isOverFlow=endRow.bottom> this.screenHeight;
              }
            }

            let renderStart=this.start+this.aboveCount
            let renderEnd=renderStart+endIndex-1
            console.log(renderStart, renderEnd, this._listData.length)
            let renderIndex={
              start: this._listData[renderStart]._index,
              end: this._listData[renderEnd]._index
            }
            console.log(renderIndex)
            let actionRowIndex=Math.floor(actionIndex/this.column)
            if (actionRowIndex>renderIndex.end) {
              this.$el.scrollTop += this.itemHeight;
            } else if (actionRowIndex<renderIndex.start) {
              this.$el.scrollTop -= this.itemHeight;
            }
            let dataLength = this.renderListData.length;*/
            /*if (actionIndex > showMaxItems) {
              //超过当前屏幕显示在下方
              // this.$el.scrollTop = this.itemHeight * (Math.floor(actionIndex / this.column) - dataLength + 2);
            } else if (actionIndex < (this.start+1) * this.column) {
              //超过当前屏幕显示，在上方
              this.$el.scrollTop -= this.itemHeight// * (Math.floor(actionIndex / this.column));
            }*/
            /*if (actionIndex >= showMaxItems) {
              //需要向下换行
              this.$el.scrollTop += this.itemHeight;
            } else if (actionIndex < (this.start+1) * this.column) {
              //需要向上换行
              this.$el.scrollTop -= this.itemHeight;
            }*/
        } else {
            if (actionIndex > this.end) {
                //超过当前屏幕显示,在下方
                this.scrollTop = this.itemHeight * actionIndex;
            } else if (actionIndex < this.start) {
                //超过当前屏幕显示，在上方
                this.scrollTop = this.itemHeight * actionIndex;
            }
            if (actionIndex + 2 >= this.end && actionDirection === 'ArrowDown') {
                this.scrollTop += this.itemHeight;
            } else if (actionIndex <= this.start && actionDirection === 'ArrowUp') {
                this.scrollTop -= this.itemHeight;
            }
        }
        this.lastActionIndex = actionIndex;
        this.setSelectState(data,actionIndex, shiftHold);
    },
}
export default helper