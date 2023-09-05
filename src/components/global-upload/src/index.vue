<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'

import uploadEnum, { setStatus, statusObj } from './utils/uploadEnum'
import {
  checkFile,
  getHash,
  generateMD5,
  getChunkFormData,
  conversionSize,
} from './utils/utils'
import { getCheck, mergeSimpleUpload, getCurrentChunk } from './api'
import request from './service'
import axios from 'axios'
import mitt from './mitt/index.js'

const props = defineProps({
  accept: {
    type: Array,
    default: () => ['.sdpc', '.ndpi', '.tif', '.mp4'],
  },
  multiple: {
    type: Boolean,
    default: true,
  },
  chunkSize: {
    type: Number,
    default: 5 * 1024 * 1024,
  },
  maxSize: {
    type: Number,
    default: 5 * 1024 * 1024 * 1024,
  },
  sizeUnit: {
    type: String,
    default: 'MB',
  },
  maxUploadCount: {
    type: Number,
    default: 5,
  },
  params: {
    type: Object,
  },
})
const totalAccept = ref(props.accept)
const totalMultiple = ref(props.multiple)
const totalChunkSize = ref(props.chunkSize)
const totalMaxSize = ref(props.maxSize)
const totalMaxUploadCount = ref(props.maxUploadCount)
const totalParams = ref(props.params)

const uploadList = ref([])
const inputRef = ref(null)
const cancelList = {}
const abortList = {}
const handleFileChange = async (e) => {
  if (!isOpenUpload.value) {
    isOpenUpload.value = true
  }
  const files = e.target.files
  if (!files) return
  let filterArr = checkFile(
    e.target.files,
    totalAccept.value,
    totalMaxSize.value
  )
  let fileNames = filterArr.map((item) => {
    return item.file.name
  })
  try {
    let res = await getCheck({
      caseId: totalParams.value.caseId,
      fileNames: fileNames,
    })
    if (res?.code === 200) {
      let originLength = uploadList.value.length
      filterArr.forEach((file) => {
        file.fileId = getHash()
        file.progress = 0
        file.md5Progress = 0
        file.preStatus = ''
        file.status = statusObj.check
        file.params = totalParams.value
        file.speed = 0
        file.ifReset = 0
        file.startTime = new Date()
        uploadList.value.push(file)
      })
      for (let i = filterArr.length; i > 0; i--) {
        computeMD5(uploadList.value[originLength + i - 1])
      }
      // 为了可以选择重复文件
      inputRef.value.value = ''
    } else {
      ElMessage.error({
        message: '上传失败',
      })
    }
  } catch (error) {
    ElMessage.error({
      message: '上传失败',
    })
  }
}
const computeMD5 = async (file) => {
  const { abort } = generateMD5(file.file, totalChunkSize.value, {
    onProgress(currentChunk, chunks) {
      let md5Progress
      // 实时展示MD5的计算进度
      if (chunks !== 0) {
        md5Progress = parseInt(((currentChunk / chunks) * 100).toFixed(0))
      } else {
        md5Progress = 100
      }
      setStatus(file, 'md5Progress', md5Progress)
    },
    onSuccess(md5, chunksList) {
      console.log('md5: ', md5)
      setStatus(file, 'status', statusObj.ready)
      file.chunksList = chunksList
      md5Success(file, md5, chunksList)
    },
    onError() {
      setStatus(file, 'status', statusObj.reject)
      ElMessage({
        type: 'error',
        message: '文件校验失败',
        duration: 5000,
        showClose: true,
      })
    },
  })
  abortList[file.fileId] = abort
  if (!abortList[file.fileId]) {
    abortList[file.fileId] = {}
    const obj = abortList[file.fileId]
    obj.abort = abort
  } else {
    const obj = abortList[file.fileId]
    obj.abort = abort
  }

  // const { abort, pause, start } = generateMD5(file.file, totalChunkSize.value, {
  //   onProgress(currentChunk, chunks) {
  //     let md5Progress
  //     // 实时展示MD5的计算进度
  //     if (chunks !== 0) {
  //       md5Progress = parseInt(((currentChunk / chunks) * 100).toFixed(0))
  //     } else {
  //       md5Progress = 100
  //     }
  //     setStatus(file, 'md5Progress', md5Progress)
  //   },
  //   onSuccess(md5, chunksList) {
  //     console.log('md5: ', md5)
  //     setStatus(file, 'status', statusObj.ready)
  //     file.chunksList = chunksList
  //     md5Success(file, md5, chunksList)
  //   },
  //   onError() {
  //     setStatus(file, 'status', statusObj.reject)
  //     ElMessage({
  //       type: 'error',
  //       message: '文件校验失败',
  //       duration: 5000,
  //       showClose: true,
  //     })
  //   },
  // })
  // abortList[file.fileId] = abort
  // if (!abortList[file.fileId]) {
  //   abortList[file.fileId] = {}
  //   const obj = abortList[file.fileId]
  //   obj.abort = abort
  //   obj.pause = pause
  //   obj.start = start
  // } else {
  //   const obj = abortList[file.fileId]
  //   obj.abort = abort
  //   obj.pause = pause
  //   obj.start = start
  // }
}
const md5Success = (file, md5, chunksList) => {
  setStatus(file, 'md5', md5)
  startUpload(file, md5, chunksList)
}

