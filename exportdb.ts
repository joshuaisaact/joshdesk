import { Database } from 'bun:sqlite'

const exportDb = async (dbPath: string, outputPath: string) => {
  const db = new Database(dbPath)

  const data = {
    schedules: db.query('SELECT * FROM schedules').all(),
    settings: db.query('SELECT * FROM workspace_settings').all(),
    categories: db.query('SELECT * FROM workspace_categories').all(),
  }

  await Bun.write(outputPath, JSON.stringify(data, null, 2))
  console.log(`Exported data to ${outputPath}`)
}

// Usage
await exportDb('./data/joshdesk.db', `./backup${Date.now()}.json`)
