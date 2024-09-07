import { JSONFilePreset } from 'lowdb/node'
import { Schema, Poster } from '../types'
import { GenerationConfig, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, SchemaType, type Part } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in the environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE
        }
    ]
});

const generationConfig: GenerationConfig = {
    temperature: 0.9,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            safe: {
                type: SchemaType.BOOLEAN
            },
            content_warning: {
                type: SchemaType.STRING
            }
        },
        required: [
            "safe"
        ]
    },
};

async function checkPoster(poster: Poster): Promise<{ safe: boolean; content_warning: string | null }> {
    const parts: Part[] = [
        { text: "You are a helpful assistant that classifies the following input image + metadata is Safe or Unsafe and requires a content warning. Content warnings should be short, to the point, and should not contain more detail than needed. Remain neutral and historically accurate, but air on the side of safe. The Unsafe categories are: CSEAI, Drugs, Gore, Harassment, Hate, Nudity or sexual, Offensive words, Self-harm, Terrorism or extremism, Toxic, Violence, Weapons." },
        { text: `Image: ${JSON.stringify(poster)}` },
        { text: "Verdict: " },
    ];

    const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig,
    });

    const response = JSON.parse(result.response.text());
    return response;
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkAllPosters() {
    const db = await JSONFilePreset<Schema>('posters_database.json', { posters: [] });
    const totalPosters = db.data.posters.length;

    let i = 0;
    while (i < totalPosters) {
        const poster = db.data.posters[i];

        // Skip posters that have already been checked
        if (poster.safe !== undefined) {
            console.log(`Skipping poster ${i + 1} (already checked)`);
            i++;
            continue;
        }

        console.log(`Checking poster ${i + 1} of ${totalPosters}`);

        try {
            const result = await checkPoster(poster);

            // Update the poster with the content warning information
            db.data.posters[i] = {
                ...poster,
                safe: result.safe,
                content_warning: result.content_warning
            };

            // Save changes after each poster check
            await db.write();

            console.log(`Poster ${i + 1} processed. Safe: ${result.safe}, Warning: ${result.content_warning || 'None'}`);
            i++;
        } catch (error) {
            if (error instanceof Error && error.message.includes('429')) {
                console.log('Received 429 error. Waiting for 60 seconds before retrying...');
                await delay(60000); // Wait for 60 seconds
            } else {
                console.error(`Error processing poster ${i + 1}:`, error);
                i++; // Move to the next poster even if there's an error
            }
        }

        // Add a small delay between requests to avoid hitting rate limits
        await delay(1000);
    }

    console.log('All posters have been checked for content warnings.');
}

checkAllPosters();