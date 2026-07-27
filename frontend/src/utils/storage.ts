const STORAGE_BASE_URL = 
  import.meta.env.VITE_STORAGE_EXTERNAL_ENDPOINT || "http://localhost:9000";

const STORAGE_HEALTH_URL = `${STORAGE_BASE_URL.replace(/\/$/, "")}/minio/health/live`;

  // Wakes up storage service on cold start
export async function wakeUpStorageService(): Promise<void> {
  try {
    const response = await fetch(STORAGE_HEALTH_URL, {
      method: "GET",
    });

    if (response.ok) {
      console.log("Storage is awake and healthy!");
    } else {
      console.log(`Storage response status: ${response.status}`);
    }
  } catch (error) {
    // Fails silently if storage is spinning up from cold start
    console.log("Storage is spinning up from cold start...", error);
  }
}