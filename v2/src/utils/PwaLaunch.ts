export const TDV_PWA_LAUNCH_EVENT = 'tdv-pwa-launch-config'

export interface PwaLaunchConfig {
  option?: string
  preset?: string
  initialPath?: string
  title?: string
}

function getUrlParams(url: URL): URLSearchParams[] {
  const hashQuery = url.hash.split('?')[1]?.split('#')[0]
  return [url.searchParams, new URLSearchParams(hashQuery || '')]
}

function getParam(paramSets: URLSearchParams[], name: string): string | undefined {
  for (const params of paramSets) {
    const value = params.get(name)
    if (value !== null) return value
  }
  return undefined
}

export function parsePwaLaunchConfig(targetUrl: string): PwaLaunchConfig | null {
  let url: URL
  try {
    url = new URL(targetUrl)
  } catch {
    return null
  }

  const paramSets = getUrlParams(url)
  const config: PwaLaunchConfig = {
    option: getParam(paramSets, 'option'),
    preset: getParam(paramSets, 'preset'),
    initialPath: getParam(paramSets, 'initialPath'),
    title: getParam(paramSets, 'title'),
  }

  return Object.values(config).some(value => value !== undefined) ? config : null
}

export function dispatchPwaLaunchConfig(config: PwaLaunchConfig): void {
  window.dispatchEvent(new CustomEvent<PwaLaunchConfig>(TDV_PWA_LAUNCH_EVENT, {
    detail: config,
  }))
}
