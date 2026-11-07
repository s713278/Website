// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from '.'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
})

describe('Button pending', () => {
  it('is disabled and busy while keeping its name', () => {
    render(<Button pending>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.querySelector('[role="status"]')).toBeNull()
  })

  it('shows a decorative spinner at once', () => {
    render(<Button pending>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })

    const icon = button.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute('aria-hidden')).toBe('true')
    expect(icon!.getAttribute('role')).toBeNull()
    expect(icon!.getAttribute('class')).toContain('motion-reduce:animate-none')
    expect(screen.getByRole('button', { name: 'Save' })).toBe(button)
    expect(button.textContent).toBe('Save')
    expect(button.querySelector('[role="status"]')).toBeNull()
  })

  it('renders as before when not pending', () => {
    render(<Button pending={false}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(button.hasAttribute('aria-busy')).toBe(false)
    act(() => vi.advanceTimersByTime(300))
    expect(button.querySelector('svg')).toBeNull()
    expect(button.textContent).toBe('Save')
  })

  it('slots onto a single child with asChild', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Button asChild><a href="/shop">Open shop</a></Button>)
    const link = screen.getByRole('link', { name: 'Open shop' })
    expect(link.getAttribute('href')).toBe('/shop')
    expect(link.getAttribute('data-slot')).toBe('button')
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('stays disabled when disabled without pending', () => {
    render(<Button disabled>Save</Button>)
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
