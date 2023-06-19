const BASE_URL = import.meta.env.VITE_APP_BASE_API
  ? import.meta.env.VITE_APP_BASE_API
  : window.baseURL

const TIME_OUT = 120000

export { BASE_URL, TIME_OUT }
