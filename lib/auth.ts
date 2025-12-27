import { getAuth } from 'firebase/auth';
import { app } from './firebase'; // your initialized app

export const auth = getAuth(app);