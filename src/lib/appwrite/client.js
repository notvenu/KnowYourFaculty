import serverConfig from '../../config/server.js';
import { Client, TablesDB, Storage } from 'node-appwrite';

// Create Appwrite client (server-side)
export const client = new Client();

client
  .setEndpoint(serverConfig.appwriteUrl)
  .setProject(serverConfig.appwriteProjectId)
  .setKey(serverConfig.appwriteApiKey);

// Initialize services (NEW)
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
