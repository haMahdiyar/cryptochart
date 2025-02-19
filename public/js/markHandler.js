class MarkHandler {
    static async saveMarkWithRetry(markData, maxRetries = 6, delay = 2000) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch('/api/mark-date', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(markData)
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to save mark');
                }
                
                return data;
            } catch (error) {
                console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                if (attempt === maxRetries - 1) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}