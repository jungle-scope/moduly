import { SignupRequest } from '../types/auth';

export const authApi = {
  signup: async (data: SignupRequest) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Signup failed');
    return response.json();
  },
};
