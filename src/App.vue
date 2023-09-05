<script setup>
import mitt from './components/global-upload/src/mitt/index'
import BaseUploader from './components/global-upload/index'
const openUpload = () => {
  mitt.emit('openUploader', {
    accept: ['.sdpc', '.ndpi', '.tif', '.mp4'],
    params: {
      caseId: 1774,
      sectionType: 2,
    },
  })
}
</script>

<template>
  <div>
    <el-button @click="openUpload">点击上传</el-button>
    <BaseUploader></BaseUploader>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
