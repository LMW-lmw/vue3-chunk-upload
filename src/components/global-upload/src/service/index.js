import { BASE_URL, TIME_OUT } from './request/config'
import LmwAxios from './request/index'

export function getToken() {
  return (
    localStorage.getItem('Admin-Token') ||
    'eyJhbGciOiJIUzUxMiJ9.eyJ1c2VyX2lkIjoxLCJ1c2VyX2tleSI6IjM4MTk4NTk3LWE4ZjEtNDdlZi1hYjk4LTZjNmFmNzhkN2RkNSIsInVzZXJuYW1lIjoiYWRtaW4ifQ.dRiSZa050OHIMfxMys3tee_nCtUf264od6HaH00aNA9ZRQydVmp_iaqy1tTwOXqGWlPEUgBNpS0uFg3bSGBsuQ'
  )
}

const LmwRequest = new LmwAxios({
  baseURL: BASE_URL,
  timeout: TIME_OUT,
  // 单个实例的拦截
  interceptors: {
    // 请求拦截
    requestInterceptor: (config) => {
      if (getToken()) {
        config.headers['Authorization'] = 'Bearer ' + getToken() // 让每个请求携带自定义token 请根据实际情况自行修改
      }
      return config
    },
    requestInterceptorCatch: (error) => {
      return error
    },
    // 响应拦截
    responseInterceptor: (res) => {
      // 未设置状态码则默认成功状态
      return res.data
    },
    responseInterceptorCatch: (error) => {
      return error
    },
  },
})
export default LmwRequest
