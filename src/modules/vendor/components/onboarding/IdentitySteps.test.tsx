// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OtpStep, PhoneStep } from './IdentitySteps'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('PhoneStep', () => {
  it('marks Send OTP busy while the code is sent, keeping its label', () => {
    const view = render(<PhoneStep issues={[]} busy statusMessage={null} onContinue={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Sending OTP…' }).getAttribute('aria-busy')).toBe('true')

    view.rerender(<PhoneStep issues={[]} busy={false} statusMessage={null} onContinue={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Send OTP' }).hasAttribute('aria-busy')).toBe(false)
  })
})

describe('OtpStep', () => {
  it('marks Verify busy while the code is checked, keeping its label', () => {
    render(<OtpStep issues={[]} busy statusMessage={null} onContinue={() => undefined} onResend={async () => true} />)
    expect(screen.getByRole('button', { name: 'Verifying…' }).getAttribute('aria-busy')).toBe('true')
  })

  it('marks only Resend busy while a new code is sent', async () => {
    vi.useFakeTimers()
    let finish: (sent: boolean) => void = () => undefined
    const onResend = () => new Promise<boolean>((resolve) => { finish = resolve })
    render(<OtpStep issues={[]} busy={false} statusMessage={null} onContinue={() => undefined} onResend={onResend} />)
    act(() => vi.advanceTimersByTime(30_000))

    fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }))
    expect(screen.getByRole('button', { name: 'Sending OTP…' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Verify & continue' }).hasAttribute('aria-busy')).toBe(false)

    await act(async () => finish(true))
    expect(screen.getByRole('button', { name: /Resend OTP/ }).hasAttribute('aria-busy')).toBe(false)
  })
})
