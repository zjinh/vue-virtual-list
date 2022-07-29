import virtualList from './components/virtualList.vue'

if (typeof window !== 'undefined' && window.Vue) {
    window.Vue.component('virtualList', virtualList)
}

virtualList.install = function(Vue){
    Vue.component('virtualList', virtualList)
}

export default virtualList;