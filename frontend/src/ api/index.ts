import axios from "axios";
const api = axios.create({
  baseURL: "http://localhost:3000/api", // or your backend URL
});

export { api };
