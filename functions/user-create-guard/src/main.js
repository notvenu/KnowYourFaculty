import { Client, Users } from "node-appwrite";

const ALLOWED_EMAIL_DOMAIN = "vitapstudent.ac.in";

function parseEventUser() {
    const raw =
        process.env.APPWRITE_FUNCTION_EVENT_DATA ||
        process.env.APPWRITE_FUNCTION_DATA ||
        "{}";
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
    } catch {
        return null;
    }
    return null;
}

function isAllowedEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

async function main() {
    const eventName = String(process.env.APPWRITE_FUNCTION_EVENT || "");
    if (!eventName.startsWith("users.") || !eventName.includes(".create")) {
        console.log(`Skipping unsupported event: ${eventName || "unknown"}`);
        return;
    }

    const user = parseEventUser();
    if (!user?.$id) {
        console.log("Skipping event: user id not found in event payload.");
        return;
    }

    if (isAllowedEmail(user.email)) {
        console.log(`User ${user.$id} allowed (${user.email}).`);
        return;
    }

    const client = new Client()
        .setEndpoint(getRequiredEnv("APPWRITE_FUNCTION_API_ENDPOINT"))
        .setProject(getRequiredEnv("APPWRITE_FUNCTION_PROJECT_ID"))
        .setKey(getRequiredEnv("APPWRITE_API_KEY"));

    const users = new Users(client);
    await users.delete(user.$id);
    console.log(
        `Deleted user ${user.$id} with disallowed email: ${user.email || "unknown"}`
    );
}

main().catch((error) => {
    console.error("user-create-guard failed:", error?.message || error);
    process.exit(1);
});
