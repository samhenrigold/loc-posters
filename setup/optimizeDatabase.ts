import { JSONFilePreset } from 'lowdb/node'
import { Schema, Poster } from '../types'

async function optimizeDatabase() {
  const db = await JSONFilePreset<Schema>('posters_database.json', { posters: [] })

  const optimizedPosters: Poster[] = db.data.posters.reduce((acc: Poster[], poster: Poster) => {
    // De-dupe on the id field
    const existingPoster = acc.find(p => p.id === poster.id)
    if (existingPoster) {
      return acc
    }

    // Optimize the poster
    const optimizedPoster: Poster = {
      ...poster,
      medium: Array.isArray(poster.medium) ? poster.medium[0] || null : poster.medium || null,
      description: Array.isArray(poster.description) ? poster.description[0] || null : poster.description || null,
      date: optimizeDate(poster.date)
    }

    acc.push(optimizedPoster)
    return acc
  }, [])

  // Save the optimized posters back to the database
  await db.update(() => ({ posters: optimizedPosters }))

  console.log(`Optimized database. Total posters: ${optimizedPosters.length}`)

  // Log a sample poster to verify the changes
  if (optimizedPosters.length > 0) {
    console.log('Sample optimized poster:')
    console.log(JSON.stringify(optimizedPosters[0], null, 2))
  }
}

function optimizeDate(date: string | null | undefined): string | null {
  if (date === null || date === undefined) return null;
  if (date.endsWith('-01-01')) {
    return date.slice(0, 4) // Return just the year
  }
  return date
}

optimizeDatabase()
