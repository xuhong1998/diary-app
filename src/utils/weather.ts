export interface WeatherData {
  city: string
  temp: number
  desc: string
  icon: string
  humidity: string
  locationFallback?: boolean
}

export type Logger = (msg: string) => void

const TIANDITU_TK = import.meta.env.VITE_TIANDITU_TK || ''
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || ''

const DEFAULT_ADCODE = '420100'
const DEFAULT_CITY = '武汉'

const ICON_MAP: Record<string, string> = {
  晴: 'sun',
 多云: 'cloud-sun',
晴间多云: 'cloud-sun',
阴: 'cloud',
雾: 'fog',
霾: 'fog',
小雨: 'rain',
中雨: 'rain',
大雨: 'rain',
暴雨: 'rain',
小雪: 'snow',
中雪: 'snow',
大雪: 'snow',
雨夹雪: 'snow',
雷阵雨: 'thunder',
雷暴: 'thunder',
}

const ICONS: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  'cloud-sun': '<path d="M12 1v2M5.22 4.22l1.42 1.42M1 12h2M5.22 19.78l1.42-1.42"/><circle cx="8" cy="10" r="3"/><path d="M18 20a4 4 0 0 0 0-8h-1.27A8 8 0 1 0 4 16.34"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  fog: '<path d="M3 5h18M3 10h18M3 15h12M3 20h18"/>',
  rain: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="22" x2="8" y2="26"/><line x1="12" y1="22" x2="12" y2="26"/><line x1="16" y1="22" x2="16" y2="26"/>',
  snow: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><circle cx="8" cy="24" r="1"/><circle cx="12" cy="24" r="1"/><circle cx="16" cy="24" r="1"/>',
  thunder: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="13 20 9 26 15 26 11 32"/>',
}

function cacheKey(date: string) {
  return `diary-weather-${date}`
}

export function getCachedWeather(date: string): WeatherData | null {
  const raw = localStorage.getItem(cacheKey(date))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function cacheWeather(date: string, data: WeatherData) {
  localStorage.setItem(cacheKey(date), JSON.stringify(data))
}

function makeLogger(onLog?: Logger): (msg: string) => void {
  return (msg: string) => {
    console.log('[weather]', msg)
    onLog?.(msg)
  }
}

async function getPermissionState(): Promise<string> {
  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
      return result.state
    }
  } catch {
    return 'unknown'
  }
  return 'unknown'
}

function getCurrentPositionOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

async function getLocation(log: (msg: string) => void): Promise<{ lat: number; lon: number }> {
  const supported = 'geolocation' in navigator
  const secure = window.isSecureContext
  const inIframe = window.self !== window.top

  log(`环境检测: isSecureContext=${secure}, protocol=${location.protocol}, inIframe=${inIframe}, geolocationSupported=${supported}`)
  log(`页面地址: ${location.href}`)
  log(`UA: ${navigator.userAgent}`)

  if (!secure) {
    log('定位不可用: 当前非安全上下文(geolocation 必须在 HTTPS 下运行)')
    throw new Error('非安全上下文(需HTTPS)，定位不可用')
  }
  if (!supported) {
    log('定位不可用: 浏览器不支持 Geolocation API')
    throw new Error('浏览器不支持定位')
  }

  // 策略：先低精度(网络定位，快)，失败后重试高精度(GPS，慢但更可靠)
  const attempts = [
    { label: '低精度(网络定位)', opts: { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 } },
    { label: '高精度(GPS)', opts: { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 } },
  ]

  let lastErr: GeolocationPositionError | null = null
  for (const attempt of attempts) {
    log(`开始定位(${attempt.label}): timeout=${attempt.opts.timeout}ms, maximumAge=${attempt.opts.maximumAge}ms`)
    try {
      const pos = await getCurrentPositionOnce(attempt.opts)
      const { latitude, longitude, accuracy } = pos.coords
      log(`定位成功(${attempt.label}): lat=${latitude}, lon=${longitude}, accuracy=${accuracy}m`)
      return { lat: latitude, lon: longitude }
    } catch (err) {
      lastErr = err as GeolocationPositionError
      const codeMap: Record<number, string> = {
        1: 'PERMISSION_DENIED(用户拒绝定位或浏览器/系统禁止了定位权限)',
        2: 'POSITION_UNAVAILABLE(GPS未开启或位置信息不可用)',
        3: 'TIMEOUT(超时未获取到位置)',
      }
      log(`定位失败(${attempt.label}): code=${lastErr.code} ${codeMap[lastErr.code] || '未知错误'} | message=${lastErr.message}`)
      // 权限被拒就不必重试了
      if (lastErr.code === 1) break
    }
  }

  const perm = await getPermissionState()
  log(`所有定位方式均失败，权限态=${perm}`)
  throw lastErr || new Error('定位失败')
}