// 已经上传成功的文件块
const uploadedChunks = {}
// 正在上传的列表
const uploadingChunks = []
let concurrentNum = totalMaxUploadCount.value
function uploadChunk(file, chunk, formData, totalCount) {
  return new Promise((resolve, reject) => {
    const startTime = new Date().getTime()
    request
      .request({
        url: '/file/uploader/chunk',
        method: 'post',
        data: formData,
        cancelToken: cancelList[file.fileId].token,
        onUploadProgress: (progressEvent) => {
          const uploaded = progressEvent.loaded
          const elapsedTime = (Date.now() - startTime) / 1000
          const speed = uploaded / elapsedTime / 1024
          file.speed = speed.toFixed(2)
          const progress = progressEvent.loaded / progressEvent.total
          chunk.progress = progress
          const sumProgress = file.chunksList.reduce(
            (accumulator, currentValue) => {
              return accumulator + currentValue.progress
            },
            0
          )
          const totalProgress = Math.floor((sumProgress / totalCount) * 100)
          file.progress = totalProgress
        },
      })
      .then((res) => {
        // 响应结果处理
        if (res === 200) {
          let uploaded = uploadedChunks[file.fileId]
          if (uploaded) {
            uploaded.push(chunk)
          } else {
            uploadedChunks[file.fileId] = []
            uploadedChunks[file.fileId].push(chunk)
            uploaded = uploadedChunks[file.fileId]
          }
          // const progress = parseInt(
          //   ((uploaded.length / totalCount) * 100).toFixed(0)
          // )
          // file.progress = progress
        }
        resolve()
      })
      .catch((err) => {
        reject(err)
      })
  })
}

function upload(file, chunks, md5, onAllSuccess, totalCount) {
  while (chunks.length && uploadingChunks.length < concurrentNum) {
    let chunk = chunks.shift()
    const formData = getChunkFormData(
      file,
      md5,
      chunk,
      totalChunkSize.value,
      totalCount
    )
    let promise = uploadChunk(file, chunk, formData, totalCount)
    uploadingChunks.push(promise)
    promise
      .then(() => {
        // 移除已经完成上传的文件块
        uploadingChunks.splice(uploadingChunks.indexOf(promise), 1)
      })
      .catch(() => {
        console.log('错误：', chunk)
        // 异常情况需要重新上传
        chunks.unshift(chunk)
        uploadingChunks.splice(uploadingChunks.indexOf(promise), 1)
      })
  }
  if (!chunks.length && !uploadingChunks.length) {
    if (uploadedChunks[file.fileId]?.length === totalCount) {
      if (onAllSuccess && typeof onAllSuccess == 'function') {
        onAllSuccess(file)
      }
    }
    return
  }
  // 递归调用继续上传剩余的文件块
  Promise.all(uploadingChunks).then(() => {
    upload(file, chunks, md5, onAllSuccess, totalCount)
  })
}

