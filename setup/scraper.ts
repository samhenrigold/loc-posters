import { JSONFilePreset } from 'lowdb/node'
import axios from 'axios'
import { APIResponse, Poster, Schema } from '../types'
import fs from 'fs'

const CHECKPOINT_FILE = 'checkpoint.json'

interface Checkpoint {
  lastUrl: string | null
}

async function saveCheckpoint(url: string) {
  await fs.promises.writeFile(CHECKPOINT_FILE, JSON.stringify({ lastUrl: url }))
}

async function loadCheckpoint(): Promise<string | null> {
  try {
    const data = await fs.promises.readFile(CHECKPOINT_FILE, 'utf8')
    const checkpoint: Checkpoint = JSON.parse(data)
    return checkpoint.lastUrl
  } catch (error) {
    return null
  }
}

async function fetchPosters() {
  const db = await JSONFilePreset<Schema>('posters_database.json', { posters: [] })

  // Start from the last successful URL
  let url = 'https://www.loc.gov/photos/?fa=access-restricted:false%7Conline-format:image&fo=json&q=poster&sb=title_s&sp=96'

  console.log(`Starting from URL: ${url}`)

  while (url) {
    try {
      console.log(`Fetching: ${url}`)
      const response = await axios.get<APIResponse>(url)
      const data = response.data

      await db.update(({ posters }) => {
        for (const result of data.results) {
          const poster: Poster = {
            id: result.id,
            date: result.date,
            description: result.description?.[0] || null,
            image_url: result.image_url,
            subject: result.subject,
            title: result.item.title,
            summary: result.item.summary,
            medium: result.item.medium?.[0] || null
          }
          posters.push(poster)
        }
      })

      console.log(`Saved ${data.results.length} posters from this page`)

      url = data.pagination.next || ''
      if (url) {
        await saveCheckpoint(url)
      }
    } catch (error) {
      console.error('Error fetching data:', error instanceof Error ? error.message : 'Unknown error')
      console.log('Retrying in 60 seconds...')
      await new Promise(resolve => setTimeout(resolve, 60000)) // Wait for 60 seconds before retrying
    }
  }

  console.log('Finished fetching all posters')
  // Clear the checkpoint file when done
  await fs.promises.unlink(CHECKPOINT_FILE).catch(() => {})
}

fetchPosters()