function getIconName(desc: string): string {
  for (const key of Object.keys(ICON_MAP)) {
    if (desc.includes(key)) return ICON_MAP[key]
  }
  return 'cloud'
}

async function reverseGeocode(lat: number, lon: number, log: (msg: string) => void): Promise<{ city: string; adcode: string }> {
  if (!TIANDITU_TK) {
    log('天地图 TK 未配置，跳过逆地理(城市将无法识别，天气会回退默认城市)')
    return { city: '未知', adcode: '' }
  }
  const ds = JSON.stringify({ keyWord: `${lon.toFixed(6)},${lat.toFixed(6)}` })
  const url = `https://api.tianditu.gov.cn/geocoder?postStr=${encodeURIComponent(ds)}&type=geocode&tk=${TIANDITU_TK}`
  log(`逆地理请求: ${url}`)
  const res = await fetch(url)
  const data = await res.json()
  log(`天地图返回: ${JSON.stringify(data)}`)
  if (data.status !== '0' || !data.location) {
    log(`逆地理解析失败: status=${data.status ?? 'N/A'}, code=${data.code ?? 'N/A'}, msg=${data.msg ?? data.message ?? 'N/A'}`)
    throw new Error('天地图解析失败')
  }
  const comp = data.location
  const city = comp.city || comp.county || comp.province || '未知'
  const adcode = comp.countyCode || comp.cityCode || ''
  log(`逆地理结果: city=${city}, adcode=${adcode}`)
  return { city, adcode: adcode.replace(/^(省|国)/, '') }
}

async function getWeatherFromAmap(adcode: string, log: (msg: string) => void): Promise<{ temp: number; desc: string; humidity: string }> {
  if (!AMAP_KEY) {
    log('高德 Key 未配置，无法获取天气')
    throw new Error('高德 Key 未配置')
  }
  const city = adcode || DEFAULT_ADCODE
  log(`天气请求: city=${city}${adcode ? '' : '(默认武汉)'}，URL=restapi.amap.com/v3/weather/weatherInfo`)
  const res = await fetch(
    `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${city}&extensions=base&output=JSON`
  )
  const data = await res.json()
  log(`高德天气返回: ${JSON.stringify(data)}`)
  if (data.status !== '1' || !data.lives?.length) {
    log('天气解析失败')
    throw new Error('天气获取失败')
  }
  const live = data.lives[0]
  return {
    temp: parseInt(live.temperature, 10) || 0,
    desc: live.weather,
    humidity: live.humidity,
  }
}

export async function fetchWeatherData(date: string, onLog?: Logger): Promise<WeatherData> {
  const log = makeLogger(onLog)
  log(`===== fetchWeatherData 开始, date=${date} =====`)

  let lat: number | undefined
  let lon: number | undefined
  let locationFailed = false

  try {
    const pos = await getLocation(log)
    lat = pos.lat
    lon = pos.lon
  } catch {
    locationFailed = true
    log(`⚠️ 定位失败，将使用默认城市(${DEFAULT_CITY})获取天气`)
  }

  let city = locationFailed ? DEFAULT_CITY : '未知'
  let adcode = locationFailed ? DEFAULT_ADCODE : ''

  if (!locationFailed && lat !== undefined && lon !== undefined) {
    try {
      const geo = await reverseGeocode(lat, lon, log)
      city = geo.city
      adcode = geo.adcode
    } catch {
      log('⚠️ 逆地理失败，城市将显示为默认，天气仍可获取')
    }
  }

  const weather = await getWeatherFromAmap(adcode, log)
  log(`天气数据: temp=${weather.temp}°C, desc=${weather.desc}, humidity=${weather.humidity}%`)

  const data: WeatherData = {
    city,
    temp: weather.temp,
    desc: weather.desc,
    icon: getIconName(weather.desc),
    humidity: weather.humidity,
    locationFallback: locationFailed || undefined,
  }
  cacheWeather(date, data)
  log(`===== fetchWeatherData 完成 =====`)
  return data
}

export function getWeatherSvg(icon: string): string {
  return ICONS[icon] || ICONS.cloud
}
