class MarkHandler {
    static async saveMarkWithRetry(markData, maxRetries = 6, delay = 2000) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // استفاده از توابع محلی به جای fetch
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/mark-date', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                
                const promise = new Promise((resolve, reject) => {
                    xhr.onload = function() {
                        if (this.status >= 200 && this.status < 300) {
                            resolve(JSON.parse(xhr.response));
                        } else {
                            reject(new Error(xhr.statusText));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Network Error'));
                });
                
                xhr.send(JSON.stringify(markData));
                const data = await promise;
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

    static async deleteAllMarksWithRetry(symbol, maxRetries = 3, delay = 2000) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('DELETE', `/api/marks/${symbol}`, true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                
                const promise = new Promise((resolve, reject) => {
                    xhr.onload = function() {
                        if (this.status >= 200 && this.status < 300) {
                            resolve(JSON.parse(xhr.response));
                        } else {
                            reject(new Error(xhr.statusText));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Network Error'));
                });
                
                xhr.send();
                const data = await promise;
                return data;
                
            } catch (error) {
                console.log(`Delete attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                if (attempt === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}