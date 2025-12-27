'use server';

import { revalidatePath } from 'next/cache';

export async function searchHomeDepot(query: string) {
  if (!query.trim()) return [];

  try {
    const response = await fetch(
      `https://serpapi.com/search.json?engine=home_depot&q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}`
    );

    if (!response.ok) throw new Error('Search failed');

    const data = await response.json();
    return data.products || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}