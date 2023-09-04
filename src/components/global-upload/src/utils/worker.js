import { createChunk } from './utils.js'

onmessage = async function (e) {
  console.log(e)
  const proms = []
  const { file, chunkSize, startIndex, endIndex } = e.data
  console.log(file, chunkSize, startIndex, endIndex)
  for (let i = startIndex; i < endIndex; i++) {
    proms.push(createChunk(file, i, chunkSize))
  }
  const chunks = await Promise.all(proms)
  postMessage(chunks)
}
