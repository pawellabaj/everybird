// @vitest-environment jsdom
// The import jobs' messages (they hold codes; the rows word them) and Restore from backup's error, in each language.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RestoreBackup } from '@/components/app/RestoreBackup'
import { fileMessage, inatMessage } from '@/components/app/use-import-jobs'
import { en } from '@/i18n/messages/en'
import { es } from '@/i18n/messages/es'
import { BackupError, fromJson } from '@/lib/list/export'
import { withI18n } from './i18n-render'

afterEach(cleanup)

describe('inatMessage and fileMessage', () => {
  it('words each code in English as before', () => {
    expect(inatMessage('unknown-user', 'sam', en.ui)).toBe("We couldn't find an iNaturalist user called “sam”. Check the username (not the display name).")
    expect(inatMessage('no-birds', 'sam', en.ui)).toBe('“sam” has no public bird observations on iNaturalist yet.')
    expect(inatMessage('network', 'sam', en.ui)).toBe("Couldn't reach iNaturalist. Check your connection and try again.")
    expect(inatMessage('rate-limited', 'sam', en.ui)).toBe('iNaturalist is busy right now. Wait a minute, then try again.')
    expect(fileMessage('unknown-file', en.ui)).toBe("Couldn't read this file. Use eBird's life list download or MyEBirdData.csv.")
  })
  it('and in Spanish, the username kept', () => {
    expect(inatMessage('unknown-user', 'sam', es.ui)).toBe('No encontramos ningún usuario de iNaturalist llamado “sam”. Revisa el nombre de usuario (no el nombre visible).')
    expect(inatMessage('no-birds', 'sam', es.ui)).toBe('“sam” todavía no tiene observaciones públicas de aves en iNaturalist.')
    expect(inatMessage('network', 'sam', es.ui)).toBe(es.ui.import.inat.errors.network)
    expect(inatMessage('rate-limited', 'sam', es.ui)).toBe(es.ui.import.inat.errors.rateLimited)
    expect(fileMessage('damaged', es.ui)).toBe('No se pudo leer este archivo. Puede estar dañado o no ser una exportación de eBird.')
  })
})

describe('fromJson reasons', () => {
  const reason = (text: string) => {
    try {
      fromJson(text)
    } catch (e) {
      return e instanceof BackupError ? `${e.reason}: ${e.message}` : 'other'
    }
    return 'ok'
  }
  it('gives each refusal a reason and keeps its English message', () => {
    expect(reason('{')).toBe('json: This file is not valid JSON.')
    expect(reason('[]')).toBe('not-backup: This is not an Everybird backup.')
    expect(reason('{"v":9}')).toBe('version: Unsupported backup version.')
    expect(reason('{"v":4}')).toBe('damaged: Backup has no records.')
  })
})

describe('RestoreBackup: a bad file', () => {
  const pick = (text: string) => {
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    fireEvent.change(input, { target: { files: [new File([text], 'b.json', { type: 'application/json' })] } })
  }
  it("English: the lead and fromJson's own message", async () => {
    render(<RestoreBackup onRestore={() => {}} />)
    pick('{"v":4}')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("Couldn't restore this backup. Backup has no records."))
  })
  it('Spanish: the lead and the reason, worded', async () => {
    render(<RestoreBackup onRestore={() => {}} />, { wrapper: withI18n('es') })
    expect(screen.getByText('Restaurar copia de seguridad')).toBeInTheDocument()
    pick('not json')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo restaurar esta copia de seguridad. Este archivo no es un JSON válido.'))
  })
})