const startUpload = async (file, md5, chunksList) => {
  setStatus(file, 'status', statusObj.uploading)
  const source = axios.CancelToken.source()
  cancelList[file.fileId] = source
  try {
    let res = await getCurrentChunk({
      identifier: md5,
      filename: file.file.name,
      caseId: totalParams.value.caseId,
      sectionType: totalParams.value.sectionType,
      totalSize: file.file.size,
    })
    if (res?.status === '3') {
      const totalCount = chunksList.length
      if (Array.isArray(chunksList)) {
        chunksList.forEach((item) => {
          item.progress = 0
        })
      }
      const chunksListClone = [...chunksList]
      upload(file, chunksListClone, md5, onAllSuccess, totalCount)
    }
    // 秒传
    if (res?.status == '1') {
      console.log('秒传')
      ElMessage({
        message: file.file.name + '上传完成',
        type: 'success',
        showClose: true,
      })
      file.progress = 100
      setStatus(file, 'status', statusObj.success)
      onUploadSuccess()
    }
    // 断点续传
    if (res?.status == '2') {
      let uploaded = res.uploaded
      let set = new Set(uploaded)
      uploaded = Array.from(set)
      const filter = chunksList.filter((item) => {
        if (uploaded.includes(item.current)) {
          item.progress = 1
        }
        return !uploaded.includes(item.current)
      })
      const totalCount = chunksList.length
      const uploadedCount = totalCount - filter.length
      if (uploadedChunks[file.fileId]) {
        uploadedChunks[file.fileId].length = uploadedCount
      } else {
        uploadedChunks[file.fileId] = []
        uploadedChunks[file.fileId].length = uploadedCount
      }
      if (!filter.length) {
        onAllSuccess(file)
      } else {
        upload(file, filter, md5, onAllSuccess, totalCount)
      }
    }
  } catch (error) {
    ElMessage({
      type: 'error',
      message: '上传失败',
    })
  }
}
// 单个文件所有的分片都上传完成 合并文件
/**
 *
 * @param {File} file 文件
 * @param {Number} ifReset 0代表默认正常上传 1代表合并失败点重新合并
 */
const onAllSuccess = (file) => {
  setStatus(file, 'status', statusObj.merge)
  mergeSimpleUpload({
    uniqueIdentifier: file.md5,
    size: file.file.size,
    name: file.file.name,
    caseId: file.params?.caseId,
    sectionType: file.params?.sectionType,
    ifReset: file.ifReset,
  })
    .then((res) => {
      if (res.code) {
        setStatus(file, 'ifReset', res.code)
      }
      if (res.code === 200) {
        setStatus(file, 'status', statusObj.success)
        file.progress = 100
        ElMessage({
          type: 'success',
          message: '上传成功',
        })
        const endTime = new Date()
        let uploadTime = file.startTime - endTime
        console.log(`文件${file.file.name}上传时间为${uploadTime}毫秒`)
        onUploadSuccess()
      } else if (res.code === 100) {
        console.log('重新上传')
        start(file)
      } else {
        setStatus(file, 'status', statusObj.mergeReject)
        ElMessage({
          type: 'error',
          message: '合并失败',
        })
      }
    })
    .catch((error) => {
      console.log('上传失败：', error)
      setStatus(file, 'status', statusObj.mergeReject)
      ElMessage({
        type: 'error',
        message: '合并失败',
      })
    })
}

const pause = (file) => {
  const fileId = file.fileId
  const source = cancelList[fileId]
  if (file.status === statusObj.uploading) {
    if (source) {
      const cancel = source.cancel
      cancel()
    }
  }
  if (file.status === statusObj.check) {
    if (abortList[file.fileId] && abortList[file.fileId].pause) {
      abortList[file.fileId].pause()
    }
  }
  setStatus(file, 'status', statusObj.pause)
}
const start = (file) => {
  if (file.preStatus === statusObj.check) {
    if (abortList[file.fileId] && abortList[file.fileId].start) {
      abortList[file.fileId].start()
      setStatus(file, 'status', statusObj.check)
    }
  }
  if (
    file.preStatus === statusObj.uploading ||
    file.preStatus === statusObj.reject ||
    file.ifReset === 100
  ) {
    if (uploadedChunks[file.fileId]) {
      uploadedChunks[file.fileId].length = 0
    }
    startUpload(file, file.md5, file.chunksList)
  }
}
const remove = (file) => {
  const fileId = file.fileId
  const source = cancelList[fileId]
  if (file.status === statusObj.uploading) {
    if (source) {
      const cancel = source.cancel
      cancel()
    }
  }
  if (file.status === statusObj.check) {
    if (abortList[file.fileId] && abortList[file.fileId].abort) {
      abortList[file.fileId].abort()
    }
  }
  const index = uploadList.value.findIndex((item) => {
    return item.fileId === fileId
  })
  uploadList.value.splice(index, 1)
}
const retry = (file) => {
  if (file.md5) {
    // 直接合并
    if (file.status === statusObj.mergeReject) {
      onAllSuccess(file)
    } else {
      // 从上传开始
      setStatus(file, 'status', statusObj.start)
      start(file)
    }
  } else {
    // 从计算md5开始
    setStatus(file, 'status', statusObj.check)
    computeMD5(file)
  }
}

