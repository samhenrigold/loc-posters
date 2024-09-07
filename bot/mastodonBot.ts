import { createRestAPIClient } from "masto";
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import dotenv from 'dotenv';
import { sanitizeHashtag } from './hashtagSanitizer';

dotenv.config();

// Types
type Poster = {
  id: string;
  title: string;
  date: string;
  description: string | null;
  image_url: string[];
  subject: string[];
  summary: string | null;
  medium: string | null;
  safe: boolean;
  content_warning: string | null;
  posted_count: number;
};

type Schema = {
  posters: Poster[];
};

// Database
class PosterDatabase {
  private db: Low<Schema>;

  constructor() {
    const adapter = new JSONFile<Schema>('posters_database.json');
    this.db = new Low(adapter, { posters: [] });
  }

  async read(): Promise<void> {
    await this.db.read();
  }

  async write(): Promise<void> {
    await this.db.write();
  }

  getRandomPoster(): Poster {
    if (!this.db.data) throw new Error("Database not loaded");
    
    const safePosters = this.db.data.posters.filter(poster => poster.safe);
    const minPostedCount = Math.min(...safePosters.map(p => p.posted_count ?? 0));
    const candidatePosters = safePosters.filter(p => (p.posted_count ?? 0) === minPostedCount);
    
    return candidatePosters[Math.floor(Math.random() * candidatePosters.length)];
  }

  async incrementPostedCount(posterId: string): Promise<void> {
    if (!this.db.data) throw new Error("Database not loaded");
    
    const poster = this.db.data.posters.find(p => p.id === posterId);
    if (poster) {
      poster.posted_count = (poster.posted_count ?? 0) + 1;
      await this.write();
    }
  }
}

// Mastodon Client
class MastodonClient {
  private client: ReturnType<typeof createRestAPIClient>;

  constructor(url: string, accessToken: string) {
    this.client = createRestAPIClient({
      url,
      accessToken,
    });
  }

  async uploadMedia(file: Blob, description: string): Promise<string> {
    const attachment = await this.client.v2.media.create({
      file,
      description,
    });
    return attachment.id;
  }

  async createStatus(status: string, mediaIds: string[], visibility: 'public' | 'unlisted' = 'public'): Promise<string> {
    const postedStatus = await this.client.v1.statuses.create({
      status,
      visibility,
      mediaIds,
    });
    return postedStatus?.id || '';
  }

  async replyToStatus(inReplyToId: string, status: string): Promise<void> {
    await this.client.v1.statuses.create({
      status,
      inReplyToId,
      visibility: 'unlisted',
    });
  }
}

// Poster Bot
class PosterBot {
  private db: PosterDatabase;
  private mastodon: MastodonClient;

  constructor() {
    this.db = new PosterDatabase();
    const mastodonUrl = process.env.MASTODON_URL;
    const mastodonToken = process.env.MASTODON_ACCESS_TOKEN;
    
    if (!mastodonUrl || !mastodonToken) {
      throw new Error('MASTODON_URL or MASTODON_ACCESS_TOKEN is not set in the environment variables');
    }
    
    this.mastodon = new MastodonClient(mastodonUrl, mastodonToken);
  }

  private createHashtags(subjects: string[]): string {
    return subjects.map(subject => `#${sanitizeHashtag(subject)}`).join(' ');
  }

  async postRandomPoster(dryRun: boolean = false): Promise<void> {
    await this.db.read();
    const poster = this.db.getRandomPoster();
    const largestImageUrl = poster.image_url[poster.image_url.length - 1];

    const hashtags = this.createHashtags(poster.subject);
    const statusText = `${poster.title}\n\n${poster.id}\n\n\n${hashtags}`;

    if (dryRun) {
      console.log('--- DRY RUN ---');
      console.log('Poster:', poster);
      console.log('Largest Image URL:', largestImageUrl);
      console.log('Alt Text:', poster.summary || poster.description || 'No description available');
      console.log('Status Text:', statusText);
      console.log('--- END DRY RUN ---');
      return;
    }

    try {
      const response = await fetch(largestImageUrl);
      const blob = await response.blob();

      const mediaId = await this.mastodon.uploadMedia(
        blob,
        poster.summary || ''
      );

      const statusId = await this.mastodon.createStatus(statusText, [mediaId]);
      console.log('Posted successfully:', statusId);

      await this.db.incrementPostedCount(poster.id);
    } catch (error) {
      console.error('Error posting to Mastodon:', error);
    }
  }
}

// Main execution
async function main() {
  const bot = new PosterBot();
  const dryRun = process.argv.includes('--dry-run');
  await bot.postRandomPoster(dryRun);
}

main().catch(console.error);