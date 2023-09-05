import SparkMD5 from 'spark-md5'

onmessage = function (e) {
  const { file, chunkSize } = e.data
  const blobSlice =
    File.prototype.slice ||
    File.prototype.mozSlice ||
    File.prototype.webkitSlice
  const fileReader = new FileReader()
  const fileNameList = file.name.split('.')
  // 文件名
  let firstName = fileNameList.slice(0, -1).join('.')
  // 文件后缀名
  let suffix = fileNameList[fileNameList.length - 1]
  // 文件片数
  const chunks = Math.ceil(file.size / chunkSize)
  // 分片的文件
  const chunksList = []
  let currentChunk = 0

  // 在这里使用 spark-md5 库进行操作
  const spark = new SparkMD5.ArrayBuffer()

  const loadNext = () => {
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
    if (currentChunk < chunks - 1) {
      spark.append(e.target.result)
      currentChunk++
      loadNext()
      postMessage({ currentChunk, chunks: chunks - 1, type: 'onProgress' })
    } else {
      let md5 = spark.end()
      postMessage({ md5, chunksList, type: 'onSuccess' })
    }
  }
  fileReader.onerror = function (e) {
    postMessage({ e, type: 'onError' })
  }
}

// import { createChunk } from './utils.js'

// onmessage = async function (e) {
//   const proms = []
//   const { file, chunkSize, startIndex, endIndex } = e.data
//   for (let i = startIndex; i < endIndex; i++) {
//     proms.push(createChunk(file, i, chunkSize))
//   }
//   const chunks = await Promise.all(proms)
//   postMessage(chunks)
// }
