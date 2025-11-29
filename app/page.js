// app/page.js  ← NEW HOMEPAGE (redirects to My Projects)
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/my-projects');
}