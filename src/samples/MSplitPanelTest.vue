<template>
  <div class="parent">
    <div>
      <b-button-group class="mx-1" style="">
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='p1' >p1</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='p2' @click="togglePane">p2</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='p3' @click="togglePane">p2</b-btn>
        <b-btn size='sm' variant='outline-secondary' :pressed.sync='p4' @click="togglePane">p4</b-btn>
      </b-button-group>
      test: {{test}}
    </div>
    <MSplitPanel ref="mpanel" :params='p1'>
      <div slot="p1" :size=300  :min=250  :max=350 :show='p1' style="background-color:red;width:100%"> Panel1 </div>
      <div slot="p2" :grow='10' :show='p2' :test.sync='test'> Panel2</div>
      <div slot="p3" :grow='20' :show='p3' :test.sync='test'> Panel3 </div>
      <div slot="p4" :size='200' :show='p4' :test.sync='test'> Panel4 </div>
    </MSplitPanel>
  </div>
</template>

<script>
import MSplitPanel from '../components/MSplitPanel.vue';
import { PaneStatus } from '../components/PaneSet';

export default {
  name: 'MSplitPanelTest',
  components: {
    MSplitPanel,
  },
  props: {
    id: String,
  },
  data() {
    return {
      p1: true,
      p2: true,
      p3: true,
      p4: true,
      test: 1,
    };
  },
  methods: {
    togglePane() {
      this.setOnePane('p1', this.p1);
      this.setOnePane('p2', this.p2);
      this.setOnePane('p3', this.p3);
      this.setOnePane('p4', this.p4);
    },
    setOnePane(name, btn) {
      const mp = this.$refs.mpanel;
      mp.setPaneStatus(name, btn ? PaneStatus.NORMAL : PaneStatus.MIIMIZED);
    },
  },
};
</script>
<style scoped>
.parent {
  width:90%;
  background-color:rgba(0, 128, 0, 0.1);
  align-self: center;
}
</style>

