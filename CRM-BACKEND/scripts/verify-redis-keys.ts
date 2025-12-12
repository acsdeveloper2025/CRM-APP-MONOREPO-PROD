
import 'dotenv/config';
import { createClient } from 'redis';

async function mapKeys() {
    const client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    await client.connect();

    console.log('Connected to Redis');

    const keys = [];
    for await (const key of client.scanIterator({
        MATCH: 'users:*',
        COUNT: 100
    })) {
        keys.push(key);
    }

    console.log('Keys found:', keys);
    await client.disconnect();
}

mapKeys();
