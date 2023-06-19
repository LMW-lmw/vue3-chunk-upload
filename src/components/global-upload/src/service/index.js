import { BASE_URL, TIME_OUT } from './request/config'
import LmwAxios from './request/index'
const LmwRequest = new LmwAxios({
  baseURL: BASE_URL,
  timeout: TIME_OUT,
  // 单个实例的拦截
  interceptors: {
    // 请求拦截
    requestInterceptor: (config) => {
      return config
    },
    requestInterceptorCatch: (error) => {
      return error
    },
    // 响应拦截
    responseInterceptor: (res) => {
      // 未设置状态码则默认成功状态
      return res
    },
    responseInterceptorCatch: (error) => {
      return error
    },
  },
})
export default LmwRequest
