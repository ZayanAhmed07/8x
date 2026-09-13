import { meetings } from "../lib/data";
console.log(`Seed preview ready: ${meetings.length} meetings, ${meetings.reduce((sum, meeting) => sum + meeting.transcript.length, 0)} transcript segments.`);
console.log("Wire this script to Drizzle inserts once DATABASE_URL is available.");