const onUploadSuccess = () => {
  mitt.emit('fileSuccess')
}
const showList = ref(true)
const isOpenUpload = ref(false)
const cancelDialog = ref(false)
const packUp = () => {
  showList.value = !showList.value
}
const openUpload = () => {
  inputRef.value?.click()
}
const closeAll = (showDialog = true) => {
  const uploaded = uploadList.value.filter((item) => {
    return item.status === statusObj.success
  })
  if (uploaded.length !== uploadList.value.length && showDialog) {
    cancelDialog.value = true
  } else {
    cancelAll()
    isOpenUpload.value = false
  }
}

const cancelAll = () => {
  for (let i = uploadList.value.length - 1; i >= 0; i--) {
    remove(uploadList.value[i])
  }
}
const dialogConfirm = () => {
  cancelAll()
  cancelDialog.value = false
  isOpenUpload.value = false
  mitt.emit('confirmCancelUpload')
}
onMounted(() => {
  mitt.on('openUploader', (data) => {
    totalAccept.value = data.accept
    totalParams.value = data.params
    nextTick(() => {
      openUpload()
    })
  })
  mitt.on('closeAllUpload', (showDialog = true) => {
    closeAll(showDialog)
  })
})
const successCount = ref(0)
watch(
  () => {
    return uploadList.value.map((item) => {
      return item.status
    })
  },
  (newValue, oldValue) => {
    if (newValue === statusObj.success) {
      successCount.value++
    }
  }
)
const emit = defineEmits(['fileSuccess'])
defineExpose({
  openUpload,
  closeAll,
})
</script>

