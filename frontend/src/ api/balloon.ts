import { api } from ".";

interface BalloonOptions {
  limit?: number;
  lat?: number;
  lon?: number;
  radius?: number;
}

// Retry helper for cold start handling
const retryWithBackoff = async <T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastRetry = i === maxRetries - 1;
      const isTimeout = error && typeof error === "object" && "code" in error && error.code === "ECONNABORTED";
      const isServerError =
        error && typeof error === "object" && "response" in error && (error as any).response?.status >= 500;

      // Only retry on timeout or 5xx errors
      if ((isTimeout || isServerError) && !isLastRetry) {
        const delay = baseDelay * Math.pow(2, i); // Exponential backoff
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
  throw new Error("Max retries exceeded");
};

export const fetchBalloonData = async (options?: BalloonOptions) => {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.lat !== undefined) params.append("lat", options.lat.toString());
    if (options?.lon !== undefined) params.append("lon", options.lon.toString());
    if (options?.radius) params.append("radius", options.radius.toString());

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const url = `${API_URL}/api/balloon${params.toString() ? "?" + params.toString() : ""}`;

    // Use retry logic with backoff for cold starts
    const response = await retryWithBackoff(() => api.get(url, {}));
    return response.data;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ECONNABORTED") {
      // Timeout error - likely cold start taking too long
      console.error("Request timeout - server may be waking up");
      throw new Error("Server is starting up (free tier cold start). This may take 30-60 seconds. Please try again.");
    } else if (error && typeof error === "object" && "response" in error) {
      const err = error as { response: { status: number; data: any } };
      // Server responded with error
      console.error("Server error:", err.response.status, err.response.data);

      if (err.response.status === 503 || err.response.status === 502) {
        throw new Error("Server is waking up from sleep. Please wait 10-15 seconds and try again.");
      }

      throw new Error(err.response.data.message || "Failed to fetch balloon data");
    } else if (error && typeof error === "object" && "request" in error) {
      // Request made but no response
      console.error("No response from server");
      throw new Error("Server is not responding. It may be waking up from sleep (10-15 seconds). Please try again.");
    }
    throw new Error("An unexpected error occurred");
  }
};
