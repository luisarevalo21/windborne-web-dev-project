import { api } from ".";
export async function fetchBalloonData() {
  const response = await api.get("/balloon");
  return response.data;
}
