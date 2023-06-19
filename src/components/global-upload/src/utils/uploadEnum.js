export default {
  check: '校验中',
  ready: '准备上传',
  uploading: '上传中',
  merge: '合并中',
  mergeReject: '合并失败',
  success: '上传完成',
  reject: '上传失败',
  pause: '暂停',
}
export const statusObj = {
  check: 'check',
  ready: 'ready',
  uploading: 'uploading',
  merge: 'merge',
  mergeReject: 'mergeReject',
  success: 'success',
  reject: 'reject',
  pause: 'pause',
}

export const setStatus = (file, key, status) => {
  if (key === 'status') {
    file.preStatus = file.status
  }
  file[key] = status
}
export const changeStatus = () => {}
