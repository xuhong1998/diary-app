export interface WeatherData {
  city: string
  temp: number
  desc: string
  icon: string
  humidity: string
}

const TIANDITU_TK = import.meta.env.VITE_TIANDITU_TK || ''
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || ''

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

function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  })
}

function getIconName(desc: string): string {
  for (const key of Object.keys(ICON_MAP)) {
    if (desc.includes(key)) return ICON_MAP[key]
  }
  return 'cloud'
}

async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; adcode: string }> {
  if (!TIANDITU_TK) {
    return { city: '未知', adcode: '' }
  }
  const ds = JSON.stringify({ keyWord: `${lon.toFixed(6)},${lat.toFixed(6)}` })
  const url = `https://api.tianditu.gov.cn/geocoder?postStr=${encodeURIComponent(ds)}&type=geocode&tk=${TIANDITU_TK}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== '0' || !data.location) {
    throw new Error('天地图解析失败')
  }
  const comp = data.location
  const city = comp.city || comp.county || comp.province || '未知'
  const adcode = comp.countyCode || comp.cityCode || ''
  return { city, adcode: adcode.replace(/^(省|国)/, '') }
}

async function getWeatherFromAmap(adcode: string): Promise<{ temp: number; desc: string; humidity: string }> {
  if (!AMAP_KEY) {
    throw new Error('高德 Key 未配置')
  }
  const city = adcode || '420100'
  const res = await fetch(
    `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${city}&extensions=base&output=JSON`
  )
  const data = await res.json()
  if (data.status !== '1' || !data.lives?.length) {
    throw new Error('天气获取失败')
  }
  const live = data.lives[0]
  return {
    temp: parseInt(live.temperature, 10) || 0,
    desc: live.weather,
    humidity: live.humidity,
  }
}

export async function fetchWeatherData(date: string): Promise<WeatherData> {
  const pos = await getLocation()
  let city = '未知'
  let adcode = ''

  try {
    const geo = await reverseGeocode(pos.lat, pos.lon)
    city = geo.city
    adcode = geo.adcode
  } catch {
    // 定位解析失败，用默认城市
  }

  const weather = await getWeatherFromAmap(adcode)

  const data: WeatherData = {
    city,
    temp: weather.temp,
    desc: weather.desc,
    icon: getIconName(weather.desc),
    humidity: weather.humidity,
  }
  cacheWeather(date, data)
  return data
}

export function getWeatherSvg(icon: string): string {
  return ICONS[icon] || ICONS.cloud
}
