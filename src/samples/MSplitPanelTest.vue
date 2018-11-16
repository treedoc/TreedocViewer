<template>
  <div>
    <MSplitPanel :initPositions='[100, 200]'>
      <div slot="0" :size='33' :min='10' :max='1000'> Panel0 </div>
      <div slot="1"> Panel1 </div>
      <div slot="2"> Panel2 </div>
      <div slot="3" :size='33'> Panel3 </div>
    </MSplitPanel>
  </div>
</template>

<script>
import MSplitPanel from '../components/MSplitPanel.vue';

export default {
  name: 'MSplitPanelTest',
  components: {
    MSplitPanel,
  },
  props: {
    id: String,
  },
};
</script>