<template>
  <div class="golbalUpload" v-show="isOpenUpload">
    <div class="btns">
      <input
        ref="inputRef"
        class="select-file-input"
        type="file"
        :multiple="totalMultiple"
        :accept="totalAccept"
        @change="handleFileChange"
      />
    </div>
    <div class="list">
      <div class="top" @click.stop="packUp">
        <div class="left">上传列表</div>
        <div class="button">
          <div class="packUp">
            <el-tooltip
              :content="showList ? '点击收起' : '点击展开'"
              placement="top"
              :hide-after="0"
              popper-class="lmw-tooltip"
            >
              <div class="btn" @click.stop="packUp">
                <el-icon
                  size="18"
                  color="rgba(37, 38, 43, 0.8)"
                  v-show="showList"
                >
                  <ArrowDown />
                </el-icon>
                <el-icon
                  size="18"
                  color="rgba(37, 38, 43, 0.8)"
                  v-show="!showList"
                >
                  <ArrowUp />
                </el-icon>
              </div>
            </el-tooltip>
          </div>
          <div class="cancel" @click.stop="closeAll">
            <el-tooltip
              content="全部取消"
              placement="top"
              :hide-after="0"
              popper-class="lmw-tooltip"
            >
              <div class="btn">
                <el-icon size="18" color="rgba(37, 38, 43, 0.8)"
                  ><Close
                /></el-icon>
              </div>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div
        class="fileList"
        :class="{
          listHeight: showList,
        }"
      >
        <template v-for="fileItem in uploadList">
          <div class="fileItem" :class="'lmw_file_' + fileItem.status">
            <div class="fileTop">
              <div class="left">
                <img src="./img/file.png" />
                <div class="fileMessage">
                  <div class="fileName">
                    {{ fileItem.file.name }}
                  </div>
                  <div class="fileOtherMsg">
                    <span>{{ conversionSize(fileItem.file.size) }}</span>
                    <span class="spot"></span>
                    <!-- 上传中 -->
                    <span v-if="fileItem.status === statusObj.uploading">
                      {{ fileItem.progress }}%
                    </span>
                    <!-- 校验中 -->
                    <template v-if="fileItem.status === statusObj.check">
                      {{ fileItem.md5Progress }}%
                      <span class="spot"></span>
                    </template>
                    <span>{{ uploadEnum[fileItem.status] }}</span>
                    <!-- 上传中 -->
                    <template v-if="fileItem.status === statusObj.uploading">
                      <span class="spot"></span>
                      {{ conversionSize(fileItem.speed * 1024) }}/S
                    </template>
                  </div>
                </div>
              </div>
              <div class="right">
                <el-icon
                  v-if="fileItem.status === statusObj.uploading"
                  size="20"
                  @click="pause(fileItem)"
                >
                  <VideoPause />
                </el-icon>
                <el-icon
                  v-if="fileItem.status === statusObj.pause"
                  @click="start(fileItem)"
                  size="20"
                >
                  <VideoPlay />
                </el-icon>

                <el-icon @click="remove(fileItem)" size="20">
                  <CircleClose />
                </el-icon>

                <el-icon
                  v-if="
                    fileItem.status === statusObj.reject ||
                    fileItem.status === statusObj.mergeReject
                  "
                  @click="retry(fileItem, fileItem.status)"
                  ><RefreshLeft
                /></el-icon>
              </div>
              <div
                class="progress"
                :style="{
                  width: fileItem.progress + '%',
                }"
              ></div>
            </div>
          </div>
        </template>
      </div>
    </div>
    <el-dialog v-model="cancelDialog" title="是否执行" width="30%">
      <div>当前行为会取消所有正在上传的文件，是否继续执行？</div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelDialog = false">取消关闭</el-button>
          <el-button type="primary" @click="dialogConfirm">
            确认关闭
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
* {
  box-sizing: border-box;
}
.golbalUpload {
  position: fixed;
  right: 32px;
  bottom: 28px;
  z-index: 99999;
}
.btns {
  position: relative;
  .select-file-input {
    position: absolute;
    display: inline-block;
    left: -9999999px;
    top: -999999px;
    border: none;
    opacity: 0;
    width: 96px;
    height: 28px;
  }
}
.list {
  border-radius: 5px;
  box-shadow: 0 0 1px 1px rgba(28, 28, 32, 0.05),
    0 8px 24px rgba(28, 28, 32, 0.12);
  width: 400px;
  background-color: #fff;
  .top {
    padding: 0px 18px 0px 16px;
    display: flex;
    height: 54px;
    justify-content: space-between;
    align-items: center;
    transition: background-color 0.3s ease;
    &:hover {
      background-color: rgba(132, 133, 141, 0.08);
      cursor: pointer;
    }
  }
  .button {
    display: flex;
    .packUp {
      margin-right: 10px;
    }
  }
  .fileList {
    /* max-height: 54px; */
    height: 0px;
    transition: height 0.66s cubic-bezier(0.66, 0, 0.01, 1);
    overflow-y: scroll;
    &::-webkit-scrollbar {
      display: none;
    }
    .fileItem {
      position: relative;
    }
    .progress {
      position: absolute;
      left: 0px;
      height: 100%;
      background: rgba(132, 133, 141, 0.08);
      transition: width 0.5s ease;
    }
    .progress::after {
      content: '';
      display: block;
      position: absolute;
      z-index: 0;
      left: 0;
      bottom: 4px;
      height: 2px;
      width: 100%;
      background: #647dff;
    }
    .fileTop {
      position: relative;
      padding: 14px 18px 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 64px;
      width: 100%;
      img {
        height: 36px;
        width: 36px;
        margin-right: 15px;
      }
    }
    .left {
      display: flex;
      position: absolute;
      z-index: 1;
    }
    .right {
      position: absolute;
      z-index: 1;
      right: 18px;
      display: flex;
      align-items: center;
      i {
        margin-left: 5px;
        cursor: pointer;
      }
    }
    .fileMessage {
      width: 220px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 14px;
    }
    .fileOtherMsg {
      font-size: 12px;
      color: rgba(37, 38, 43, 0.5);
      display: flex;
      align-items: center;
    }
  }
}
.spot {
  padding: 0 8px;
  display: flex;
  align-items: center;
}
.spot::before {
  content: '';
  display: block;
  width: 2px;
  height: 2px;
  background: rgba(37, 38, 43, 0.5);
}
.listHeight {
  height: 400px !important;
}
</style>
<style lang="scss">
.lmw-tooltip {
  z-index: 999999 !important;
}
</style>
