import SparkMD5 from 'spark-md5'
import { ElMessage } from 'element-plus'

export const checkFile = (files, accept, maxSize, sizeUnit) => {
  const fileList = Array.from(files)
  let returnArr = []
  let totalMaxSize = maxSize

  //  2 * 1024 * 1024 * 1024,
  //  2 * 1024
  if (sizeUnit === 'MB') {
    totalMaxSize = maxSize * 1024 * 1024
  }
  if (sizeUnit === 'KB') {
    totalMaxSize = maxSize * 1024
  }
  fileList.forEach((file) => {
    let extension = file.name.split('.').pop().toLowerCase()
    if (!accept.includes(`.${extension}`)) {
      ElMessage({
        type: 'error',
        message: '文件' + file.name + '格式错误，已阻止上传该文件',
        duration: 5000,
        showClose: true,
      })
    }

    if (file.size >= totalMaxSize) {
      ElMessage({
        type: 'error',
        message: '文件' + file.name + '超出大小，已阻止上传该文件',
        duration: 5000,
        showClose: true,
      })
    }
    if (accept.includes(`.${extension}`) && file.size <= totalMaxSize) {
      returnArr.push({
        file: file,
        suffixInfo: `.${extension}`,
      })
    }
  })
  return returnArr
}

export const getHash = () => {
  let hash = ''
  for (let i = 0; i < 9; i++) {
    hash += String.fromCharCode(65 + Math.floor(Math.random() * 26))
  }
  return hash
}

export const createFileChunk = (file, size) => {
  const fileChunkList = []
  let cur = 0
  while (cur < file.size) {
    fileChunkList.push({ file: file.slice(cur, cur + size) })
    cur += size
  }
  return fileChunkList
}

/**
 * 分段计算MD5
 * @param file {File}
 * @param options {Object} - onProgress | onSuccess | onError
 */
export function generateMD5(
  file,
  chunkSize = 10 * 1024 * 1024,
  options = {},
  abort
) {
  const fileReader = new FileReader()
  const blobSlice =
    File.prototype.slice ||
    File.prototype.mozSlice ||
    File.prototype.webkitSlice
  let isPause = false
  const fileNameList = file.name.split('.')
  let firstName = fileNameList.slice(0, -1).join('.')
  let suffix = fileNameList[fileNameList.length - 1]
  const chunks = Math.ceil(file.size / chunkSize)
  const chunksList = []
  let currentChunk = 0
  const spark = new SparkMD5.ArrayBuffer()
  let sparkFlag = true
  const loadNext = () => {
    if (currentChunk + 1 === chunks) {
      sparkFlag = true
    }
    if (currentChunk === Math.floor(chunks / 2)) {
      sparkFlag = true
    }
    let start = currentChunk * chunkSize
    let end = start + chunkSize >= file.size ? file.size : start + chunkSize
    const buffer = blobSlice.call(file, start, end)
    fileReader.readAsArrayBuffer(buffer)
    const item = {
      chunk: buffer,
      fileName: `${firstName}_${currentChunk}.${suffix}`,
      current: currentChunk + 1,
      progress: 0,
    }
    chunksList.push(item)
  }

  loadNext()

  fileReader.onload = (e) => {
    // if (sparkFlag) {
    //   spark.append(e.target.result)
    //   sparkFlag = false
    // }
    if (!isPause) {
      if (currentChunk < chunks - 1) {
        // spark.append(e.target.result)
        if (sparkFlag) {
          spark.append(e.target.result)
          sparkFlag = false
        }
        currentChunk++
        loadNext()
        if (options.onProgress && typeof options.onProgress == 'function') {
          options.onProgress(currentChunk, chunks - 1)
        }
      } else {
        let md5 = spark.end()
        // md5计算完毕
        // 为了文件过小连一片都分不出来这样会导致拿不到进度条，所以计算完毕要再调一遍
        if (options.onProgress && typeof options.onProgress == 'function') {
          options.onProgress(currentChunk, chunks - 1)
        }
        if (options.onSuccess && typeof options.onSuccess == 'function') {
          options.onSuccess(md5, chunksList)
        }
      }
    }
  }

  fileReader.onerror = function () {
    // console.log('MD5计算失败')
    if (options.onError && typeof options.onError == 'function') {
      options.onError()
    }
  }
  function abort() {
    fileReader.abort()
    spark.destroy()
  }
  function pause() {
    isPause = true
  }
  function start() {
    isPause = false
    loadNext()
  }
  return { abort, pause, start }
}

export const getChunkFormData = (file, md5, chunk, chunkSize, totalChunks) => {
  let formData = new FormData()
  const chunkBlob = chunk.chunk
  formData.set('chunkNumber', chunk.current)
  formData.set('chunkSize', chunkSize)
  formData.set('currentChunkSize', chunkBlob.size)
  formData.set('totalSize', file.file.size)
  formData.set('identifier', md5)
  formData.set('filename', file.file.name)
  formData.set('relativePath', file.file.name)
  formData.set('totalChunks', totalChunks)
  for (const [key, value] of Object.entries(file.params)) {
    formData.set(key, value)
  }
  const chunkfile = new File([chunkBlob], file.name)
  formData.set('upfile', chunkfile)
  return formData
}

// 198030965
export const conversionSize = (size) => {
  const gb = 1 * 1024 * 1024 * 1024
  const mb = 1 * 1024 * 1024
  const kb = 1 * 1024
  let totalSize = size
  if (size > gb) {
    totalSize = (size / gb).toFixed(2)
    return totalSize + 'GB'
  }
  if (size > mb) {
    totalSize = (size / mb).toFixed(2)
    return totalSize + 'MB'
  }
  if (size > kb) {
    totalSize = (size / kb).toFixed(2)
    return totalSize + 'KB'
  }
  return 0
}

// 计算文件上传速度（单位：kb/s）
export function calcUploadSpeed(uploadSize, timeUsed) {
  const speed = ((uploadSize / timeUsed) * 1000 * 8) / 1024
  return speed.toFixed(2)
}

// 计算文件上传耗时（单位：s）
export function calcTimeUsed(startTime, endTime) {
  const timeDiff = (endTime - startTime) / 1000
  return timeDiff.toFixed(2)
}
