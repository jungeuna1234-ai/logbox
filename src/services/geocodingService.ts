export async function geocode(address: string, apiKey: string): Promise<{ lat: number; lng: number }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding request failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (body.status !== 'OK' || !Array.isArray(body.results) || body.results.length === 0) {
    throw new Error('No geocoding results');
  }
  const loc = body.results[0].geometry.location;
  return { lat: Number(loc.lat), lng: Number(loc.lng) };
}