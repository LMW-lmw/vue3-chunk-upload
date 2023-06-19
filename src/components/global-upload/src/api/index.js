// import axios from 'axios'
import request from '../service'

// 是否可以上传
export function getCheck(data) {
  return request.post({
    url: '/file/uploader/check',
    data,
  })
}
// 询问文件是否上传过
export function getCurrentChunk(params) {
  return request.get({
    url: '/file/uploader/chunk',
    params,
  })
}
// 合并
export function mergeSimpleUpload(data) {
  return request.post({
    url: '/file/uploader/mergeFile',
    data,
  })
}

export function uploadChunk(formData, cancelToken) {
  return request.post({
    url: '/file/uploader/chunk',
    data: formData,
    cancelToken,
  })
}
