import axios from "axios";

// Extended timeout for cold starts (free tier services that sleep)
const api = axios.create({
  baseURL: "http://localhost:3000/api",
  timeout: 60000, // 60 seconds to handle cold starts
});

export { api };
