# User Create Guard

This function deletes newly created Appwrite users when their email domain is not `vitapstudent.ac.in`.

## File

- `functions/user-create-guard/src/main.js`

## Trigger

- Event: `users.*.create`

## Required Environment Variables

- `APPWRITE_FUNCTION_API_ENDPOINT`
- `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_API_KEY`

## API Key Scope

Create an API key for this function with permission to manage users (delete).

## Runtime Command

Use a Node runtime command like:

```bash
node src/main.js
```

