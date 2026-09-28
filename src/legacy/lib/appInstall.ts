import { useCallback, useEffect, useState } from 'react'
import { isIOSDevice } from './notifications'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false

  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean
  }

  return navigatorWithStandalone.standalone === true
}

export type InstallPromptResult = 'accepted' | 'dismissed' | 'unavailable'

export function useAppInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => isStandaloneDisplay())
  const isIOS = isIOSDevice()

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    const media = window.matchMedia('(display-mode: standalone)')
    const onDisplayChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setInstalled(true)
        setDeferredPrompt(null)
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onDisplayChange)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', onDisplayChange)
      }
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<InstallPromptResult> => {
    if (!deferredPrompt) {
      return 'unavailable'
    }

    // The retained event is single-use: clear it before prompting so a
    // second tap can never call prompt() on a consumed event.
    setDeferredPrompt(null)

    try {
      deferredPrompt.prompt()
    } catch {
      return 'dismissed'
    }

    try {
      const choice = await deferredPrompt.userChoice
      return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed'
    } catch {
      return 'dismissed'
    }
  }, [deferredPrompt])

  return {
    canInstall: deferredPrompt !== null,
    isInstalled: installed,
    isIOS,
    promptInstall,
  }
}
