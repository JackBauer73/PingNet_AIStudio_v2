import toast from 'react-hot-toast';

/**
 * Gère les micro-coupures réseau (passage tunnel, réseau salle...)
 */
export async function submitWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        toast.error('❌ Impossible d\'enregistrer. Vérifiez votre connexion.');
        throw error;
      }
      // Backoff exponentiel : 1s, 2s, 4s, 8s
      const delay = Math.pow(2, attempt - 1) * 1000;
      toast.loading(`⏳ Nouvelle tentative dans ${delay / 1000}s...`, { duration: delay });
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max attempts reached');
}
