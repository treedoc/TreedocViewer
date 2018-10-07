<template>
  <div class="container">
    <template v-for="n in numSlots">
      <div>
        
      </div>
    </template>

</template>
<script>
export default {
  props: {
    numSlots: Number,

        
  }
}
</script>
<style scoped>
.container {
  position: relative;
  box-sizing: border-box;
  border-collapse: collapse;
  width: 100%;
  height: 100%;
  display: flex;
}

</style>


