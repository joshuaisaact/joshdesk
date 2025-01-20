import type { Installation, InstallationQuery } from '@slack/bolt'
import { Database } from 'bun:sqlite'
import { logger } from '../utils/logger'

type InstallationRow = {
  id: string
  type: 'enterprise' | 'team'
  data: string
}

export const installationDb = new Database('installations.sqlite')

installationDb.exec(`
  CREATE TABLE IF NOT EXISTS installations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL
  )
`)

export const storeInstallation = async (installation: Installation) => {
  const installationData = JSON.stringify(installation)

  if (installation.isEnterpriseInstall && installation.enterprise) {
    await installationDb.run(
      'INSERT OR REPLACE INTO installations (id, type, data) VALUES (?, ?, ?)',
      [installation.enterprise.id, 'enterprise', installationData],
    )
  } else if (installation.team) {
    await installationDb.run(
      'INSERT OR REPLACE INTO installations (id, type, data) VALUES (?, ?, ?)',
      [installation.team.id, 'team', installationData],
    )
  } else {
    throw new Error('Failed saving installation data to installationStore')
  }
}

export const fetchInstallation = async (
  installQuery: InstallationQuery<boolean>,
): Promise<Installation> => {
  try {
    if (
      installQuery.isEnterpriseInstall &&
      installQuery.enterpriseId !== undefined
    ) {
      const query = `SELECT data FROM installations WHERE id = ? AND type = 'enterprise'`
      const result = installationDb
        .query(query)
        .get(installQuery.enterpriseId) as InstallationRow | undefined

      if (!result) throw new Error('Enterprise installation not found')
      return JSON.parse(result.data) as Installation
    }

    if (installQuery.teamId !== undefined) {
      const query = `SELECT data FROM installations WHERE id = ? AND type = 'team'`
      const result = installationDb.query(query).get(installQuery.teamId) as
        | InstallationRow
        | undefined

      if (!result) throw new Error('Team installation not found')
      return JSON.parse(result.data) as Installation
    }

    throw new Error('Failed fetching installation')
  } catch (error) {
    logger.error('Error fetching installation:', error)
    throw error
  }
}

export const deleteInstallation = async (
  installQuery: InstallationQuery<boolean>,
): Promise<void> => {
  if (installQuery.isEnterpriseInstall && installQuery.enterpriseId) {
    await installationDb.run('DELETE FROM installations WHERE id = ?', [
      installQuery.enterpriseId,
    ])
  } else if (installQuery.teamId) {
    await installationDb.run('DELETE FROM installations WHERE id = ?', [
      installQuery.teamId,
    ])
  } else {
    throw new Error('Failed to delete installation')
  }
}
